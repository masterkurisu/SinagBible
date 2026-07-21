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
import { isChapterDbOpen } from "@/lib/chapter-db";
import { getChapterSync, putChapter, upsertTranslationMeta } from "@/lib/chapter-store";
import { yvpPassageToBibleChapter } from "@/lib/yvp-chapter-payload";

const YVP_API_BASE_URL = "https://api.youversion.com/v1";
const YVP_API_TIMEOUT_MS = 12_000;
const YVP_FETCH_MAX_RETRIES = 4;
const YVP_FETCH_RETRY_BASE_MS = 1_000;

class YvpHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(status: number, pathname: string, retryAfterMs?: number) {
    super(`youversion-api: HTTP ${status} — ${pathname}`);
    this.name = "YvpHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}
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
  copyright?: string;
  promotional_content?: string;
  info?: string;
  publisher_url?: string;
};

type YvpBookRecord = {
  id: string;
  title: string;
  chapters?: { id: string }[];
};

const yvpBiblesCache = new Map<string, Promise<YvpBible[]>>();
const yvpBookNavCache = new Map<number, Promise<BibleBookNavItem[]>>();
const yvpChapterInflight = new Map<string, Promise<BibleChapter>>();
const yvpMetaUpserted = new Set<number>();

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

/**
 * Curated language ranges for the translation picker (parallel fetch per range).
 * Ilocano (`ilo`) is omitted — YVP returns HTTP 204 with no catalog entries; use helloao `ilo_ulb`.
 */
const YVP_PICKER_LANGUAGE_RANGES = ["en", "fil", "tl", "ceb", "es"] as const;

function getExpoExtra(): { yvpAppKey?: string } | undefined {
  return (
    Constants.expoConfig?.extra ??
    (Constants.manifest2 as { extra?: { yvpAppKey?: string } } | null)?.extra ??
    (Constants.manifest as { extra?: { yvpAppKey?: string } } | null)?.extra
  );
}

function getYvpAppKeyOrNull(): string | null {
  const key =
    getExpoExtra()?.yvpAppKey ??
    process.env.EXPO_PUBLIC_YVP_APP_KEY ??
    process.env.YVP_APP_KEY;
  return key?.trim() || null;
}

let yvpNotConfiguredWarningLogged = false;

function warnYvpNotConfiguredOnce(): void {
  if (!__DEV__ || yvpNotConfiguredWarningLogged) return;
  yvpNotConfiguredWarningLogged = true;
  console.warn(
    "[youversion-api] YVP_APP_KEY is not configured — add it to .env.local (see app.config.js). YouVersion translations are unavailable until then.",
  );
}

function getYvpAppKey(): string {
  const key = getYvpAppKeyOrNull();
  if (!key) {
    throw new Error("youversion-api: YVP_APP_KEY is not configured");
  }
  return key;
}

