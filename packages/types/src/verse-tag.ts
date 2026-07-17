export type VerseTagRef = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  translation?: string;
};

export type VerseTagTextSegment =
  | { kind: "text"; value: string }
  | { kind: "tag"; raw: string; ref: VerseTagRef | null };
