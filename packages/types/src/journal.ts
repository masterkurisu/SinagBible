/** A journal entry stored in Supabase */
export type JournalEntry = {
  id: string;
  user_id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  /** Bible translation id (KJV, WEB, OEB, ADB1905) frozen when the entry was saved. */
  bible_translation?: string | null;
  content: string;
  title?: string | null;
  is_favorite?: boolean;
  created_at: string;
  updated_at?: string | null;
  /** User-assigned category tokens (gratitude, forgiveness, …). */
  tags?: string[];
};

/** A journal entry stored locally in localStorage (prefixed with "local-") */
export type LocalJournalEntry = {
  id: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  /** Bible translation id frozen when the entry was saved. */
  bible_translation?: string | null;
  content: string;
  /** Markdown source for the reflection editor; HTML lives in `content`. */
  content_markdown?: string | null;
  /** `'enriched-html'` after a real Enriched edit; omitted/null otherwise. */
  content_format?: string | null;
  /** Composite `enriched-html@<pin>+md<converterRev>` on real Enriched edits only. */
  editor_version?: string | null;
  created_at: string;
  title?: string | null;
  is_favorite?: boolean;
  /** User-assigned category tokens (gratitude, forgiveness, …). */
  tags?: string[];
};

/** Union of both entry types for list rendering */
export type AnyJournalEntry = JournalEntry | LocalJournalEntry;
