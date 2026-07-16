/** Entry id queued for reverse container-transform when returning from journal detail. */
let pendingReverseMorphEntryId: string | null = null;

export function requestJournalDetailReverseMorph(entryId: string): void {
  pendingReverseMorphEntryId = entryId;
}

export function takeJournalDetailReverseMorphEntryId(): string | null {
  const id = pendingReverseMorphEntryId;
  pendingReverseMorphEntryId = null;
  return id;
}