/** True when a YouVersion Platform app key is available at runtime. */
export function isYvpApiConfigured(): boolean {
  return getYvpAppKeyOrNull() != null;
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

function parseRetryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1_000;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function yvpFetch<T>(path: string, searchParams?: Record<string, string>): Promise<T> {
  const url = new URL(`${YVP_API_BASE_URL}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  for (let attempt = 0; attempt <= YVP_FETCH_MAX_RETRIES; attempt++) {
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
        throw new YvpHttpError(res.status, url.pathname, parseRetryAfterMs(res));
      }
      // Some collection queries (e.g. language_ranges[]=ilo) return 204 with no body.
      const text = await res.text();
      if (!text.trim()) {
        return {} as T;
      }
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof YvpHttpError && error.status === 429 && attempt < YVP_FETCH_MAX_RETRIES) {
        const delayMs = error.retryAfterMs ?? YVP_FETCH_RETRY_BASE_MS * 2 ** attempt;
        await sleep(delayMs);
        continue;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`youversion-api: request timed out after ${YVP_API_TIMEOUT_MS}ms — ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`youversion-api: exhausted retries — ${path}`);
}

async function ensureYvpTranslationMeta(bibleId: number): Promise<void> {
  if (!isChapterDbOpen() || yvpMetaUpserted.has(bibleId)) return;

  try {
    const detail = await yvpFetch<YvpBibleDetail>(`/bibles/${bibleId}`);
    upsertTranslationMeta({
      translationId: formatYvpTranslationId(bibleId),
      copyrightNotice: detail.copyright ?? null,
      trademarkNotice: detail.promotional_content ?? detail.info ?? null,
      contentVersion: String(bibleId),
    });
    yvpMetaUpserted.add(bibleId);
  } catch {
    /* meta fetch is best-effort — chapter text can still render */
  }
}

/**
 * Fetches YouVersion Bibles for picker languages (English, Filipino, Tagalog, …).
 * Result is cached for the app session.
 */
export function fetchYvpBibles(): Promise<YvpBible[]> {
  if (!isYvpApiConfigured()) {
    return Promise.resolve([]);
  }

  const cacheKey = "picker";
  const cached = yvpBiblesCache.get(cacheKey);
  if (cached) return cached;

  const p = (async () => {
    const results = await Promise.allSettled(
      YVP_PICKER_LANGUAGE_RANGES.map((range) => fetchYvpBiblesForLanguageRange(range)),
    );
    const byId = new Map<number, YvpBible>();
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const bible of result.value) {
          byId.set(bible.id, bible);
        }
        continue;
      }
      if (__DEV__) {
        console.warn("[fetchYvpBibles] language range failed:", result.reason);
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
  if (!isYvpApiConfigured()) {
    warnYvpNotConfiguredOnce();
    return Promise.resolve([]);
  }

  const cached = yvpBookNavCache.get(bibleId);
  if (cached) return cached;

  const p = (async () => {
    void ensureYvpTranslationMeta(bibleId);

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
  if (!isYvpApiConfigured()) {
    warnYvpNotConfiguredOnce();
    throw new Error("youversion-api: YVP_APP_KEY is not configured");
  }

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
  if (!isYvpApiConfigured()) {
    warnYvpNotConfiguredOnce();
    return Promise.reject(new Error("youversion-api: YVP_APP_KEY is not configured"));
  }

  const usfm = getUsfmBookId(bookSlug);
  if (!usfm) {
    return Promise.reject(new Error(`youversion-api: unknown book slug "${bookSlug}"`));
  }

  const translationId = formatYvpTranslationId(bibleId);
  const dedupKey = `${translationId}:${bookSlug}:${chapterNumber}`;

  if (isChapterDbOpen()) {
    const stored = getChapterSync(translationId, bookSlug, chapterNumber);
    if (stored?.source === "yvp") {
      return Promise.resolve(
        yvpPassageToBibleChapter(bookSlug, chapterNumber, stored.payload as YvpPassage),
      );
    }
  }

  const inflight = yvpChapterInflight.get(dedupKey);
  if (inflight) return inflight;

  const p = (async () => {
    void ensureYvpTranslationMeta(bibleId);

    const passageId = buildChapterPassageId(usfm, chapterNumber);
    const raw = await yvpFetch<YvpPassage>(
      `/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}`,
      {
        format: "html",
        include_notes: "true",
        include_headings: "true",
      },
    );

    if (isChapterDbOpen()) {
      try {
        putChapter({
          translationId,
          bookSlug,
          chapterNumber,
          source: "yvp",
          payload: raw,
        });
      } catch {
        /* ignore store write errors */
      }
    }

    let bookName: string | undefined;
    try {
      const bookNav = await fetchYvpBookNav(bibleId);
      bookName = bookNav.find((book) => book.slug === bookSlug)?.name;
    } catch {
      /* optional */
    }

    return yvpPassageToBibleChapter(bookSlug, chapterNumber, raw, bookName);
  })();

  yvpChapterInflight.set(dedupKey, p);
  void p.finally(() => yvpChapterInflight.delete(dedupKey));
  void p.catch(() => {
    /* handled by caller */
  });

  return p;
}

/** Clears session-level YVP fetch caches (delete-my-data / debug). */
export function clearYvpMemoryCaches(): void {
  yvpBiblesCache.clear();
  yvpBookNavCache.clear();
  yvpChapterInflight.clear();
  yvpMetaUpserted.clear();
}
