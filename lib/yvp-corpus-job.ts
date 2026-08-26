import { AppState, InteractionManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { isChapterDbOpen } from "@/lib/chapter-db";
import {
  countStoredYvpChapters,
  getChapterSync,
  getStoreFlag,
  listStoredYvpChapterKeys,
  setStoreFlag,
} from "@/lib/chapter-store";
import { isOnWifi } from "@/lib/network-connectivity";
import {
  indexYvpStoredChapter,
  listPersistedYvpIndexedChapterKeys,
} from "@/lib/yvp-keyword-index";
import {
  missingYvpCorpusChapters,
  shouldRunYvpCorpusJob,
  storedChaptersMissingFromIndex,
  yvpCorpusChapterKey,
  yvpCorpusCompleteFlagKey,
} from "@/lib/yvp-corpus-policy";
import {
  fetchYvpBookNav,
  fetchYvpChapter,
  isYvpApiConfigured,
  isYvpTranslationId,
  parseYvpBibleId,
} from "@/lib/youversion-api";

const INDEX_BATCH_PER_TICK = 15;
const FETCH_DELAY_MS = 200;
const BACKOFF_MS = 5_000;

let targetTranslationId: string | null = null;
let tickInflight: Promise<void> | null = null;
let listenersInstalled = false;
let backoffUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freeDiskBytes(): Promise<number | null> {
  try {
    const fs = await import("expo-file-system/legacy");
    const getFree = (fs as { getFreeDiskStorageAsync?: () => Promise<number> }).getFreeDiskStorageAsync;
    if (typeof getFree !== "function") return null;
    const bytes = await getFree();
    return Number.isFinite(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

function isAppActive(): boolean {
  return AppState.currentState === "active";
}

function storedKeySet(
  rows: readonly { bookSlug: string; chapterNumber: number }[],
): Set<string> {
  return new Set(rows.map((row) => yvpCorpusChapterKey(row.bookSlug, row.chapterNumber)));
}

async function runTick(translationId: string): Promise<"paused" | "complete" | "progress"> {
  if (!isChapterDbOpen()) return "paused";
  if (!isAppActive()) return "paused";

  const bibleId = parseYvpBibleId(translationId);
  if (bibleId == null) return "paused";

  let stored: { bookSlug: string; chapterNumber: number }[] = [];
  try {
    stored = listStoredYvpChapterKeys(translationId);
    const indexed = storedKeySet(listPersistedYvpIndexedChapterKeys(translationId));
    const unindexed = storedChaptersMissingFromIndex(stored, indexed);
    if (unindexed.length > 0) {
      const batch = unindexed.slice(0, INDEX_BATCH_PER_TICK);
      for (const item of batch) {
        try {
          const chapter = getChapterSync(translationId, item.bookSlug, item.chapterNumber);
          if (chapter) indexYvpStoredChapter(chapter);
        } catch {
          /* skip */
        }
      }
      return "progress";
    }
  } catch {
    return "paused";
  }

  let complete = false;
  let storedYvpChapterCount = 0;
  try {
    complete = getStoreFlag(yvpCorpusCompleteFlagKey(translationId)) === "1";
    storedYvpChapterCount = countStoredYvpChapters();
  } catch {
    return "paused";
  }

  const gate = shouldRunYvpCorpusJob({
    wifi: await isOnWifi(),
    appActive: true,
    apiConfigured: isYvpApiConfigured(),
    complete,
    freeDiskBytes: await freeDiskBytes(),
    storedYvpChapterCount,
  });
  if (!gate.ok) return gate.reason === "complete" ? "complete" : "paused";

  const nav = await fetchYvpBookNav(bibleId);
  const missing = missingYvpCorpusChapters(nav, storedKeySet(stored));
  if (missing.length === 0) {
    try {
      setStoreFlag(yvpCorpusCompleteFlagKey(translationId), "1");
    } catch {
      /* ignore */
    }
    return "complete";
  }

  if (Date.now() < backoffUntil) return "paused";

  const next = missing[0]!;
  try {
    await fetchYvpChapter(bibleId, next.bookSlug, next.chapterNumber);
  } catch {
    backoffUntil = Date.now() + BACKOFF_MS;
    return "paused";
  }

  return "progress";
}

function queueTick(): void {
  if (tickInflight || !targetTranslationId) return;
  const translationId = targetTranslationId;
  tickInflight = (async () => {
    let result: "paused" | "complete" | "progress" = "paused";
    try {
      result = await runTick(translationId);
      if (result === "progress") await sleep(FETCH_DELAY_MS);
    } catch {
      /* best-effort background job */
    }
    tickInflight = null;
    if (result === "progress" && targetTranslationId === translationId && isAppActive()) {
      queueTick();
    }
  })();
}

function ensureListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;
  AppState.addEventListener("change", (state) => {
    if (state === "active") queueTick();
  });
  NetInfo.addEventListener((state) => {
    if (state.type === "wifi") queueTick();
  });
}

/**
 * Background fill of missing YVP chapters for native search.
 * Wi-Fi + app-active + disk budget; resumes from already-stored chapters.
 * Does not assemble an in-memory search corpus and is not used by overlay query.
 */
export function scheduleYvpSearchCorpusJob(translationId: string): void {
  const trimmed = translationId.trim();
  if (!isYvpTranslationId(trimmed)) return;
  targetTranslationId = trimmed;
  ensureListeners();
  InteractionManager.runAfterInteractions(() => {
    queueTick();
  });
}

export function pauseYvpSearchCorpusJob(): void {
  targetTranslationId = null;
}

/** Test helper — last scheduled translation id. */
export function peekYvpCorpusJobTargetForTests(): string | null {
  return targetTranslationId;
}
