/** Protestant canon is 1,189 chapters; cap stored YVP rows so a fill cannot unbounded-grow. */
export const YVP_CORPUS_MAX_STORED_CHAPTERS = 2_000;
/** Pause the background fill when free disk is below this (when measurable). */
export const YVP_CORPUS_MIN_FREE_DISK_BYTES = 250 * 1024 * 1024;

export type YvpCorpusChapterRef = {
  bookSlug: string;
  chapterNumber: number;
};

export type YvpCorpusNavItem = {
  slug: string;
  chapterCount: number;
};

export function yvpCorpusChapterKey(bookSlug: string, chapterNumber: number): string {
  return `${bookSlug}:${chapterNumber}`;
}

export function yvpCorpusCompleteFlagKey(translationId: string): string {
  return `yvp_search_corpus_complete:${translationId}`;
}

export function missingYvpCorpusChapters(
  nav: readonly YvpCorpusNavItem[],
  storedKeys: ReadonlySet<string>,
): YvpCorpusChapterRef[] {
  const missing: YvpCorpusChapterRef[] = [];
  for (const item of nav) {
    const count = Math.max(0, Math.floor(item.chapterCount));
    for (let chapterNumber = 1; chapterNumber <= count; chapterNumber++) {
      if (storedKeys.has(yvpCorpusChapterKey(item.slug, chapterNumber))) continue;
      missing.push({ bookSlug: item.slug, chapterNumber });
    }
  }
  return missing;
}

export function storedChaptersMissingFromIndex(
  stored: readonly YvpCorpusChapterRef[],
  indexedKeys: ReadonlySet<string>,
): YvpCorpusChapterRef[] {
  return stored.filter(
    (row) => !indexedKeys.has(yvpCorpusChapterKey(row.bookSlug, row.chapterNumber)),
  );
}

export type YvpCorpusJobGateInput = {
  wifi: boolean;
  appActive: boolean;
  apiConfigured: boolean;
  complete: boolean;
  freeDiskBytes: number | null;
  storedYvpChapterCount: number;
};

export type YvpCorpusJobGateResult =
  | { ok: true }
  | { ok: false; reason: "wifi" | "inactive" | "api" | "complete" | "disk" | "storage" };

export function shouldRunYvpCorpusJob(input: YvpCorpusJobGateInput): YvpCorpusJobGateResult {
  if (input.complete) return { ok: false, reason: "complete" };
  if (!input.apiConfigured) return { ok: false, reason: "api" };
  if (!input.appActive) return { ok: false, reason: "inactive" };
  if (!input.wifi) return { ok: false, reason: "wifi" };
  if (input.freeDiskBytes != null && input.freeDiskBytes < YVP_CORPUS_MIN_FREE_DISK_BYTES) {
    return { ok: false, reason: "disk" };
  }
  if (input.storedYvpChapterCount >= YVP_CORPUS_MAX_STORED_CHAPTERS) {
    return { ok: false, reason: "storage" };
  }
  return { ok: true };
}
