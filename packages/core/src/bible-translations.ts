import type {
  BibleBookNavItem,
  BibleChapter,
  BibleVerseInlineItem,
  BookSuggestion,
  KJVData,
  SearchResult,
} from "@sinag-bible/types";
import {
  flattenHelloaoVerseText,
  parseHelloaoVerseContentArray,
} from "./helloao-verse-inline";
import {
  getPopularVerseRefsForKeyword,
  keywordHasPopularVerses,
} from "./search-keyword-popular";

type TranslationData = KJVData;

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
/** At most one hit per book in vague search (popular + anchors + keyword) for broader coverage. */
const VAGUE_KEYWORD_MAX_PER_BOOK = 1;
const MAX_FUZZY_BOOK_DISTANCE = 3;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
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
  let s = q;
  // "Psalm 23" / "Psalm 23:1" → "Psalms …" (KJV/WEB/etc. use plural title).
  s = s.replace(/^psalm(\s+\d)/, "psalms$1");
  // Alternate name for Song of Solomon.
  s = s.replace(/^song\s+of\s+songs(\s+\d)/, "song of solomon$1");
  return s;
}

/** Single-token hints for vague search (book titles use plural, etc.). */
function expandVagueBookQueryForMatching(q: string): string {
  const t = q.trim().toLowerCase();
  if (t === "psalm") return "psalms";
  return t;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (tokens[0] === q) return 3;

  if (q.length >= 3) {
    try {
      if (new RegExp(`\\b${escapeRegExp(q)}\\b`, "i").test(nameLower)) return 4;
    } catch {
      /* ignore */
    }
  }

  // Single-edit typo only for longer titles (avoids “love” ≈ “Luke”, “job”, etc.).
  if (q.length >= 5 && nameLower.length >= 5) {
    const d = levenshtein(q, nameLower);
    if (d === 1) return 8;
  }

  return null;
}

/** Whole-word match in verse text (avoids "mark" in "landmark"); short queries use substring. */
function verseMatchesVagueKeyword(verseLower: string, q: string): boolean {
  if (!q) return false;
  if (q.length < 3) return verseLower.includes(q);
  try {
    return new RegExp(`\\b${escapeRegExp(q)}\\b`, "i").test(verseLower);
  } catch {
    return verseLower.includes(q);
  }
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
        if ((keywordHitsPerBook.get(slug) ?? 0) >= VAGUE_KEYWORD_MAX_PER_BOOK) continue;

        const verseText = verses[v] ?? "";
        if (!verseMatchesVagueKeyword(verseText.toLowerCase(), qKeyword)) continue;

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
        if ((keywordHitsPerBook.get(slug) ?? 0) >= VAGUE_KEYWORD_MAX_PER_BOOK) continue;

        const verseText = verses[v] ?? "";
        if (!verseMatchesVagueKeyword(verseText.toLowerCase(), qKeyword)) continue;

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
 * At most {@link VAGUE_KEYWORD_MAX_PER_BOOK} hits per book (including the prefix) so keyword
 * lists spread across more books.
 */
async function vagueSearchTranslation(
  id: TranslationId,
  qKeyword: string,
  qBookMatch: string,
): Promise<SearchResult[]> {
  const data = await loadTranslationData(id);
  const nav = await getBookNavForTranslationData(id);

  const seen = new Set<string>();
  const out: SearchResult[] = [];
  const keywordHitsPerBook = new Map<string, number>();
  const roomForBookSlug = (slug: string): boolean =>
    (keywordHitsPerBook.get(slug) ?? 0) < VAGUE_KEYWORD_MAX_PER_BOOK;
  const recordBookSlug = (slug: string): void => {
    keywordHitsPerBook.set(slug, (keywordHitsPerBook.get(slug) ?? 0) + 1);
  };

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
  if (!keywordHasPopularVerses(qKeyword)) {
    const scored: { bookIndex: number; score: number }[] = [];
    for (let i = 0; i < data.books.length; i++) {
      const nameLower = data.books[i]!.name.toLowerCase();
      const sc = scoreBookNameForVagueQuery(nameLower, qBookMatch);
      if (sc != null) scored.push({ bookIndex: i, score: sc });
    }
    scored.sort((a, b) => a.score - b.score || a.bookIndex - b.bookIndex);

    const usedBookIndices = new Set<number>();
    for (const { bookIndex } of scored.slice(0, VAGUE_BOOK_ANCHORS_MAX)) {
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

  const remainingKeywordSlots = VAGUE_SEARCH_MAX_RESULTS - out.length;
  if (remainingKeywordSlots <= 0) {
    return out;
  }

  const lastBook = data.books.length - 1;
  const otEnd = Math.min(KJV_NT_FIRST_BOOK_INDEX - 1, lastBook);
  // NT-prioritized split when odd: e.g. 15 → 8 NT, 7 OT.
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
        )
      : [];

  let mergedKeyword = interleaveNtOtVagueHits(ntHits, otHits, remainingKeywordSlots);

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
      );
    }
  }

  out.push(...mergedKeyword);
  return out;
}

