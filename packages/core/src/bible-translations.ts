import type {
  BibleBookNavItem,
  BibleChapter,
  BibleVerseInlineItem,
  BookSuggestion,
  KJVData,
  SearchResult,
  TranslationSearchOutcome,
} from "@sinag-bible/types";
import {
  flattenHelloaoVerseText,
  parseHelloaoVerseContentArray,
} from "./helloao-verse-inline";
import { getPassageMisspellingSuggestion } from "./book-aliases";
import { expandReferenceQuery } from "./reference-aliases";
import { lookupNamedPassage } from "./search-named-passages";
import {
  getPopularVerseRefsForKeyword,
  getVagueKeywordMaxPerBook,
  keywordHasPopularVerses,
} from "./search-keyword-popular";
import { levenshtein } from "./text-utils";
import {
  getOrBuildVagueKeywordIndex,
  lookupKeywordVerseRefs,
  type VagueKeywordVerseRef,
} from "./vague-keyword-index";

type TranslationData = KJVData;

/** Loaded translation text + nav used for search (any bundled or helloao API id). */
export type SearchTranslationContext = {
  searchKey: string;
  data: TranslationData;
  nav: BibleBookNavItem[];
};

/** KJV-aligned canon: index 0 = Genesis … 38 = Malachi, 39 = Matthew. */
const KJV_NT_FIRST_BOOK_INDEX = 39;

// ---------------------------------------------------------------------------
// External Bible API (bible.helloao.org) — for translations without local data
// ---------------------------------------------------------------------------

const BIBLE_API_BASE_URL = "https://bible.helloao.org/api";

/**
 * Maps internal TranslationId → the translation ID used by bible.helloao.org.
 * Only API-backed translations appear here; local JSON translations do not.
 */
const API_TRANSLATION_ID_MAP = {
  BSB: "BSB",
  ENG_ASV: "eng_asv",
  ENG_BBE: "eng_bbe",
  ENG_DARBY: "eng_darby",
  ENG_WEBBE: "eng_webbe",
} as const;

type ApiTranslationId = keyof typeof API_TRANSLATION_ID_MAP;

function isApiTranslationId(id: TranslationId): id is ApiTranslationId {
  return Object.prototype.hasOwnProperty.call(API_TRANSLATION_ID_MAP, id);
}

// Minimal types for the bible.helloao.org /complete.json response shape.
type ApiContentItem = {
  type: string;
  number?: number;
  content?: unknown[];
};
type ApiChapter = { number: number; content: ApiContentItem[] };
type ApiBook = { id: string; name: string; commonName?: string; chapters: ApiChapter[] };
type ApiCompleteResponse = {
  translation: { id: string; name: string; language: string };
  books: ApiBook[];
};

function convertApiResponseToTranslationData(api: ApiCompleteResponse): TranslationData {
  return {
    translation: api.translation.name,
    books: api.books.map((book) => {
      const chapters: string[][] = [];
      const verseInlineByChapter: BibleVerseInlineItem[][][] = [];

      for (const chapter of book.chapters) {
        const verseItems = chapter.content.filter(
          (item): item is ApiContentItem & { number: number } =>
            item.type === "verse" && typeof item.number === "number",
        );
        const verseStrings: string[] = [];
        const verseInlines: BibleVerseInlineItem[][] = [];
        for (const item of verseItems) {
          const inline = parseHelloaoVerseContentArray(item.content ?? []);
          verseInlines.push(inline);
          verseStrings.push(flattenHelloaoVerseText(inline));
        }
        chapters.push(verseStrings);
        verseInlineByChapter.push(verseInlines);
      }

      return {
        name: book.commonName ?? book.name,
        chapters,
        verseInlineByChapter,
      };
    }),
  };
}

async function fetchApiTranslationData(id: ApiTranslationId): Promise<TranslationData> {
  const apiId = API_TRANSLATION_ID_MAP[id];
  const url = `${BIBLE_API_BASE_URL}/${apiId}/complete.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Bible translation "${apiId}" from bible.helloao.org: HTTP ${response.status}`,
    );
  }
  const data = (await response.json()) as ApiCompleteResponse;
  return convertApiResponseToTranslationData(data);
}

// ---------------------------------------------------------------------------

const translationDataCache = new Map<TranslationId, Promise<TranslationData>>();

function loadTranslationData(id: TranslationId): Promise<TranslationData> {
  const ex = translationDataCache.get(id);
  if (ex) return ex;

  const p = (async () => {
    if (isApiTranslationId(id)) {
      return fetchApiTranslationData(id);
    }
    switch (id) {
      case "KJV":
        return (await import("../data/kjv.json")).default as TranslationData;
      case "WEB":
        return (await import("../data/web.json")).default as TranslationData;
      case "ADB1905":
        return (await import("../data/adb1905.json")).default as TranslationData;
      case "OEB":
        return (await import("../data/oeb.json")).default as TranslationData;
      default:
        throw new Error(`Unknown translation: ${id}`);
    }
  })();

  translationDataCache.set(id, p);
  return p;
}

const helloaoCompleteDataCache = new Map<string, Promise<TranslationData>>();

/**
 * Load full translation text from helloao.org `complete.json` (or bundled data when the id
 * maps to a local TranslationId). Used for search on API picker ids such as `tgl_ulb`.
 */
export async function fetchHelloaoCompleteTranslationData(apiId: string): Promise<TranslationData> {
  const normalized = apiId.trim();
  const cacheKey = normalized.toLowerCase();
  const existing = helloaoCompleteDataCache.get(cacheKey);
  if (existing) return existing;

  const p = (async () => {
    const upper = normalized.toUpperCase();
    if (isTranslationId(upper)) {
      return loadTranslationData(upper);
    }
    const internal = getInternalIdFromApiId(normalized);
    if (internal) {
      return loadTranslationData(internal);
    }
    const url = `${BIBLE_API_BASE_URL}/${cacheKey}/complete.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Bible translation "${normalized}" from bible.helloao.org: HTTP ${response.status}`,
      );
    }
    const json = (await response.json()) as ApiCompleteResponse;
    return convertApiResponseToTranslationData(json);
  })();

  helloaoCompleteDataCache.set(cacheKey, p);
  return p;
}

const dynamicBookNavPromiseCache = new Map<string, Promise<BibleBookNavItem[]>>();

/** Book navigation for any loaded translation dataset (KJV-aligned slugs when canon matches). */
export async function buildBookNavForTranslationData(
  data: TranslationData,
): Promise<BibleBookNavItem[]> {
  return buildBookNav(data);
}

