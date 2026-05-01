import type { MobileJournalListItem } from "@/lib/load-journal-entries";

let pending: MobileJournalListItem | null = null;

/** Call immediately before navigating to the edit screen so the sheet can skip reloading. */
export function setPendingJournalEditEntry(entry: MobileJournalListItem): void {
  pending = entry;
}

/** Read without clearing (Strict Mode may run the effect twice before we defer-clear). */
export function peekPendingJournalEditEntryFor(forId: string): MobileJournalListItem | null {
  if (!pending || pending.id !== forId) return null;
  return pending;
}

export function clearPendingJournalEditEntry(): void {
  pending = null;
}
