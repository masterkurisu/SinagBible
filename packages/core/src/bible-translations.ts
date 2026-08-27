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
  formatStrongsLabel,
  lookupStrongsQuery,
  parseStrongsQuery,
} from "./search-strongs-index";
import {
  getPopularVerseRefsForKeyword,
  getVagueKeywordMaxPerBook,
  keywordHasPopularVerses,
} from "./search-keyword-popular";
import {
  getTopicalVerseRefsForQuery,
  queryHasTopicalVerses,
} from "./search-topical-index";
import { levenshtein } from "./text-utils";
import { LruMap } from "./lru-map";
import {
  evictVagueKeywordIndex,
  getOrBuildVagueKeywordIndex,
  lookupKeywordVerseRefs,
  scheduleVagueKeywordIndexBuild,
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

const helloaoCompleteDataCache = new LruMap<string, Promise<TranslationData>>(3);
const dynamicBookNavPromiseCache = new Map<string, Promise<BibleBookNavItem[]>>();

function evictHelloaoSearchCaches(cacheKey: string): void {
  dynamicBookNavPromiseCache.delete(cacheKey);
  evictVagueKeywordIndex(cacheKey);
}

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

  helloaoCompleteDataCache.set(cacheKey, p, evictHelloaoSearchCaches);
  return p;
}

/** Dev/diagnostic — current HelloAO complete.json cache entry count. */
export function getHelloaoCompleteDataCacheSize(): number {
  return helloaoCompleteDataCache.size;
}

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

/** Adjacent transpositions count as 1 (`jhon` → John); plain Levenshtein counts them as 2. */
function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
      }
    }
  }
  return dp[m]![n]!;
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

type ScoredVagueHit = SearchResult & { score: number; bookIndex: number };

const VAGUE_SCORE_OPENER_BASE = 10;
const VAGUE_SCORE_KEYWORD_EXACT = 100;
const VAGUE_SCORE_KEYWORD_PREFIX = 200;
const VAGUE_SCORE_KEYWORD_SUBSTRING = 300;
const VAGUE_LINEAR_COLLECT_CAP = 200;

function stripScoredVagueHit(hit: ScoredVagueHit): SearchResult {
  const { score: _score, bookIndex: _bookIndex, ...result } = hit;
  return result;
}

/** Sort by score, then NT/OT-interleave within a score band (mix is a tie-break only). */
function orderScoredVagueHits(hits: ScoredVagueHit[]): ScoredVagueHit[] {
  const sorted = [...hits].sort(
    (a, b) =>
      a.score - b.score ||
      a.bookIndex - b.bookIndex ||
      a.chapterNumber - b.chapterNumber ||
      a.verseNumber - b.verseNumber,
  );

  const bands: ScoredVagueHit[][] = [];
  for (const hit of sorted) {
    const last = bands[bands.length - 1];
    if (last && last[0]!.score === hit.score) last.push(hit);
    else bands.push([hit]);
  }

  const out: ScoredVagueHit[] = [];
  for (const band of bands) {
    const nt = band.filter((h) => h.bookIndex >= KJV_NT_FIRST_BOOK_INDEX);
    const ot = band.filter((h) => h.bookIndex < KJV_NT_FIRST_BOOK_INDEX);
    out.push(...(interleaveNtOtVagueHits(nt, ot, band.length) as ScoredVagueHit[]));
  }
  return out;
}

function capScoredVagueHits(
  hits: ScoredVagueHit[],
  maxPerBook: number,
  maxTotal: number,
): SearchResult[] {
  const out: SearchResult[] = [];
  const perBook = new Map<string, number>();
  const seen = new Set<string>();
  for (const hit of orderScoredVagueHits(hits)) {
    if (out.length >= maxTotal) break;
    const key = searchResultDedupKey(hit);
    if (seen.has(key)) continue;
    const used = perBook.get(hit.bookSlug) ?? 0;
    if (used >= maxPerBook) continue;
    seen.add(key);
    perBook.set(hit.bookSlug, used + 1);
    out.push(stripScoredVagueHit(hit));
  }
  return out;
}