export async function resolveSearchTranslationContext(
  translationId: string,
): Promise<SearchTranslationContext> {
  const trimmed = translationId.trim();
  const upper = trimmed.toUpperCase();
  if (isTranslationId(upper)) {
    const id = upper as TranslationId;
    const data = await loadTranslationData(id);
    const nav = await getBookNavForTranslationData(id);
    return { searchKey: id, data, nav };
  }

  const cacheKey = trimmed.toLowerCase();
  let navPromise = dynamicBookNavPromiseCache.get(cacheKey);
  const data = await fetchHelloaoCompleteTranslationData(trimmed);
  if (!navPromise) {
    navPromise = buildBookNavForTranslationData(data);
    dynamicBookNavPromiseCache.set(cacheKey, navPromise);
  }
  const nav = await navPromise;
  return { searchKey: cacheKey, data, nav };
}

/** Curated translations shown in the picker (API ids or bundled internal ids). */
export const FEATURED_TRANSLATION_IDS = [
  // Bundled (no API call)
  "KJV", // King James Version
  "WEB", // World English Bible
  "ADB1905", // Ang Dating Biblia - classic Tagalog (bundled)

  // Filipino languages (API)
  "tgl_ulb", // Banal na Bibliya - modern Tagalog
  "ceb_ulb", // Balaan nga Bibliya - Cebuano
  "ceb_ocb", // Ang Pulong sa Dios - Cebuano (Biblica)
  "ilo_ulb", // Ti Biblia - Ilocano

  // English translations (API)
  "eng_kjv", // King James Version (classic, most recognized)
  "eng_kja", // KJV with Apocrypha (for Catholic users)
  "eng_asv", // American Standard Version (1901)
  "eng_dra", // Douay-Rheims 1899 (Catholic - very relevant for Filipino audience)
  "BSB", // Berean Standard Bible (modern, popular)
  "eng_net", // NET Bible (modern, study notes)
  "eng_bbe", // Bible in Basic English (simple language)
  "eng_web", // World English Bible Classic
  "eng_webc", // World English Bible Catholic
  "eng_dby", // Darby Translation
  "eng_gnv", // Geneva Bible 1599 (historical)
  "eng_ylt", // Young's Literal Translation (study use)
  "eng_lsv", // Literal Standard Version

  // Regional
  "RV1909", // Reina Valera - Spanish
] as const;

export type FeaturedTranslationId = (typeof FEATURED_TRANSLATION_IDS)[number];

/** helloao.org API ids where the featured picker id differs from the API id. */
const FEATURED_TRANSLATION_API_IDS: Partial<Record<FeaturedTranslationId, string>> = {
  RV1909: "spa_r09",
};

const BUNDLED_FEATURED_TRANSLATION_IDS = new Set<FeaturedTranslationId>(["KJV", "WEB", "ADB1905"]);

const FEATURED_TRANSLATION_ID_SET = new Set<string>(FEATURED_TRANSLATION_IDS);

export function getFeaturedTranslationIds(): readonly FeaturedTranslationId[] {
  return FEATURED_TRANSLATION_IDS;
}

export function resolveFeaturedTranslationApiId(id: string): string {
  return FEATURED_TRANSLATION_API_IDS[id as FeaturedTranslationId] ?? id;
}

/**
 * True when `id` or optional `shortName` is in {@link FEATURED_TRANSLATION_IDS},
 * or when `id` is the helloao.org API id for a featured alias (e.g. `eng_asv` → ASV).
 */
export function isFeaturedTranslationId(id: string, shortName?: string): boolean {
  const candidates = [id.trim(), shortName?.trim()].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (FEATURED_TRANSLATION_ID_SET.has(candidate as FeaturedTranslationId)) return true;
    const upper = candidate.toUpperCase();
    if (FEATURED_TRANSLATION_ID_SET.has(upper as FeaturedTranslationId)) return true;
  }
  for (const featured of FEATURED_TRANSLATION_IDS) {
    const apiId = resolveFeaturedTranslationApiId(featured);
    if (apiId === id || apiId.toLowerCase() === id.toLowerCase()) return true;
  }
  return false;
}

/** Sort key for curated picker order; unknown ids sort after featured entries. */
export function getFeaturedTranslationSortIndex(id: string, shortName?: string): number {
  for (let i = 0; i < FEATURED_TRANSLATION_IDS.length; i++) {
    const featured = FEATURED_TRANSLATION_IDS[i]!;
    if (id === featured || shortName === featured) return i;
    const apiId = resolveFeaturedTranslationApiId(featured);
    if (apiId === id || apiId.toLowerCase() === id.toLowerCase()) return i;
  }
  return FEATURED_TRANSLATION_IDS.length;
}

export function isBundledFeaturedTranslationId(id: string): boolean {
  return BUNDLED_FEATURED_TRANSLATION_IDS.has(id.toUpperCase() as FeaturedTranslationId);
}

const TRANSLATION_ID_KEYS = {
  KJV: true,
  WEB: true,
  OEB: true,
  ADB1905: true,
  BSB: true,
  ENG_ASV: true,
  ENG_BBE: true,
  ENG_DARBY: true,
  ENG_WEBBE: true,
} as const;

export type TranslationId = keyof typeof TRANSLATION_ID_KEYS;

const TRANSLATION_IDS: TranslationId[] = [
  "KJV",
  "WEB",
  "OEB",
  "ADB1905",
  "BSB",
  "ENG_ASV",
  "ENG_BBE",
  "ENG_DARBY",
  "ENG_WEBBE",
];
export function getTranslationIds(): TranslationId[] {
  return TRANSLATION_IDS.slice();
}

export function isTranslationId(value: unknown): value is TranslationId {
  if (typeof value !== "string") return false;
  return Object.prototype.hasOwnProperty.call(TRANSLATION_ID_KEYS, value);
}

/**
 * Returns the external API ID used by bible.helloao.org for a given internal
 * TranslationId. For local-only translations (KJV, WEB, OEB, ADB1905) the
 * internal ID is also the API ID; for mapped translations (ENG_ASV → eng_asv)
 * the mapped external ID is returned.
 */
export function getExternalApiId(id: TranslationId): string {
  return isApiTranslationId(id) ? API_TRANSLATION_ID_MAP[id] : id;
}

/** Translations whose text is fetched from bible.helloao.org `complete.json` (not bundled locally). */
export function usesHelloaoCompleteJson(id: TranslationId): boolean {
  return isApiTranslationId(id);
}

/**
 * Reverse-maps an external API ID back to an internal TranslationId, or
 * returns null if the ID is not yet registered in this app.
 *
 * Examples: `"eng_asv"` → `"ENG_ASV"`, `"BSB"` → `"BSB"`, `"xyz"` → `null`.
 */
