/** A per-verse inline note (scoped by Bible translation, e.g. KJV vs ADB1905) */
export type VerseNote = {
  id?: string;
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  /** Translation id matching the reader (KJV, WEB, OEB, ADB1905, …) */
  translation: string;
  content: string;
  created_at?: string;
  updated_at?: string;
};