function collectScoredKeywordHitsFromIndex(
  searchKey: string,
  data: TranslationData,
  nav: BibleBookNavItem[],
  qKeyword: string,
  seen: Set<string>,
  bookScopeIndex: number | null,
): ScoredVagueHit[] {
  const index = getOrBuildVagueKeywordIndex(searchKey, data);
  const exact = index.get(qKeyword) ?? [];
  const score =
    exact.length > 0 || qKeyword.length < 3
      ? VAGUE_SCORE_KEYWORD_EXACT
      : VAGUE_SCORE_KEYWORD_PREFIX;
  const refs = lookupKeywordVerseRefs(index, qKeyword);
  const hits: ScoredVagueHit[] = [];

  for (const ref of refs) {
    if (bookScopeIndex != null && ref.bookIndex !== bookScopeIndex) continue;
    const navItem = nav[ref.bookIndex];
    if (!navItem) continue;
    const key = `${navItem.slug}:${ref.chapter}:${ref.verse}`;
    if (seen.has(key)) continue;
    const row = searchResultFromVerseRef(data, nav, ref);
    if (!row) continue;
    hits.push({ ...row, score, bookIndex: ref.bookIndex });
  }

  return hits;
}

function collectScoredKeywordHitsLinear(
  data: TranslationData,
  nav: BibleBookNavItem[],
  qKeyword: string,
  seen: Set<string>,
  bookScopeIndex: number | null,
): ScoredVagueHit[] {
  const wordBoundaryRe = vagueKeywordWordBoundaryRe(qKeyword);
  const hits: ScoredVagueHit[] = [];
  const start = bookScopeIndex ?? 0;
  const end = bookScopeIndex != null ? bookScopeIndex + 1 : data.books.length;

  for (let bookIndex = start; bookIndex < end && hits.length < VAGUE_LINEAR_COLLECT_CAP; bookIndex++) {
    const book = data.books[bookIndex];
    const navItem = nav[bookIndex];
    if (!book || !navItem) continue;

    for (let ch = 0; ch < book.chapters.length && hits.length < VAGUE_LINEAR_COLLECT_CAP; ch++) {
      const verses = book.chapters[ch];
      if (!verses) continue;
      const chapterNumber = ch + 1;

      for (let v = 0; v < verses.length && hits.length < VAGUE_LINEAR_COLLECT_CAP; v++) {
        const verseNumber = v + 1;
        const key = `${navItem.slug}:${chapterNumber}:${verseNumber}`;
        if (seen.has(key)) continue;
        const verseText = verses[v] ?? "";
        if (!verseMatchesVagueKeyword(verseText.toLowerCase(), qKeyword, wordBoundaryRe)) continue;
        hits.push({
          bookName: book.name,
          bookSlug: navItem.slug,
          chapterNumber,
          verseNumber,
          verseText,
          score: VAGUE_SCORE_KEYWORD_SUBSTRING,
          bookIndex,
        });
      }
    }
  }

  return hits;
}

/**
 * General search with no chapter/verse in the query: curated popular verses or
 * topical-index verses (when defined), else up to two opening verses of matching
 * books, then keyword hits.
 * Candidates are scored, sorted, then per-book capped (1, or 3 if curated) and truncated
 * to {@link VAGUE_SEARCH_MAX_RESULTS}. NT/OT mix is a score-band tie-break only.
 */