export function getInternalIdFromApiId(apiId: string): TranslationId | null {
  // Many local translations share their ID with the API (e.g. "KJV" → "KJV").
  const upper = apiId.toUpperCase();
  if (isTranslationId(upper)) return upper;
  // Check mapped translations (e.g. "eng_asv" → "ENG_ASV").
  for (const [internalId, externalId] of Object.entries(API_TRANSLATION_ID_MAP)) {
    if (externalId === apiId) return internalId as TranslationId;
  }
  return null;
}

/** Proper full titles for translation picker UI. */
export const TRANSLATION_FULL_NAME: Record<TranslationId, string> = {
  KJV: "King James Version",
  WEB: "World English Bible",
  OEB: "Open English Bible",
  ADB1905: "Ang Dating Biblia",
  BSB: "Berean Standard Bible",
  ENG_ASV: "American Standard Version",
  ENG_BBE: "Bible in Basic English",
  ENG_DARBY: "Darby Bible",
  ENG_WEBBE: "World English Bible British Edition",
};

/** Language label for picker suffix, e.g. "(English)". */
export const TRANSLATION_LANGUAGE_LABEL: Record<TranslationId, string> = {
  KJV: "English",
  WEB: "English",
  OEB: "English",
  ADB1905: "Tagalog",
  BSB: "English",
  ENG_ASV: "English",
  ENG_BBE: "English",
  ENG_DARBY: "English",
  ENG_WEBBE: "English",
};

/** e.g. `"KJV - King James Version (English)"`. */
export function formatTranslationDropdownLabel(id: TranslationId): string {
  return `${id} - ${TRANSLATION_FULL_NAME[id]} (${TRANSLATION_LANGUAGE_LABEL[id]})`;
}

function normalizeBookSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Slugs derived from each translation's book titles (e.g. ADB1905 "Filipos" → `filipos`). */
function buildBookNavFromData(data: TranslationData): BibleBookNavItem[] {
  return data.books.map((book) => ({
    name: book.name,
    slug: normalizeBookSlug(book.name),
    chapterCount: book.chapters.length,
  }));
}

let kjvCanonicalNavPromise: Promise<BibleBookNavItem[]> | null = null;

async function getKjvCanonicalNav(): Promise<BibleBookNavItem[]> {
  if (!kjvCanonicalNavPromise) {
    const kjv = await loadTranslationData("KJV");
    kjvCanonicalNavPromise = Promise.resolve(buildBookNavFromData(kjv));
  }
  return kjvCanonicalNavPromise;
}

/**
 * Reader URLs and `getBookNameFromSlug` use KJV-shaped English slugs (e.g. `philippians`).
 * Some translations use different book titles (e.g. Tagalog "Filipos"); for datasets that align
 * 1:1 with KJV (same book order and chapter counts), we reuse KJV slugs so routing matches.
 */
async function buildBookNav(data: TranslationData): Promise<BibleBookNavItem[]> {
  const kjvBooks = (await loadTranslationData("KJV")).books;
  const kjvCanonicalNav = await getKjvCanonicalNav();
  const useKjvSlugs =
    data.books.length === kjvBooks.length &&
    data.books.every(
      (book, i) => book.chapters.length === kjvBooks[i]!.chapters.length,
    );

  return data.books.map((book, index) => ({
    name: book.name,
    slug:
      useKjvSlugs && kjvCanonicalNav[index]
        ? kjvCanonicalNav[index]!.slug
        : normalizeBookSlug(book.name),
    chapterCount: book.chapters.length,
  }));
}

const bookNavPromiseCache: Partial<Record<TranslationId, Promise<BibleBookNavItem[]>>> = {};

async function getBookNavForTranslationData(id: TranslationId): Promise<BibleBookNavItem[]> {
  let p = bookNavPromiseCache[id];
  if (!p) {
    p = (async () => {
      const data = await loadTranslationData(id);
      return buildBookNav(data);
    })();
    bookNavPromiseCache[id] = p;
  }
  return p;
}

/** Short label for UI (no JSON load). */
export function getTranslationLabel(id: TranslationId): string {
  return id;
}

export async function getBookNavForTranslation(id: TranslationId): Promise<BibleBookNavItem[]> {
  return getBookNavForTranslationData(id);
}

/** Localized display title for a canonical reader book slug (e.g. `1-peter` → `"1 Pedro"` for ADB1905). */
export async function getBookDisplayNameForSlug(
  id: TranslationId,
  bookSlug: string,
): Promise<string | null> {
  const nav = await getBookNavForTranslationData(id);
  const book = nav.find((b) => b.slug === bookSlug);
  return book?.name ?? null;
}

export async function getChapterBySlugForTranslation(
  id: TranslationId,
  bookSlug: string,
  chapterNumber: number,
): Promise<BibleChapter | null> {
  const nav = await getBookNavForTranslationData(id);
  const bookIndex = nav.findIndex((book) => book.slug === bookSlug);
  if (bookIndex === -1 || !Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return null;
  }

  const data = await loadTranslationData(id);
  const book = data.books[bookIndex];
  if (!book) return null;
  const verses = book.chapters[chapterNumber - 1];
  if (!verses) return null;

  const verseInlineContent = book.verseInlineByChapter?.[chapterNumber - 1];

  return {
    bookName: book.name,
    bookSlug: nav[bookIndex]!.slug,
    chapterNumber,
    verses,
    ...(verseInlineContent ? { verseInlineContent } : {}),
  };
}

export async function getVersePreviewForTranslation(
  id: TranslationId,
  bookSlug: string,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null,
): Promise<string | null> {
  if (verseStart == null || verseStart < 1) return null;
  const ch = await getChapterBySlugForTranslation(id, bookSlug, chapter);
  if (!ch || !ch.verses.length) return null;

  const end = verseEnd != null && verseEnd >= verseStart ? verseEnd : verseStart;
  const startIdx = verseStart - 1;
  const endIdx = Math.min(end, ch.verses.length) - 1;
  if (startIdx > endIdx) return null;

  const slice = ch.verses.slice(startIdx, endIdx + 1);
  return slice.join(" ").trim() || null;
}

const MAX_SEARCH_RESULTS = 80;
/** Cap for general / book-name queries with no chapter or verse (most clients use this path). */
const VAGUE_SEARCH_MAX_RESULTS = 20;
const VAGUE_BOOK_ANCHORS_MAX = 2;
const MAX_FUZZY_BOOK_DISTANCE = 4;

