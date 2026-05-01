/** Allowed highlight colors in the reader */
export type HighlightColor = "yellow" | "blue" | "pink" | "green" | "purple";

/** A single verse highlight record */
export type Highlight = {
  id?: string;
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  created_at?: string;
};

/** Local (unsigned-in) highlight map: verseNumber -> HighlightColor */
export type LocalHighlightMap = Record<number, HighlightColor>;