async function vagueSearchTranslation(
  ctx: SearchTranslationContext,
  qKeyword: string,
  qBookMatch: string,
  bookScopeIndex: number | null = null,
): Promise<SearchResult[]> {
  const { searchKey, data, nav } = ctx;
  const curatedTheme =
    keywordHasPopularVerses(qKeyword) || queryHasTopicalVerses(qKeyword);
  const maxPerBook =
    bookScopeIndex != null
      ? VAGUE_SEARCH_MAX_RESULTS
      : curatedTheme
        ? Math.max(getVagueKeywordMaxPerBook(qKeyword), 3)
        : getVagueKeywordMaxPerBook(qKeyword);
  const seen = new Set<string>();
  const candidates: ScoredVagueHit[] = [];

  const namedRef = lookupNamedPassage(qKeyword);
  if (namedRef) {
    const namedRow = pickVerseAtCanonicalRef(data, nav, namedRef.slug, namedRef.chapter, namedRef.verse);
    if (namedRow) return [namedRow];
  }

  const popularRefs = getPopularVerseRefsForKeyword(qKeyword);
  const curatedRefs =
    popularRefs.length > 0 ? popularRefs : getTopicalVerseRefsForQuery(qKeyword);
  for (let i = 0; i < curatedRefs.length; i++) {
    const ref = curatedRefs[i]!;
    const row = pickVerseAtCanonicalRef(data, nav, ref.slug, ref.chapter, ref.verse);
    if (!row) continue;
    const bookIndex = nav.findIndex((item) => item.slug === row.bookSlug);
    if (bookScopeIndex != null && bookIndex !== bookScopeIndex) continue;
    const key = searchResultDedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      ...row,
      score: i,
      bookIndex: bookIndex === -1 ? 0 : bookIndex,
    });
  }

  let strongBookNameMatch = false;
  if (!curatedTheme) {
    const scored: { bookIndex: number; score: number }[] = [];
    for (let i = 0; i < data.books.length; i++) {
      if (bookScopeIndex != null && i !== bookScopeIndex) continue;
      const nameLower = data.books[i]!.name.toLowerCase();
      const sc = scoreBookNameForVagueQuery(nameLower, qBookMatch);
      if (sc != null) scored.push({ bookIndex: i, score: sc });
    }
    scored.sort((a, b) => a.score - b.score || a.bookIndex - b.bookIndex);
    strongBookNameMatch = scored.length > 0 && scored[0]!.score <= 5;
    const bookAnchorLimit = scored[0]?.score === 0 ? 1 : VAGUE_BOOK_ANCHORS_MAX;

    const usedBookIndices = new Set<number>();
    for (const { bookIndex, score } of scored.slice(0, bookAnchorLimit)) {
      if (usedBookIndices.has(bookIndex)) continue;
      usedBookIndices.add(bookIndex);
      const row = firstVerseSearchResult(data, nav, bookIndex);
      if (!row) continue;
      const key = searchResultDedupKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        ...row,
        score: VAGUE_SCORE_OPENER_BASE + score,
        bookIndex,
      });
    }
  }

  if (strongBookNameMatch && candidates.length > 0) {
    return capScoredVagueHits(candidates, maxPerBook, VAGUE_SEARCH_MAX_RESULTS);
  }

  const keywordHits =
    qKeyword.length >= 3
      ? collectScoredKeywordHitsFromIndex(searchKey, data, nav, qKeyword, seen, bookScopeIndex)
      : collectScoredKeywordHitsLinear(data, nav, qKeyword, seen, bookScopeIndex);

  candidates.push(...keywordHits);
  return capScoredVagueHits(candidates, maxPerBook, VAGUE_SEARCH_MAX_RESULTS);
}

const MAX_SPECIFIC_SEARCH_COLLECT = 500;
const BARE_CHAPTER_VERSE_MAX_RESULTS = 20;

export type TranslationSearchOptions = {
  /** Last-read book slug: preferred first hit for bare chapter:verse, and optional digit-only chip. */
  lastReadBookSlug?: string;
  /**
   * When set, keyword / bare chapter:verse / book-title hits stay in this book.
   * Book-qualified references (`John 3:16`) and named passages still return their verse
   * so the row can navigate even if the reader is in another book.
   */
  bookScopeSlug?: string;
  /** Overlay-owned abort for YVP hydration only. Never abort shared yvpFetch. */
  signal?: AbortSignal;
};

function isDigitOnlyQuery(q: string): boolean {
  return /^\d+$/.test(q);
}

