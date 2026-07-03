import type { MobileJournalListItem } from "@/lib/load-journal-entries";

let pendingEdit: MobileJournalListItem | null = null;
let pendingDetail: MobileJournalListItem | null = null;

/** Call immediately before navigating to the edit screen so the sheet can skip reloading. */
export function setPendingJournalEditEntry(entry: MobileJournalListItem): void {
  pendingEdit = entry;
}

/** Read without clearing (Strict Mode may run the effect twice before we defer-clear). */
export function peekPendingJournalEditEntryFor(forId: string): MobileJournalListItem | null {
  if (!pendingEdit || pendingEdit.id !== forId) return null;
  return pendingEdit;
}

export function clearPendingJournalEditEntry(): void {
  pendingEdit = null;
}

/** Call after a successful edit save, before navigating back to the detail screen. */
export function setPendingJournalDetailEntry(entry: MobileJournalListItem): void {
  pendingDetail = entry;
}

/** Read without clearing (Strict Mode may run the effect twice before we defer-clear). */
export function peekPendingJournalDetailEntryFor(forId: string): MobileJournalListItem | null {
  if (!pendingDetail || pendingDetail.id !== forId) return null;
  return pendingDetail;
}

export function clearPendingJournalDetailEntry(): void {
  pendingDetail = null;
}
