export function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function endOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

export function journalEntryMatchesDateRange(
  createdAtIso: string,
  dateFrom: Date | null,
  dateTo: Date | null,
): boolean {
  if (dateFrom == null && dateTo == null) return true;
  const entryTime = new Date(createdAtIso).getTime();
  if (Number.isNaN(entryTime)) return false;
  if (dateFrom != null && entryTime < startOfLocalDay(dateFrom)) return false;
  if (dateTo != null && entryTime > endOfLocalDay(dateTo)) return false;
  return true;
}