function parseBareChapterVerseQuery(
  q: string,
): { chapter: number; verseStart: number; verseEnd: number } | null {
  const match = q.match(/^(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verseStart = Number(match[2]);
  const verseEnd = match[3] != null ? Number(match[3]) : verseStart;
  if (
    !Number.isInteger(chapter) ||
    !Number.isInteger(verseStart) ||
    !Number.isInteger(verseEnd) ||
    chapter < 1 ||
    verseStart < 1 ||
    verseEnd < verseStart
  ) {
    return null;
  }
  return { chapter, verseStart, verseEnd };
}

/**
 * Book-qualified references and named passages ignore this-book scope so the
 * overlay can still open that verse. Keywords, book titles, and bare `3:16` stay in-book.
 */
export function overlayQueryBypassesBookScope(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (lookupNamedPassage(trimmed)) return true;
  if (parseStrongsQuery(trimmed)) return false;
  const q = expandCommonReferenceAliases(normalizeTranslationSearchQuery(trimmed));
  if (!q || isDigitOnlyQuery(q) || parseBareChapterVerseQuery(q)) return false;
  return /[a-z]/.test(q) && /\d/.test(q);
}

function resolveBookScopeIndex(
  ctx: SearchTranslationContext,
  query: string,
  bookScopeSlug: string | undefined,
): number | null {
  const slug = bookScopeSlug?.trim();
  if (!slug || overlayQueryBypassesBookScope(query)) return null;
  const index = ctx.nav.findIndex((item) => item.slug === slug);
  return index >= 0 ? index : null;
}

function neighborVerseFromList(verses: string[] | undefined, verseNumber: number): string | undefined {
  if (!verses || verseNumber < 1) return undefined;
  const next = verses[verseNumber]?.trim();
  if (next) return next;
  if (verseNumber > 1) {
    const prev = verses[verseNumber - 2]?.trim();
    if (prev) return prev;
  }
  return undefined;
}

function attachNeighborVerseTexts(
  ctx: SearchTranslationContext,
  results: SearchResult[],
): SearchResult[] {
  return results.map((row) => {
    const bookIndex = ctx.nav.findIndex((item) => item.slug === row.bookSlug);
    if (bookIndex === -1) return row;
    const verses = ctx.data.books[bookIndex]?.chapters[row.chapterNumber - 1];
    const neighborVerseText = neighborVerseFromList(verses, row.verseNumber);
    return neighborVerseText ? { ...row, neighborVerseText } : row;
  });
}

function bookHasVerse(
  book: TranslationData["books"][number],
  chapter: number,
  verse: number,
): boolean {
  const verses = book.chapters[chapter - 1];
  return verses != null && verse >= 1 && verse <= verses.length;
}

/** Unique C:VV / CC:V (and 2-digit C:V / 4-digit CC:VV) parse against one book's shape. */
function uniqueDigitRefForBook(
  book: TranslationData["books"][number],
  digits: string,
): { chapter: number; verse: number } | null {
  if (!/^\d{2,4}$/.test(digits)) return null;

  const candidates: { chapter: number; verse: number }[] = [];
  const seen = new Set<string>();
  const add = (chapter: number, verse: number) => {
    const key = `${chapter}:${verse}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!bookHasVerse(book, chapter, verse)) return;
    candidates.push({ chapter, verse });
  };

  if (digits.length === 2) {
    add(Number(digits[0]), Number(digits[1]));
  } else if (digits.length === 3) {
    add(Number(digits[0]), Number(digits.slice(1)));
    add(Number(digits.slice(0, 2)), Number(digits[2]));
  } else {
    add(Number(digits.slice(0, 2)), Number(digits.slice(2)));
  }

  return candidates.length === 1 ? candidates[0]! : null;
}

function lastReadDigitBookSuggestion(
  ctx: SearchTranslationContext,
  digits: string,
  lastReadBookSlug: string | undefined,
): BookSuggestion | null {
  const slug = lastReadBookSlug?.trim();
  if (!slug) return null;
  const bookIndex = ctx.nav.findIndex((item) => item.slug === slug);
  if (bookIndex === -1) return null;
  const book = ctx.data.books[bookIndex];
  const navItem = ctx.nav[bookIndex];
  if (!book || !navItem) return null;
  const parsed = uniqueDigitRefForBook(book, digits);
  if (!parsed) return null;
  return {
    bookName: book.name,
    bookSlug: navItem.slug,
    distance: 1,
    correctedQuery: `${book.name.toLowerCase()} ${parsed.chapter}:${parsed.verse}`,
  };
}

function collectBareChapterVerseResults(
  ctx: SearchTranslationContext,
  ref: { chapter: number; verseStart: number; verseEnd: number },
  lastReadBookSlug: string | undefined,
  bookScopeIndex: number | null = null,
): SearchResult[] {
  const { data, nav } = ctx;
  const ntHits: SearchResult[] = [];
  const otHits: SearchResult[] = [];
  const lastReadHits: SearchResult[] = [];
  const preferSlug = lastReadBookSlug?.trim() ?? "";

  for (let bookIndex = 0; bookIndex < data.books.length; bookIndex++) {
    if (bookScopeIndex != null && bookIndex !== bookScopeIndex) continue;
    const book = data.books[bookIndex]!;
    const navItem = nav[bookIndex];
    if (!navItem) continue;
    const bucket =
      preferSlug && navItem.slug === preferSlug
        ? lastReadHits
        : bookIndex >= KJV_NT_FIRST_BOOK_INDEX
          ? ntHits
          : otHits;

    for (let verse = ref.verseStart; verse <= ref.verseEnd; verse++) {
      const row = pickVerseAtCanonicalRef(data, nav, navItem.slug, ref.chapter, verse);
      if (row) bucket.push(row);
    }
  }

  const interleaved = interleaveNtOtVagueHits(
    ntHits,
    otHits,
    BARE_CHAPTER_VERSE_MAX_RESULTS,
  );
  if (lastReadHits.length === 0) return interleaved;

  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const row of lastReadHits) {
    if (out.length >= BARE_CHAPTER_VERSE_MAX_RESULTS) break;
    const key = searchResultDedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  for (const row of interleaved) {
    if (out.length >= BARE_CHAPTER_VERSE_MAX_RESULTS) break;
    const key = searchResultDedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function parseBookQualifiedVerseRange(
  q: string,
): { book: string; chapter: number; verseStart: number; verseEnd: number } | null {
  const match = q.match(/^(.+[a-z].*)\s+(\d+):(\d+)-(\d+)$/);
  if (!match) return null;
  const book = match[1]!.trim();
  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = Number(match[4]);
  if (!book || /^\d+$/.test(book)) return null;
  if (
    !Number.isInteger(chapter) ||
    !Number.isInteger(verseStart) ||
    !Number.isInteger(verseEnd) ||
    chapter < 1 ||
    verseStart < 1 ||
    verseEnd < verseStart
  ) {
    return null;
  }
  return { book, chapter, verseStart, verseEnd };
}

/** Lower score = higher relevance for specific/reference search ordering. */
function scoreSpecificSearchMatch(
  q: string,
  bookNameLower: string,
  chapterNumber: number,
  verseNumber: number,
  bookChapterLabel: string,
  matchesText: boolean,
  verseRange: { book: string; chapter: number; verseStart: number; verseEnd: number } | null,
): number | null {
  if (
    verseRange &&
    bookNameLower === verseRange.book &&
    chapterNumber === verseRange.chapter &&
    verseNumber >= verseRange.verseStart &&
    verseNumber <= verseRange.verseEnd
  ) {
    return 0;
  }
  const exactRef = `${bookNameLower} ${chapterNumber}:${verseNumber}`;
  if (exactRef === q) return 0;
  const exactChapter = `${bookNameLower} ${chapterNumber}`;
  if (exactChapter === q) return 1;
  if (bookChapterLabel.startsWith(q)) return 2;
  if (bookNameLower.includes(q)) return 3;
  if (matchesText && !isDigitOnlyQuery(q)) return 4;
  return null;
}

async function collectSearchResultsForTranslation(
  ctx: SearchTranslationContext,
  q: string,
  maxResults: number = MAX_SEARCH_RESULTS,
  bookScopeIndex: number | null = null,
): Promise<SearchResult[]> {
  const { data, nav } = ctx;
  type Scored = SearchResult & { score: number; bookIndex: number };
  const candidates: Scored[] = [];
  const verseRange = parseBookQualifiedVerseRange(q);

  for (let bookIndex = 0; bookIndex < data.books.length; bookIndex++) {
    if (bookScopeIndex != null && bookIndex !== bookScopeIndex) continue;
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
          verseRange,
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
  const bookToken = bookPrefix || firstWord;
  const maxDistance =
    options?.maxDistance ?? maxFuzzyBookDistanceForQuery(bookToken);
  const limit = options?.limit ?? 3;

  const matches: BookSuggestion[] = [];

  for (let i = 0; i < data.books.length; i++) {
    const book = data.books[i]!;
    const nameLower = book.name.toLowerCase();
    const dToken = damerauLevenshtein(bookToken, nameLower);
    const dTypedPrefix =
      bookTitleMatchesPrefix(nameLower, firstWord) ||
      (bookPrefix.length > 0 && bookTitleMatchesPrefix(nameLower, bookPrefix))
        ? 0
        : Number.POSITIVE_INFINITY;
    const d = Math.min(dToken, dTypedPrefix);
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

async function tryStrongsResults(
  ctx: SearchTranslationContext,
  query: string,
  bookScopeIndex: number | null,
): Promise<SearchResult[] | null> {
  const hit = lookupStrongsQuery(query);
  if (!hit) return null;
  const label = formatStrongsLabel(hit);
  const rows: SearchResult[] = [];
  for (const ref of hit.refs) {
    const row = pickVerseAtCanonicalRef(ctx.data, ctx.nav, ref.slug, ref.chapter, ref.verse);
    if (!row) continue;
    if (bookScopeIndex != null) {
      const bookIndex = ctx.nav.findIndex((item) => item.slug === row.bookSlug);
      if (bookIndex !== bookScopeIndex) continue;
    }
    rows.push({ ...row, strongsLabel: label });
  }
  return rows;
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
  bookScopeIndex: number | null,
): Promise<Pick<TranslationSearchOutcome, "results" | "effectiveQuery"> & { appliedSuggestion: BookSuggestion | null }> {
  const qBook = expandVagueBookQueryForMatching(q);
  let results = await vagueSearchTranslation(ctx, q, qBook, bookScopeIndex);
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
    bookScopeIndex,
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
  options?: TranslationSearchOptions,
): Promise<TranslationSearchOutcome> {
  const trimmed = query.trim();
  const q = normalizeTranslationSearchQuery(trimmed);
  if (!q) return emptySearchOutcome(q);

  const namedResults = await tryNamedPassageResults(ctx, trimmed);
  if (namedResults && namedResults.length > 0) {
    return {
      results: attachNeighborVerseTexts(ctx, namedResults),
      bookSuggestion: null,
      nearbyBooks: [],
      effectiveQuery: q,
    };
  }

  const lastReadBookSlug = options?.lastReadBookSlug;
  const bookScopeIndex = resolveBookScopeIndex(ctx, trimmed, options?.bookScopeSlug);

  const strongsResults = await tryStrongsResults(ctx, trimmed, bookScopeIndex);
  if (strongsResults) {
    return {
      results: attachNeighborVerseTexts(ctx, strongsResults),
      bookSuggestion: null,
      nearbyBooks: [],
      effectiveQuery: q,
    };
  }

  let results: SearchResult[] = [];
  let bookSuggestion: BookSuggestion | null = null;
  let effectiveQuery = q;
  const bareChapterVerse = parseBareChapterVerseQuery(q);
  const digitOnly = isDigitOnlyQuery(q);
  const lastReadDigitChip = digitOnly
    ? lastReadDigitBookSuggestion(ctx, q, lastReadBookSlug)
    : null;

  if (!/\d/.test(q)) {
    const vague = await vagueSearchWithBookFallback(ctx, trimmed, q, bookScopeIndex);
    results = vague.results;
    effectiveQuery = vague.effectiveQuery;
    bookSuggestion = vague.appliedSuggestion;

    if (!bookSuggestion && results.length > 0 && !keywordHasPopularVerses(q) && !queryHasTopicalVerses(q)) {
      const closest = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 1 })[0] ?? null;
      if (
        closest &&
        shouldRecommendBookSuggestion(closest, trimmed) &&
        bookSuggestionMatchesResults(closest, results)
      ) {
        bookSuggestion = closest;
      }
    }
  } else if (bareChapterVerse) {
    results = collectBareChapterVerseResults(ctx, bareChapterVerse, lastReadBookSlug, bookScopeIndex);
    effectiveQuery = q;
  } else if (digitOnly) {
    results = [];
    effectiveQuery = q;
    bookSuggestion = lastReadDigitChip;
  } else {
    const qExpanded = expandCommonReferenceAliases(q);
    results = await collectSearchResultsForTranslation(ctx, qExpanded, MAX_SEARCH_RESULTS, bookScopeIndex);
    effectiveQuery = qExpanded;

    if (results.length === 0 && qExpanded !== q) {
      results = await collectSearchResultsForTranslation(ctx, q, MAX_SEARCH_RESULTS, bookScopeIndex);
      effectiveQuery = q;
    }

    if (results.length === 0) {
      const suggestion = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 1 })[0] ?? null;
      if (suggestion && suggestion.distance > 0) {
        const correctedQ = normalizeTranslationSearchQuery(suggestion.correctedQuery);
        const correctedExpanded = expandCommonReferenceAliases(correctedQ);
        if (correctedQ && correctedExpanded !== qExpanded && correctedQ !== q) {
          results = await collectSearchResultsForTranslation(
            ctx,
            correctedExpanded,
            MAX_SEARCH_RESULTS,
            bookScopeIndex,
          );
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
    if (lastReadDigitChip) {
      nearbyBooks = [lastReadDigitChip];
    } else if (!digitOnly && !bareChapterVerse) {
      nearbyBooks = collectClosestBookSuggestions(ctx.data, ctx.nav, trimmed, { limit: 3 }).filter(
        (s) => shouldRecommendBookSuggestion(s, trimmed),
      );
    }
    if (!bookSuggestion) {
      bookSuggestion = nearbyBooks[0] ?? null;
    }
  }

  if (!shouldRecommendBookSuggestion(bookSuggestion, trimmed)) {
    bookSuggestion = null;
  }

  return {
    results: attachNeighborVerseTexts(ctx, results),
    bookSuggestion,
    nearbyBooks,
    effectiveQuery,
  };
}

/**
 * Verse/text search for a translation. Applies common book-name aliases (e.g. Psalm → Psalms)
 * and, when the query looks like a reference but nothing matched, retries with
 * {@link getClosestBookSuggestionForTranslation} (typo / near-miss book titles).
 *
 * Queries **without** any digit (no chapter/verse) use a capped “vague” mode: scored
 * candidates, then per-book cap and max {@link VAGUE_SEARCH_MAX_RESULTS}.
 */
export async function getSearchResultsForTranslation(
  id: TranslationId,
  query: string,
  options?: TranslationSearchOptions,
): Promise<TranslationSearchOutcome> {
  const ctx = await resolveSearchTranslationContext(id);
  return searchLoadedTranslation(ctx, query, options);
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
      scheduleVagueKeywordIndexBuild(ctx.searchKey, ctx.data);
    })
    .catch(() => {
      /* warm-up is best-effort */
    });
}
