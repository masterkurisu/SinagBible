/**
 * YouVersion Platform API (https://api.youversion.com/v1).
 *
 * Authenticate every request with the `X-YVP-App-Key` header.
 * Set `YVP_APP_KEY` in `.env.local` (see `app.config.js`).
 */
import { getBookSlugFromUsfm, getUsfmBookId } from "@sinag-bible/core/bible-meta";
import { getBookNavForTranslation } from "@sinag-bible/core/bible-translations";
import type { BibleBookNavItem, BibleChapter } from "@sinag-bible/types";
import Constants from "expo-constants";

const YVP_API_BASE_URL = "https://api.youversion.com/v1";
const YVP_API_TIMEOUT_MS = 12_000;
export const YVP_TRANSLATION_ID_PREFIX = "yvp:";

/** A scripture passage returned by `GET /bibles/{id}/passages/{passage_id}`. */
export type YvpPassage = {
  id: string;
  content: string;
  reference: string;
};

export type YvpBible = {
  id: number;
  abbreviation: string;
  localizedAbbreviation?: string;
  title: string;
  localizedTitle?: string;
  languageTag: string;
};

export type FetchYvpPassageOptions = {
  /** YouVersion Bible version id (e.g. 3034 for Berean Standard Bible). */
  bibleId: number;
  /** USFM book code (e.g. `JHN`) or reader slug (e.g. `john`). */
  book: string;
  chapter: number;
  verse: number;
  format?: "text" | "html";
};

type YvpBibleRecord = {
  id: number;
  abbreviation: string;
  localized_abbreviation?: string;
  title: string;
  localized_title?: string;
  language_tag: string;
};

type YvpBiblesPage = {
  data: YvpBibleRecord[];
  next_page_token?: string;
};

type YvpBibleDetail = {
  id: number;
  books: string[];
};

type YvpBookRecord = {
  id: string;
  title: string;
  chapters?: { id: string }[];
};

const yvpBiblesCache = new Map<string, Promise<YvpBible[]>>();
const yvpBookNavCache = new Map<number, Promise<BibleBookNavItem[]>>();
const yvpChapterCache = new Map<string, Promise<BibleChapter>>();

export function isYvpTranslationId(translationId: string): boolean {
  return translationId.startsWith(YVP_TRANSLATION_ID_PREFIX);
}

export function formatYvpTranslationId(bibleId: number): string {
  return `${YVP_TRANSLATION_ID_PREFIX}${bibleId}`;
}