async function collectSearchResultsForTranslation(
  id: TranslationId,
  q: string,
  maxResults: number = MAX_SEARCH_RESULTS,
): Promise<SearchResult[]> {
  const data = await loadTranslationData(id);
  const nav = await getBookNavForTranslationData(id);
  const results: SearchResult[] = [];

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
        if (results.length >= maxResults) return results;

        const verseNumber = v + 1;
        const verseText = verses[v] ?? "";
        const verseTextLower = verseText.toLowerCase();

        const matchesReference =
          bookNameLower.includes(q) ||
          bookChapterLabel.startsWith(q) ||
          `${bookNameLower} ${chapterNumber}` === q ||
          `${bookNameLower} ${chapterNumber}:${verseNumber}` === q;

        const matchesText = verseTextLower.includes(q);

        if (matchesReference || matchesText) {
          results.push({
            bookName: book.name,
            bookSlug: navItem.slug,
            chapterNumber,
            verseNumber,
            verseText,
          });
        }
      }
    }
  }

  return results;
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
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  const q = normalizeTranslationSearchQuery(trimmed);
  if (!q) return [];

  if (!/\d/.test(q)) {
    const qBook = expandVagueBookQueryForMatching(q);
    return await vagueSearchTranslation(id, q, qBook);
  }

  const qExpanded = expandCommonReferenceAliases(q);
  let results = await collectSearchResultsForTranslation(id, qExpanded);
  if (results.length > 0) return results;

  if (qExpanded !== q) {
    results = await collectSearchResultsForTranslation(id, q);
    if (results.length > 0) return results;
  }

  const suggestion = await getClosestBookSuggestionForTranslation(id, trimmed);
  if (!suggestion) return [];

  const correctedQ = normalizeTranslationSearchQuery(suggestion.correctedQuery);
  const correctedExpanded = expandCommonReferenceAliases(correctedQ);
  if (!correctedQ) return [];
  if (correctedExpanded === qExpanded || correctedQ === q) return [];

  results = await collectSearchResultsForTranslation(id, correctedExpanded);
  return results;
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
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const data = await loadTranslationData(id);

  const firstWord = q.split(/\s+/)[0] ?? q;
  /** Book-shaped prefix before chapter number: "psalm 23:1" → "psalm"; "1 john 3:16" → "1 john". */
  const refMatch = q.match(/^(.+?)\s+(\d.*)$/);
  const bookPrefix = refMatch?.[1]?.trim() ?? "";

  let best: BookSuggestion | null = null;

  for (let i = 0; i < data.books.length; i++) {
    const book = data.books[i]!;
    const nameLower = book.name.toLowerCase();
    const dFull = levenshtein(q, nameLower);
    const dFirst = levenshtein(firstWord, nameLower);
    const dPrefix =
      bookPrefix.length > 0 ? levenshtein(bookPrefix, nameLower) : Number.POSITIVE_INFINITY;
    const d = Math.min(dFull, dFirst, dPrefix);
    if (d > MAX_FUZZY_BOOK_DISTANCE) continue;
    if (best && d >= best.distance) continue;

    const correctedQuery =
      refMatch && refMatch[2] != null
        ? `${nameLower} ${refMatch[2]}`.replace(/\s+/g, " ").trim()
        : firstWord.length < q.length
          ? nameLower + q.slice(firstWord.length)
          : nameLower;
    best = {
      bookName: book.name,
      distance: d,
      correctedQuery,
    };
  }

  return best;
}
