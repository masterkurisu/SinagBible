import { describe, expect, it } from "vitest";
import {
  missingYvpCorpusChapters,
  shouldRunYvpCorpusJob,
  storedChaptersMissingFromIndex,
  yvpCorpusChapterKey,
  yvpCorpusCompleteFlagKey,
  YVP_CORPUS_MAX_STORED_CHAPTERS,
  YVP_CORPUS_MIN_FREE_DISK_BYTES,
} from "@/lib/yvp-corpus-policy";

describe("yvp corpus policy", () => {
  it("lists nav chapters that are not already stored", () => {
    const stored = new Set([yvpCorpusChapterKey("john", 1), yvpCorpusChapterKey("john", 3)]);
    expect(
      missingYvpCorpusChapters(
        [
          { slug: "john", chapterCount: 3 },
          { slug: "romans", chapterCount: 1 },
        ],
        stored,
      ),
    ).toEqual([
      { bookSlug: "john", chapterNumber: 2 },
      { bookSlug: "romans", chapterNumber: 1 },
    ]);
  });

  it("finds stored chapters that still need indexing", () => {
    expect(
      storedChaptersMissingFromIndex(
        [
          { bookSlug: "john", chapterNumber: 1 },
          { bookSlug: "john", chapterNumber: 2 },
        ],
        new Set([yvpCorpusChapterKey("john", 1)]),
      ),
    ).toEqual([{ bookSlug: "john", chapterNumber: 2 }]);
  });

  it("requires wifi, an active app, and disk/storage headroom", () => {
    const ready = {
      wifi: true,
      appActive: true,
      apiConfigured: true,
      complete: false,
      freeDiskBytes: YVP_CORPUS_MIN_FREE_DISK_BYTES,
      storedYvpChapterCount: 10,
    };
    expect(shouldRunYvpCorpusJob(ready)).toEqual({ ok: true });
    expect(shouldRunYvpCorpusJob({ ...ready, wifi: false })).toEqual({ ok: false, reason: "wifi" });
    expect(shouldRunYvpCorpusJob({ ...ready, appActive: false })).toEqual({
      ok: false,
      reason: "inactive",
    });
    expect(shouldRunYvpCorpusJob({ ...ready, apiConfigured: false })).toEqual({
      ok: false,
      reason: "api",
    });
    expect(shouldRunYvpCorpusJob({ ...ready, complete: true })).toEqual({
      ok: false,
      reason: "complete",
    });
    expect(shouldRunYvpCorpusJob({ ...ready, freeDiskBytes: YVP_CORPUS_MIN_FREE_DISK_BYTES - 1 })).toEqual({
      ok: false,
      reason: "disk",
    });
    expect(shouldRunYvpCorpusJob({ ...ready, storedYvpChapterCount: YVP_CORPUS_MAX_STORED_CHAPTERS })).toEqual({
      ok: false,
      reason: "storage",
    });
    expect(shouldRunYvpCorpusJob({ ...ready, freeDiskBytes: null })).toEqual({ ok: true });
  });

  it("namespaces the resume/complete flag per translation", () => {
    expect(yvpCorpusCompleteFlagKey("yvp:111")).toBe("yvp_search_corpus_complete:yvp:111");
  });
});