/** Allow more edit distance for longer queries (e.g. "zacchriah" → Zechariah). */
function maxFuzzyBookDistanceForQuery(q: string): number {
  const len = q.trim().length;
  if (len < 4) return 0;
  if (len < 6) return 1;
  if (len < 9) return 2;
  if (len < 12) return 3;
  return MAX_FUZZY_BOOK_DISTANCE;
}

/**
 * Map a passage book slug from user input (e.g. Tagalog "juan") to the canonical
 * reader slug for this translation (e.g. "john") when titles differ by language.
 */
export async function resolvePassageBookSlugForTranslation(
  id: TranslationId,
  bookInputSlug: string,
): Promise<string | null> {
  const normalized = bookInputSlug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  if (!normalized) return null;

  const nav = await getBookNavForTranslationData(id);
  const direct = nav.findIndex((b) => b.slug === normalized);
  if (direct !== -1) return nav[direct]!.slug;

  const data = await loadTranslationData(id);
  for (let i = 0; i < data.books.length; i++) {
    const tn = normalizeBookSlug(data.books[i]!.name);
    if (tn === normalized) return nav[i]!.slug;
  }
  return null;
}

function normalizeTranslationSearchQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s*:\s+/g, ":");
}

/**
 * Expand alternate book titles users often type for chapter/verse queries
 * (datasets use a single canonical `book.name` per translation).
 */
function expandCommonReferenceAliases(q: string): string {
  return expandReferenceQuery(q);
}

