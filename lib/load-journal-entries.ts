import { getLocalEntries, getLocalEntry } from "@/lib/journal-local";

export type MobileJournalListItem = {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation?: string | null;
  content: string;
  created_at: string;
  title?: string | null;
  is_favorite?: boolean;
};

function localToListItem(e: {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation?: string | null;
  content: string;
  created_at: string;
  title?: string | null;
  is_favorite?: boolean;
}): MobileJournalListItem {
  return {
    id: e.id,
    book: e.book,
    chapter: e.chapter,
    verse_start: e.verse_start,
    verse_end: e.verse_end,
    bible_translation: e.bible_translation ?? "KJV",
    content: e.content,
    created_at: e.created_at,
    title: e.title,
    is_favorite: e.is_favorite,
  };
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
