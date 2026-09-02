import type { VerseTagRef } from "@sinag-bible/types";
import { isDeviceOffline } from "@/lib/network-connectivity";
import {
  getJournalVersePreview,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";
import type { VerseTagPreviewStatus } from "@/src/features/verse-tags/verseTagChipCopy";
import { clampVerseTagPreviewRange } from "@/src/features/verse-tags/verseTagPreviewLimits";

async function previewLooksOffline(): Promise<boolean> {
  try {
    return await isDeviceOffline();
  } catch {
    return false;
  }
}

/** Load tooltip verse text in the currently active translation. */
export async function loadVerseTagPreview(
  translationId: string,
  ref: VerseTagRef,
): Promise<Exclude<VerseTagPreviewStatus, { kind: "loading" }>> {
  try {
    const canonicalBook = await resolveJournalPassageBookSlug(translationId, ref.book);
    if (!canonicalBook) {
      return (await previewLooksOffline()) ? { kind: "offline" } : { kind: "not-found" };
    }
    const range = clampVerseTagPreviewRange(ref.verseStart, ref.verseEnd ?? null);
    const preview = await getJournalVersePreview(
      translationId,
      canonicalBook,
      ref.chapter,
      range.verseStart,
      range.verseEnd,
    );
    if (preview?.trim()) {
      return { kind: "ready", text: preview.trim(), truncated: range.truncated };
    }
    return (await previewLooksOffline()) ? { kind: "offline" } : { kind: "not-found" };
  } catch {
    return (await previewLooksOffline()) ? { kind: "offline" } : { kind: "error" };
  }
}