/** Single-token hints for vague search (book titles use plural, common misspellings, etc.). */
function expandVagueBookQueryForMatching(q: string): string {
  const t = q.trim().toLowerCase();
  if (!t) return t;

  const firstWord = t.split(/\s+/)[0] ?? t;
  const corrected = getPassageMisspellingSuggestion(firstWord);
  if (corrected) {
    return corrected.toLowerCase() + t.slice(firstWord.length);
  }

  if (t === "psalm") return "psalms";

  return expandReferenceQuery(t);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `fragment` is a typed prefix of the full title or any title token ("mat" → Matthew). */
function bookTitleMatchesPrefix(nameLower: string, fragment: string): boolean {
  if (!fragment || fragment.length < 2) return false;
  if (nameLower.startsWith(fragment)) return true;
  return nameLower.split(/\s+/).some((token) => token.startsWith(fragment));
}

/**
 * Rank how well a translation book title matches a vague query (no chapter digits).
 * Lower score = better. Returns null = not a meaningful name match.
 */
function scoreBookNameForVagueQuery(nameLower: string, q: string): number | null {
  if (!q || q.length < 2) return null;

  if (nameLower === q) return 0;

  const tokens = nameLower.split(/\s+/).filter(Boolean);
  if (tokens.includes(q)) return 2;

  if (nameLower.startsWith(q + " ")) return 1;

  // Incomplete book names while typing ("mat" → Matthew, "2 cor" → 2 Corinthians).
  if (nameLower.startsWith(q)) return 3;

  if (tokens[0] === q) return 4;

  for (const token of tokens) {
    if (token.startsWith(q)) return 5;
  }

  if (q.length >= 3) {
    try {
      if (new RegExp(`\\b${escapeRegExp(q)}\\b`, "i").test(nameLower)) return 6;
    } catch {
      /* ignore */
    }
  }

  // Fuzzy typo for longer titles (scaled by query length; avoids “love” ≈ “Luke”).
  const fuzzyTarget = tokens.find((t) => !/^\d+$/.test(t)) ?? nameLower;
  if (q.length >= 4 && fuzzyTarget.length >= 4) {
    const maxD = maxFuzzyBookDistanceForQuery(q);
    if (maxD > 0) {
      const d = levenshtein(q, fuzzyTarget);
      if (d >= 1 && d <= maxD) return 7 + d;
    }
  }

  return null;
}

/** Whole-word match in verse text (avoids "mark" in "landmark"); short queries use substring. */
function verseMatchesVagueKeyword(verseLower: string, q: string, wordBoundaryRe?: RegExp): boolean {
  if (!q) return false;
  if (q.length < 3) return verseLower.includes(q);
  if (wordBoundaryRe) return wordBoundaryRe.test(verseLower);
  try {
    return new RegExp(`\\b${escapeRegExp(q)}\\b`, "i").test(verseLower);
  } catch {
    return verseLower.includes(q);
  }
}

function vagueKeywordWordBoundaryRe(q: string): RegExp | undefined {
  if (q.length < 3) return undefined;
  try {
    return new RegExp(`\\b${escapeRegExp(q)}\\b`, "i");
  } catch {
    return undefined;
  }
}

function searchResultFromVerseRef(
  data: TranslationData,
  nav: BibleBookNavItem[],
  ref: VagueKeywordVerseRef,
): SearchResult | null {
  const book = data.books[ref.bookIndex];
  const navItem = nav[ref.bookIndex];
  if (!book || !navItem) return null;

  const verses = book.chapters[ref.chapter - 1];
  const verseText = verses?.[ref.verse - 1] ?? "";
  if (!verseText) return null;

  return {
    bookName: book.name,
    bookSlug: navItem.slug,
    chapterNumber: ref.chapter,
    verseNumber: ref.verse,
    verseText,
  };
}

function tryAppendVagueKeywordHit(
  data: TranslationData,
  nav: BibleBookNavItem[],
  ref: VagueKeywordVerseRef,
  seen: Set<string>,
  keywordHitsPerBook: Map<string, number>,
  maxPerBook: number,
  into: SearchResult[],
): boolean {
  const navItem = nav[ref.bookIndex];
  if (!navItem) return false;

  const key = `${navItem.slug}:${ref.chapter}:${ref.verse}`;
  if (seen.has(key)) return false;

  const slug = navItem.slug;
  if ((keywordHitsPerBook.get(slug) ?? 0) >= maxPerBook) return false;

  const row = searchResultFromVerseRef(data, nav, ref);
  if (!row) return false;

  seen.add(key);
  keywordHitsPerBook.set(slug, (keywordHitsPerBook.get(slug) ?? 0) + 1);
  into.push(row);
  return true;
}

/** Interleave NT/OT keyword hits from the index with per-book caps. */
function collectVagueKeywordHitsFromIndex(
  searchKey: string,
  data: TranslationData,
  nav: BibleBookNavItem[],
  qKeyword: string,
  seen: Set<string>,
  keywordHitsPerBook: Map<string, number>,
  maxTotal: number,
  maxPerBook: number,
): SearchResult[] {
  const index = getOrBuildVagueKeywordIndex(searchKey, data);
  const refs = lookupKeywordVerseRefs(index, qKeyword);
  const ntRefs: VagueKeywordVerseRef[] = [];
  const otRefs: VagueKeywordVerseRef[] = [];

  for (const ref of refs) {
    const navItem = nav[ref.bookIndex];
    if (!navItem) continue;
    const key = `${navItem.slug}:${ref.chapter}:${ref.verse}`;
    if (seen.has(key)) continue;
    if (ref.bookIndex >= KJV_NT_FIRST_BOOK_INDEX) ntRefs.push(ref);
    else otRefs.push(ref);
  }

  const results: SearchResult[] = [];
  let iNt = 0;
  let iOt = 0;

  while (results.length < maxTotal && (iNt < ntRefs.length || iOt < otRefs.length)) {
    let addedThisRound = false;

    while (iNt < ntRefs.length && results.length < maxTotal) {
      if (tryAppendVagueKeywordHit(data, nav, ntRefs[iNt]!, seen, keywordHitsPerBook, maxPerBook, results)) {
        iNt += 1;
        addedThisRound = true;
        break;
      }
      iNt += 1;
    }

    while (iOt < otRefs.length && results.length < maxTotal) {
      if (tryAppendVagueKeywordHit(data, nav, otRefs[iOt]!, seen, keywordHitsPerBook, maxPerBook, results)) {
        iOt += 1;
        addedThisRound = true;
        break;
      }
      iOt += 1;
    }

    if (!addedThisRound) {
      if (iNt >= ntRefs.length && iOt >= otRefs.length) break;
    }
  }

  return results;
}

/** Collect keyword hits within a book index range; stops when `limit` matches are stored. */
function collectVagueKeywordHitsInRange(
  data: TranslationData,
  nav: BibleBookNavItem[],
  qKeyword: string,
  seen: Set<string>,
  keywordHitsPerBook: Map<string, number>,
  bookStart: number,
  bookEndInclusive: number,
  limit: number,
  maxPerBook: number,
  wordBoundaryRe?: RegExp,
): SearchResult[] {
  const matches: SearchResult[] = [];
  for (
    let bookIndex = bookStart;
    bookIndex <= bookEndInclusive && matches.length < limit;
    bookIndex++
  ) {
    const book = data.books[bookIndex];
    const navItem = nav[bookIndex];
    if (!book || !navItem) continue;

    for (let ch = 0; ch < book.chapters.length && matches.length < limit; ch++) {
      const chapterNumber = ch + 1;
      const verses = book.chapters[ch];
      if (!verses) continue;

      for (let v = 0; v < verses.length && matches.length < limit; v++) {
        const verseNumber = v + 1;
        const key = `${navItem.slug}:${chapterNumber}:${verseNumber}`;
        if (seen.has(key)) continue;

        const slug = navItem.slug;
        if ((keywordHitsPerBook.get(slug) ?? 0) >= maxPerBook) continue;

        const verseText = verses[v] ?? "";
        if (!verseMatchesVagueKeyword(verseText.toLowerCase(), qKeyword, wordBoundaryRe)) continue;

        seen.add(key);
        keywordHitsPerBook.set(slug, (keywordHitsPerBook.get(slug) ?? 0) + 1);
        matches.push({
          bookName: book.name,
          bookSlug: slug,
          chapterNumber,
          verseNumber,
          verseText,
        });
      }
    }
  }
  return matches;
}

/**
 * Interleave NT and OT hits in pairs (NT first each round) for an even mix, NT-prioritized.
 * Leftovers append NT before OT when one testament runs out (still favors NT at the front of spill).
 */
function interleaveNtOtVagueHits(
  ntHits: SearchResult[],
  otHits: SearchResult[],
  maxTotal: number,
): SearchResult[] {
  const merged: SearchResult[] = [];
  let iNt = 0;
  let iOt = 0;
  while (merged.length < maxTotal && (iNt < ntHits.length || iOt < otHits.length)) {
    if (iNt < ntHits.length && merged.length < maxTotal) {
      merged.push(ntHits[iNt]!);
      iNt += 1;
    }
    if (iOt < otHits.length && merged.length < maxTotal) {
      merged.push(otHits[iOt]!);
      iOt += 1;
    }
  }
  return merged;
}

/** Fill keyword hits up to `cap` within a book index range (used when interleave falls short). */
function spillVagueKeywordRemainder(
  data: TranslationData,
  nav: BibleBookNavItem[],
  qKeyword: string,
  spillSeen: Set<string>,
  keywordHitsPerBook: Map<string, number>,
  into: SearchResult[],
  bookStart: number,
  bookEnd: number,
  cap: number,
  maxPerBook: number,
  wordBoundaryRe?: RegExp,
): void {
  for (let bookIndex = bookStart; bookIndex <= bookEnd && into.length < cap; bookIndex++) {
    const book = data.books[bookIndex];
    const navItem = nav[bookIndex];
    if (!book || !navItem) continue;

    for (let ch = 0; ch < book.chapters.length && into.length < cap; ch++) {
      const chapterNumber = ch + 1;
      const verses = book.chapters[ch];
      if (!verses) continue;

      for (let v = 0; v < verses.length && into.length < cap; v++) {
        const verseNumber = v + 1;
        const slug = navItem.slug;
        const key = `${slug}:${chapterNumber}:${verseNumber}`;
        if (spillSeen.has(key)) continue;
        if ((keywordHitsPerBook.get(slug) ?? 0) >= maxPerBook) continue;

        const verseText = verses[v] ?? "";
        if (!verseMatchesVagueKeyword(verseText.toLowerCase(), qKeyword, wordBoundaryRe)) continue;

        spillSeen.add(key);
        keywordHitsPerBook.set(slug, (keywordHitsPerBook.get(slug) ?? 0) + 1);
        into.push({
          bookName: book.name,
          bookSlug: slug,
          chapterNumber,
          verseNumber,
          verseText,
        });
      }
    }
  }
}

function firstVerseSearchResult(
  data: TranslationData,
  nav: BibleBookNavItem[],
  bookIndex: number,
): SearchResult | null {
  const book = data.books[bookIndex];
  const navItem = nav[bookIndex];
  if (!book || !navItem) return null;
  const verseText = book.chapters[0]?.[0];
  if (verseText == null) return null;
  return {
    bookName: book.name,
    bookSlug: navItem.slug,
    chapterNumber: 1,
    verseNumber: 1,
    verseText,
  };
}

function searchResultDedupKey(r: SearchResult): string {
  return `${r.bookSlug}:${r.chapterNumber}:${r.verseNumber}`;
}

function pickVerseAtCanonicalRef(
  data: TranslationData,
  nav: BibleBookNavItem[],
  slug: string,
  chapter: number,
  verse: number,
): SearchResult | null {
  const bookIndex = nav.findIndex((b) => b.slug === slug);
  if (bookIndex === -1) return null;
  const book = data.books[bookIndex];
  const navItem = nav[bookIndex];
  if (!book || !navItem) return null;
  const verseText = book.chapters[chapter - 1]?.[verse - 1];
  if (verseText == null) return null;
  return {
    bookName: book.name,
    bookSlug: navItem.slug,
    chapterNumber: chapter,
    verseNumber: verse,
    verseText,
  };
}

/**
 * General search with no chapter/verse in the query: curated “popular” verses (when defined),
 * else up to two opening verses of matching books, then whole-word keyword hits interleaved
 * NT/OT (NT first in each pair; odd slot favors NT), capped at {@link VAGUE_SEARCH_MAX_RESULTS}.
 * At most one hit per book by default (up to three for curated keywords) so keyword
 * lists spread across more books.
 */
async function vagueSearchTranslation(
  ctx: SearchTranslationContext,
  qKeyword: string,
  qBookMatch: string,
): Promise<SearchResult[]> {
  const { searchKey, data, nav } = ctx;
  const maxPerBook = getVagueKeywordMaxPerBook(qKeyword);

  const seen = new Set<string>();
  const out: SearchResult[] = [];
  const keywordHitsPerBook = new Map<string, number>();
  const roomForBookSlug = (slug: string): boolean =>
    (keywordHitsPerBook.get(slug) ?? 0) < maxPerBook;
  const recordBookSlug = (slug: string): void => {
    keywordHitsPerBook.set(slug, (keywordHitsPerBook.get(slug) ?? 0) + 1);
  };

  const namedRef = lookupNamedPassage(qKeyword);
  if (namedRef) {
    const namedRow = pickVerseAtCanonicalRef(data, nav, namedRef.slug, namedRef.chapter, namedRef.verse);
    if (namedRow) return [namedRow];
  }

  for (const ref of getPopularVerseRefsForKeyword(qKeyword)) {
    const row = pickVerseAtCanonicalRef(data, nav, ref.slug, ref.chapter, ref.verse);
    if (!row) continue;
    const key = searchResultDedupKey(row);
    if (seen.has(key)) continue;
    if (!roomForBookSlug(row.bookSlug)) continue;
    seen.add(key);
    recordBookSlug(row.bookSlug);
    out.push(row);
  }

  // Book openers only when the query isn’t a curated thematic keyword (e.g. "love" → no Luke 1:1).
  let strongBookNameMatch = false;
  if (!keywordHasPopularVerses(qKeyword)) {
    const scored: { bookIndex: number; score: number }[] = [];
    for (let i = 0; i < data.books.length; i++) {
      const nameLower = data.books[i]!.name.toLowerCase();
      const sc = scoreBookNameForVagueQuery(nameLower, qBookMatch);
      if (sc != null) scored.push({ bookIndex: i, score: sc });
    }
    scored.sort((a, b) => a.score - b.score || a.bookIndex - b.bookIndex);
    strongBookNameMatch = scored.length > 0 && scored[0]!.score <= 5;
    const bookAnchorLimit = scored[0]?.score === 0 ? 1 : VAGUE_BOOK_ANCHORS_MAX;

    const usedBookIndices = new Set<number>();
    for (const { bookIndex } of scored.slice(0, bookAnchorLimit)) {
      if (usedBookIndices.has(bookIndex)) continue;
      usedBookIndices.add(bookIndex);
      const row = firstVerseSearchResult(data, nav, bookIndex);
      if (!row) continue;
      const key = searchResultDedupKey(row);
      if (seen.has(key)) continue;
      if (!roomForBookSlug(row.bookSlug)) continue;
      seen.add(key);
      recordBookSlug(row.bookSlug);
      out.push(row);
    }
  }

  // Skip scanning every verse when the query clearly targets a book title.
  if (strongBookNameMatch && out.length > 0) {
    return out;
  }

  const remainingKeywordSlots = VAGUE_SEARCH_MAX_RESULTS - out.length;
  if (remainingKeywordSlots <= 0) {
    return out;
  }

  let mergedKeyword: SearchResult[];
  if (qKeyword.length >= 3) {
    mergedKeyword = collectVagueKeywordHitsFromIndex(
      searchKey,
      data,
      nav,
      qKeyword,
      seen,
      keywordHitsPerBook,
      remainingKeywordSlots,
      maxPerBook,
    );
  } else {
    const lastBook = data.books.length - 1;
    const otEnd = Math.min(KJV_NT_FIRST_BOOK_INDEX - 1, lastBook);
    const wordBoundaryRe = vagueKeywordWordBoundaryRe(qKeyword);
    const ntCollectTarget = Math.ceil(remainingKeywordSlots / 2);
    const otCollectTarget = Math.floor(remainingKeywordSlots / 2);

    const ntHits =
      lastBook >= KJV_NT_FIRST_BOOK_INDEX
        ? collectVagueKeywordHitsInRange(
            data,
            nav,
            qKeyword,
            seen,
            keywordHitsPerBook,
            KJV_NT_FIRST_BOOK_INDEX,
            lastBook,
            ntCollectTarget,
            maxPerBook,
            wordBoundaryRe,
          )
        : [];

    const otHits =
      otEnd >= 0
        ? collectVagueKeywordHitsInRange(
            data,
            nav,
            qKeyword,
            seen,
            keywordHitsPerBook,
            0,
            otEnd,
            otCollectTarget,
            maxPerBook,
            wordBoundaryRe,
          )
        : [];

    mergedKeyword = interleaveNtOtVagueHits(ntHits, otHits, remainingKeywordSlots);

    if (mergedKeyword.length < remainingKeywordSlots) {
      const spillSeen = new Set(seen);
      for (const term of mergedKeyword) {
        spillSeen.add(searchResultDedupKey(term));
      }
      if (lastBook >= KJV_NT_FIRST_BOOK_INDEX) {
        spillVagueKeywordRemainder(
          data,
          nav,
          qKeyword,
          spillSeen,
          keywordHitsPerBook,
          mergedKeyword,
          KJV_NT_FIRST_BOOK_INDEX,
          lastBook,
          remainingKeywordSlots,
          maxPerBook,
          wordBoundaryRe,
        );
      }
      if (mergedKeyword.length < remainingKeywordSlots && otEnd >= 0) {
        spillVagueKeywordRemainder(
          data,
          nav,
          qKeyword,
          spillSeen,
          keywordHitsPerBook,
          mergedKeyword,
          0,
          otEnd,
          remainingKeywordSlots,
          maxPerBook,
          wordBoundaryRe,
        );
      }
    }
  }

  out.push(...mergedKeyword);
  return out;
}

const MAX_SPECIFIC_SEARCH_COLLECT = 500;

/** Lower score = higher relevance for specific/reference search ordering. */
function scoreSpecificSearchMatch(
  q: string,
  bookNameLower: string,
  chapterNumber: number,
  verseNumber: number,
  bookChapterLabel: string,
  matchesText: boolean,
): number | null {
  const exactRef = `${bookNameLower} ${chapterNumber}:${verseNumber}`;
  if (exactRef === q) return 0;
  const exactChapter = `${bookNameLower} ${chapterNumber}`;
  if (exactChapter === q) return 1;
  if (bookChapterLabel.startsWith(q)) return 2;
  if (bookNameLower.includes(q)) return 3;
  if (matchesText) return 4;
  return null;
}

async function collectSearchResultsForTranslation(
  ctx: SearchTranslationContext,
  q: string,
  maxResults: number = MAX_SEARCH_RESULTS,
): Promise<SearchResult[]> {
  const { data, nav } = ctx;
  type Scored = SearchResult & { score: number; bookIndex: number };
  const candidates: Scored[] = [];

  for (let bookIndex = 0; bookIndex < data.books.length; bookIndex++) {
    const book = data.books[bookIndex]!;
    const navItem = nav[bookIndex]!;
    const bookNameLower = book.name.toLowerCase();

    for (let ch = 0; ch < book.chapters.length; ch++) {
      const chapterNumber = ch + 1;
      const verses = book.chapters[ch];
      if (!verses) continue;

      const bookChapterLabel = `${bookNameLower} ${chapterNumber}`;

      for (let v = 0; v < verses.length; v++) {
        if (candidates.length >= MAX_SPECIFIC_SEARCH_COLLECT) break;

        const verseNumber = v + 1;
        const verseText = verses[v] ?? "";
        const verseTextLower = verseText.toLowerCase();
        const matchesText = verseTextLower.includes(q);
        const score = scoreSpecificSearchMatch(
          q,
          bookNameLower,
          chapterNumber,
          verseNumber,
          bookChapterLabel,
          matchesText,
        );
        if (score == null) continue;

        candidates.push({
          bookName: book.name,
          bookSlug: navItem.slug,
          chapterNumber,
          verseNumber,
          verseText,
          score,
          bookIndex,
        });
      }
      if (candidates.length >= MAX_SPECIFIC_SEARCH_COLLECT) break;
    }
    if (candidates.length >= MAX_SPECIFIC_SEARCH_COLLECT) break;
  }

  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      a.bookIndex - b.bookIndex ||
      a.chapterNumber - b.chapterNumber ||
      a.verseNumber - b.verseNumber,
  );

  return candidates.slice(0, maxResults).map(({ score: _s, bookIndex: _b, ...result }) => result);
}