export function parseYvpBibleId(translationId: string): number | null {
  if (!isYvpTranslationId(translationId)) return null;
  const parsed = Number.parseInt(translationId.slice(YVP_TRANSLATION_ID_PREFIX.length), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Curated language ranges for the translation picker (fast parallel fetch). */
const YVP_PICKER_LANGUAGE_RANGES = ["en", "fil", "tl", "ceb", "es"] as const;

function getYvpAppKey(): string {
  const key =
    (Constants.expoConfig?.extra as { yvpAppKey?: string } | undefined)?.yvpAppKey ??
    process.env.EXPO_PUBLIC_YVP_APP_KEY ??
    process.env.YVP_APP_KEY;
  if (!key) {
    throw new Error("youversion-api: YVP_APP_KEY is not configured");
  }
  return key;
}

function mapYvpBible(record: YvpBibleRecord): YvpBible {
  return {
    id: record.id,
    abbreviation: record.abbreviation,
    localizedAbbreviation: record.localized_abbreviation,
    title: record.title,
    localizedTitle: record.localized_title,
    languageTag: record.language_tag,
  };
}

function resolveBookUsfm(book: string): string {
  const trimmed = book.trim();
  if (/^([1-3])?[A-Za-z]{2,3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const slug = trimmed.toLowerCase().replace(/\s+/g, "-");
  const usfm = getUsfmBookId(slug);
  if (!usfm) {
    throw new Error(`youversion-api: unknown book "${book}"`);
  }
  return usfm;
}

function buildPassageId(bookUsfm: string, chapter: number, verse: number): string {
  if (!Number.isInteger(chapter) || chapter < 1) {
    throw new Error(`youversion-api: invalid chapter ${chapter}`);
  }
  if (!Number.isInteger(verse) || verse < 1) {
    throw new Error(`youversion-api: invalid verse ${verse}`);
  }
  return `${bookUsfm}.${chapter}.${verse}`;
}

function buildChapterPassageId(bookUsfm: string, chapter: number): string {
  if (!Number.isInteger(chapter) || chapter < 1) {
    throw new Error(`youversion-api: invalid chapter ${chapter}`);
  }
  return `${bookUsfm}.${chapter}`;
}

async function yvpFetch<T>(path: string, searchParams?: Record<string, string>): Promise<T> {
  const url = new URL(`${YVP_API_BASE_URL}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), YVP_API_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "X-YVP-App-Key": getYvpAppKey(),
      },
    });
    if (!res.ok) {
      throw new Error(`youversion-api: HTTP ${res.status} — ${url.pathname}`);
    }
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`youversion-api: request timed out after ${YVP_API_TIMEOUT_MS}ms — ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYvpChapterHtml(html: string): { number: number; text: string }[] {
  const verses: { number: number; text: string }[] = [];
  const parts = html.split(/<span class="yv-vlbl">(\d+)<\/span>/);
  for (let i = 1; i < parts.length; i += 2) {
    const num = Number.parseInt(parts[i] ?? "", 10);
    const raw = parts[i + 1] ?? "";
    const text = stripHtmlTags(raw);
    if (num > 0 && text) {
      verses.push({ number: num, text });
    }
  }
  return verses;
}

/**
 * Fetches YouVersion Bibles for picker languages (English, Filipino, Tagalog, …).
 * Result is cached for the app session.
 */
export function fetchYvpBibles(): Promise<YvpBible[]> {
  const cacheKey = "picker";
  const cached = yvpBiblesCache.get(cacheKey);
  if (cached) return cached;

  const p = (async () => {
    const pages = await Promise.all(
      YVP_PICKER_LANGUAGE_RANGES.map((range) => fetchYvpBiblesForLanguageRange(range)),
    );
    const byId = new Map<number, YvpBible>();
    for (const bibles of pages) {
      for (const bible of bibles) {
        byId.set(bible.id, bible);
      }
    }
    return [...byId.values()];
  })();

  yvpBiblesCache.set(cacheKey, p);
  void p.catch(() => yvpBiblesCache.delete(cacheKey));
  return p;
}

async function fetchYvpBiblesForLanguageRange(range: string): Promise<YvpBible[]> {
  const all: YvpBible[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      "language_ranges[]": range,
      all_available: "true",
      page_size: "99",
    };
    if (pageToken) params.page_token = pageToken;

    const page = await yvpFetch<YvpBiblesPage>("/bibles", params);
    const records = Array.isArray(page?.data) ? page.data : [];
    all.push(...records.map(mapYvpBible));
    pageToken = page.next_page_token;
  } while (pageToken);

  return all;
}

/** Reader book navigation for a YouVersion Bible id. */
export function fetchYvpBookNav(bibleId: number): Promise<BibleBookNavItem[]> {
  const cached = yvpBookNavCache.get(bibleId);
  if (cached) return cached;

  const p = (async () => {
    const [bible, kjvNav] = await Promise.all([
      yvpFetch<YvpBibleDetail>(`/bibles/${bibleId}`),
      getBookNavForTranslation("KJV"),
    ]);
    const bookSet = new Set(bible.books ?? []);
    const navFromKjv = kjvNav.filter((item) => {
      const usfm = getUsfmBookId(item.slug);
      return usfm != null && bookSet.has(usfm);
    });

    if (navFromKjv.length === bookSet.size) {
      return navFromKjv;
    }

    const knownUsfm = new Set(
      navFromKjv
        .map((item) => getUsfmBookId(item.slug))
        .filter((usfm): usfm is string => usfm != null),
    );
    const extraUsfm = [...bookSet].filter((usfm) => !knownUsfm.has(usfm));
    const extraNav = await Promise.all(
      extraUsfm.map(async (usfm) => {
        const slug = getBookSlugFromUsfm(usfm);
        if (!slug) return null;
        const book = await yvpFetch<YvpBookRecord>(`/bibles/${bibleId}/books/${usfm}`);
        return {
          name: book.title,
          slug,
          chapterCount: book.chapters?.length ?? 0,
        } satisfies BibleBookNavItem;
      }),
    );

    return [...navFromKjv, ...extraNav.filter((item): item is BibleBookNavItem => item != null)];
  })();

  yvpBookNavCache.set(bibleId, p);
  void p.catch(() => yvpBookNavCache.delete(bibleId));
  return p;
}

/**
 * Fetches a single verse passage from the YouVersion Platform API.
 *
 * @example
 * await fetchYvpPassage({ bibleId: 3034, book: "john", chapter: 3, verse: 16 });
 */
export async function fetchYvpPassage(options: FetchYvpPassageOptions): Promise<YvpPassage> {
  const bookUsfm = resolveBookUsfm(options.book);
  const passageId = buildPassageId(bookUsfm, options.chapter, options.verse);
  const format = options.format ?? "text";

  const raw = await yvpFetch<YvpPassage>(
    `/bibles/${options.bibleId}/passages/${encodeURIComponent(passageId)}`,
    { format },
  );

  if (typeof raw?.content !== "string" || typeof raw?.id !== "string") {
    throw new Error(`youversion-api: malformed passage payload for ${passageId}`);
  }

  return {
    id: raw.id,
    content: raw.content,
    reference: typeof raw.reference === "string" ? raw.reference : passageId,
  };
}

/** Fetches a full chapter for the reader via the YouVersion passages endpoint. */
export function fetchYvpChapter(
  bibleId: number,
  bookSlug: string,
  chapterNumber: number,
): Promise<BibleChapter> {
  const usfm = getUsfmBookId(bookSlug);
  if (!usfm) {
    return Promise.reject(new Error(`youversion-api: unknown book slug "${bookSlug}"`));
  }

  const cacheKey = `${bibleId}:${usfm}:${chapterNumber}`;
  const inflight = yvpChapterCache.get(cacheKey);
  if (inflight) return inflight;

  const p = (async () => {
    const passageId = buildChapterPassageId(usfm, chapterNumber);
    const raw = await yvpFetch<YvpPassage>(
      `/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}`,
      { format: "html" },
    );

    const verses = parseYvpChapterHtml(raw.content ?? "");
    if (verses.length === 0) {
      throw new Error(`youversion-api: no verses parsed for ${passageId}`);
    }

    const bookNav = await fetchYvpBookNav(bibleId);
    const bookName = bookNav.find((book) => book.slug === bookSlug)?.name ?? usfm;

    return {
      bookName,
      bookSlug,
      chapterNumber,
      verses: verses.map((verse) => verse.text),
    };
  })();

  yvpChapterCache.set(cacheKey, p);
  void p.catch(() => yvpChapterCache.delete(cacheKey));
  return p;
}
