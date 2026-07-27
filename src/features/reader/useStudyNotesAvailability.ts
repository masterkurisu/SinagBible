import { useEffect, useState } from "react";
import {
  fetchCommentaryChapterEntries,
  hasStudyNotesForVerses,
  isCommentaryRequestAborted,
  readSelectedCommentaryId,
} from "@/lib/commentary-api";

type StudyNotesAvailability = {
  /** True when selected verses have commentary entries; false when none or unavailable. */
  hasStudyNotes: boolean;
  /** True while checking commentary for the current selection. */
  isChecking: boolean;
};

export function useStudyNotesAvailability(
  bookSlug: string | undefined,
  chapterNumber: number,
  selectedVerses: number[],
): StudyNotesAvailability {
  const [hasStudyNotes, setHasStudyNotes] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const selectedVersesKey = selectedVerses.join(",");

  useEffect(() => {
    if (!bookSlug || selectedVerses.length === 0) {
      setHasStudyNotes(false);
      setIsChecking(false);
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;
    setIsChecking(true);

    void (async () => {
      try {
        const commentaryId = await readSelectedCommentaryId();
        if (isCommentaryRequestAborted(cancelled, abortController.signal)) return;

        const entries = await fetchCommentaryChapterEntries(
          commentaryId,
          bookSlug,
          chapterNumber,
          abortController.signal,
        );
        if (isCommentaryRequestAborted(cancelled, abortController.signal)) return;

        setHasStudyNotes(hasStudyNotesForVerses(entries, selectedVerses));
      } catch {
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setHasStudyNotes(false);
        }
      } finally {
        if (!isCommentaryRequestAborted(cancelled, abortController.signal)) {
          setIsChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [bookSlug, chapterNumber, selectedVersesKey, selectedVerses]);

  return { hasStudyNotes, isChecking };
}