function emptySearchOutcome(effectiveQuery: string): TranslationSearchOutcome {
  return { results: [], bookSuggestion: null, nearbyBooks: [], effectiveQuery };
}

function queryMatchesBookName(query: string, bookName: string): boolean {
  return query.trim().toLowerCase() === bookName.trim().toLowerCase();
}

function shouldRecommendBookSuggestion(
  suggestion: BookSuggestion | null,
  originalQuery: string,
): suggestion is BookSuggestion {
  if (!suggestion || suggestion.distance === 0) return false;
  if (queryMatchesBookName(originalQuery, suggestion.bookName)) return false;
  return true;
}

function bookSuggestionMatchesResults(suggestion: BookSuggestion, results: SearchResult[]): boolean {
  if (results.length === 0) return true;
  const primaryBook = results[0]?.bookName.toLowerCase();
  return suggestion.bookName.toLowerCase() === primaryBook;
}

function collectClosestBookSuggestions(
  data: TranslationData,
  nav: BibleBookNavItem[],
  query: string,
  options?: { limit?: number; maxDistance?: number },
): BookSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const firstWord = q.split(/\s+/)[0] ?? q;
  const refMatch = q.match(/^(.+?)\s+(\d.*)$/);
  const bookPrefix = refMatch?.[1]?.trim() ?? "";
  const maxDistance =
    options?.maxDistance ??
    maxFuzzyBookDistanceForQuery(bookPrefix || firstWord) + 1;
  const limit = options?.limit ?? 3;

  const matches: BookSuggestion[] = [];

  for (let i = 0; i < data.books.length; i++) {
    const book = data.books[i]!;
    const nameLower = book.name.toLowerCase();
    const dFull = levenshtein(q, nameLower);
    const dFirst = levenshtein(firstWord, nameLower);
    const dPrefix =
      bookPrefix.length > 0 ? levenshtein(bookPrefix, nameLower) : Number.POSITIVE_INFINITY;
    const dTypedPrefix =
      bookTitleMatchesPrefix(nameLower, firstWord) ||
      (bookPrefix.length > 0 && bookTitleMatchesPrefix(nameLower, bookPrefix))
        ? 0
        : Number.POSITIVE_INFINITY;
    const d = Math.min(dFull, dFirst, dPrefix, dTypedPrefix);
    if (d > maxDistance) continue;

    const correctedQuery =
      refMatch && refMatch[2] != null
        ? `${nameLower} ${refMatch[2]}`.replace(/\s+/g, " ").trim()
        : firstWord.length < q.length
          ? nameLower + q.slice(firstWord.length)
          : nameLower;

    matches.push({
      bookName: book.name,
      bookSlug: nav[i]?.slug,
      distance: d,
      correctedQuery,
    });
  }

  matches.sort(
    (a, b) => a.distance - b.distance || a.bookName.localeCompare(b.bookName),
  );

  const seen = new Set<string>();
  const unique: BookSuggestion[] = [];
  for (const match of matches) {
    const key = match.bookName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
    if (unique.length >= limit) break;
  }

  return unique;
}

