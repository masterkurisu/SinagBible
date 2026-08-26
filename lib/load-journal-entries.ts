import { getCachedLocalEntries, getLocalEntries, getLocalEntry } from "@/lib/journal-local";

export type MobileJournalListItem = {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation?: string | null;
  content: string;
  content_markdown?: string | null;
  created_at: string;
  title?: string | null;
  is_favorite?: boolean;
  tags?: string[];
};

function localToListItem(e: {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation?: string | null;
  content: string;
  content_markdown?: string | null;
  created_at: string;
  title?: string | null;
  is_favorite?: boolean;
  tags?: string[];
}): MobileJournalListItem {
  return {
    id: e.id,
    book: e.book,
    chapter: e.chapter,
    verse_start: e.verse_start,
    verse_end: e.verse_end,
    bible_translation: e.bible_translation ?? "KJV",
    content: typeof e.content === "string" ? e.content : "",
    content_markdown: e.content_markdown ?? null,
    created_at: e.created_at,
    title: e.title,
    is_favorite: e.is_favorite,
    tags: e.tags ?? [],
  };
}

export function toMobileJournalListItem(
  e: Parameters<typeof localToListItem>[0],
): MobileJournalListItem {
  return localToListItem(e);
}

export function getCachedJournalEntryById(id: string): MobileJournalListItem | null {
  const local = getCachedLocalEntries().find((e) => e.id === id);
  if (!local) return null;
  return localToListItem(local);
}

/** Newest-first list from AsyncStorage. */
export async function loadJournalListItems(): Promise<MobileJournalListItem[]> {
  const localRaw = await getLocalEntries();
  const items = localRaw.map(localToListItem);
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return items;
}

export async function loadJournalEntryById(id: string): Promise<MobileJournalListItem | null> {
  const local = await getLocalEntry(id);
  if (!local) return null;
  return localToListItem(local);
}