async function tryNamedPassageResults(
  ctx: SearchTranslationContext,
  query: string,
): Promise<SearchResult[] | null> {
  const ref = lookupNamedPassage(query);
  if (!ref) return null;
  const row = pickVerseAtCanonicalRef(ctx.data, ctx.nav, ref.slug, ref.chapter, ref.verse);
  return row ? [row] : null;
}

async function vagueSearchWithBookFallback(
  ctx: SearchTranslationContext,
  trimmed: string,
  q: string,
): Promise<Pick<TranslationSearchOutcome, "results" | "effectiveQuery"> & { appliedSuggestion: BookSuggestion | null }> {
  const qBook = expandVagueBookQueryForMatching(q);
  let results = await vagueSearchTranslation(ctx, q, qBook);
  if (results.length > 0) {
    return { results, appliedSuggestion: null, effectiveQuery: q };
  }

  const suggestions = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 1 });
  const suggestion = suggestions[0] ?? null;
  if (!suggestion) {
    return { results: [], appliedSuggestion: null, effectiveQuery: q };
  }

  const correctedQ = normalizeTranslationSearchQuery(suggestion.correctedQuery);
  if (!correctedQ || correctedQ === q) {
    return { results: [], appliedSuggestion: suggestion.distance > 0 ? suggestion : null, effectiveQuery: q };
  }

  results = await vagueSearchTranslation(
    ctx,
    correctedQ,
    expandVagueBookQueryForMatching(correctedQ),
  );
  return {
    results,
    appliedSuggestion: suggestion.distance > 0 ? suggestion : null,
    effectiveQuery: correctedQ,
  };
}

export async function searchLoadedTranslation(
  ctx: SearchTranslationContext,
  query: string,
): Promise<TranslationSearchOutcome> {
  const trimmed = query.trim();
  const q = normalizeTranslationSearchQuery(trimmed);
  if (!q) return emptySearchOutcome(q);

  const namedResults = await tryNamedPassageResults(ctx, trimmed);
  if (namedResults && namedResults.length > 0) {
    return { results: namedResults, bookSuggestion: null, nearbyBooks: [], effectiveQuery: q };
  }

  let results: SearchResult[] = [];
  let bookSuggestion: BookSuggestion | null = null;
  let effectiveQuery = q;

  if (!/\d/.test(q)) {
    const vague = await vagueSearchWithBookFallback(ctx, trimmed, q);
    results = vague.results;
    effectiveQuery = vague.effectiveQuery;
    bookSuggestion = vague.appliedSuggestion;

    if (!bookSuggestion && results.length > 0 && !keywordHasPopularVerses(q)) {
      const closest = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 1 })[0] ?? null;
      if (
        closest &&
        shouldRecommendBookSuggestion(closest, trimmed) &&
        bookSuggestionMatchesResults(closest, results)
      ) {
        bookSuggestion = closest;
      }
    }
  } else {
    const qExpanded = expandCommonReferenceAliases(q);
    results = await collectSearchResultsForTranslation(ctx, qExpanded);
    effectiveQuery = qExpanded;

    if (results.length === 0 && qExpanded !== q) {
      results = await collectSearchResultsForTranslation(ctx, q);
      effectiveQuery = q;
    }

    if (results.length === 0) {
      const suggestion = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 1 })[0] ?? null;
      if (suggestion && suggestion.distance > 0) {
        const correctedQ = normalizeTranslationSearchQuery(suggestion.correctedQuery);
        const correctedExpanded = expandCommonReferenceAliases(correctedQ);
        if (correctedQ && correctedExpanded !== qExpanded && correctedQ !== q) {
          results = await collectSearchResultsForTranslation(ctx, correctedExpanded);
          if (results.length > 0) {
            bookSuggestion = suggestion;
            effectiveQuery = correctedExpanded;
          }
        }
      }
    }
  }

  let nearbyBooks: BookSuggestion[] = [];
  if (results.length === 0) {
    nearbyBooks = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 3 }).filter(
      (s) => shouldRecommendBookSuggestion(s, trimmed),
    );
    if (!bookSuggestion) {
      bookSuggestion = nearbyBooks[0] ?? null;
    }
  }

  if (!shouldRecommendBookSuggestion(bookSuggestion, trimmed)) {
    bookSuggestion = null;
  }

  return { results, bookSuggestion, nearbyBooks, effectiveQuery };
}

/**
 * Verse/text search for a translation. Applies common book-name aliases (e.g. Psalm → Psalms)
 * and, when the query looks like a reference but nothing matched, retries with
 * {@link getClosestBookSuggestionForTranslation} (typo / near-miss book titles).
 *
 * Queries **without** any digit (no chapter/verse) use a capped “vague” mode: up to two
 * opening verses of matching books, then whole-word keyword hits, max {@link VAGUE_SEARCH_MAX_RESULTS}.
 */
export async function getSearchResultsForTranslation(
  id: TranslationId,
  query: string,
): Promise<TranslationSearchOutcome> {
  const ctx = await resolveSearchTranslationContext(id);
  return searchLoadedTranslation(ctx, query);
}

export async function getTextMentionsForTranslation(
  id: TranslationId,
  keyword: string,
  options?: { limit?: number; excludeBookSlug?: string },
): Promise<SearchResult[]> {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];

  const limit = Math.max(1, options?.limit ?? 3);
  const excludeBookSlug = options?.excludeBookSlug ?? null;
  const data = await loadTranslationData(id);
  const nav = await getBookNavForTranslationData(id);
  const results: SearchResult[] = [];

  for (let bookIndex = 0; bookIndex < data.books.length; bookIndex++) {
    const book = data.books[bookIndex]!;
    const navItem = nav[bookIndex]!;
    if (excludeBookSlug && navItem.slug === excludeBookSlug) continue;

    for (let ch = 0; ch < book.chapters.length; ch++) {
      const chapterNumber = ch + 1;
      const verses = book.chapters[ch];
      if (!verses) continue;

      for (let v = 0; v < verses.length; v++) {
        if (results.length >= limit) return results;
        const verseText = verses[v] ?? "";
        if (!verseText.toLowerCase().includes(q)) continue;

        results.push({
          bookName: book.name,
          bookSlug: navItem.slug,
          chapterNumber,
          verseNumber: v + 1,
          verseText,
        });
      }
    }
  }

  return results;
}

/** If the query looks like a misspelled book name, return the closest match for this translation. */
export async function getClosestBookSuggestionForTranslation(
  id: TranslationId,
  query: string,
): Promise<BookSuggestion | null> {
  const data = await loadTranslationData(id);
  const nav = await getBookNavForTranslationData(id);
  return collectClosestBookSuggestions(data, nav, query, { limit: 1 })[0] ?? null;
}

/** Ranked near-miss book titles for “Did you mean?” UI when search returns nothing. */
export async function getClosestBookSuggestionsForTranslation(
  id: TranslationId,
  query: string,
  options?: { limit?: number; maxDistance?: number },
): Promise<BookSuggestion[]> {
  const data = await loadTranslationData(id);
  const nav = await getBookNavForTranslationData(id);
  return collectClosestBookSuggestions(data, nav, query, options);
}

/** Load translation data and build the keyword index in the background for faster search. */
export function warmTranslationSearchCache(translationId: string = "KJV"): void {
  void resolveSearchTranslationContext(translationId)
    .then((ctx) => {
      getOrBuildVagueKeywordIndex(ctx.searchKey, ctx.data);
    })
    .catch(() => {
      /* warm-up is best-effort */
    });
}
