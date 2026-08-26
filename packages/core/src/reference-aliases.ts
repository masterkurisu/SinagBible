const ORDINAL_WORD_TO_DIGIT: Record<string, string> = {
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
};

/**
 * Unnumbered book shorts at query start. `mat` is intentionally absent so prefix
 * completion (`mat` → Matthew) stays in search scoring, not this table.
 */
const BOOK_ABBREVIATIONS: Record<string, string> = {
  gen: "genesis",
  exo: "exodus",
  ex: "exodus",
  lev: "leviticus",
  num: "numbers",
  deu: "deuteronomy",
  deut: "deuteronomy",
  jos: "joshua",
  josh: "joshua",
  jdg: "judges",
  judg: "judges",
  rut: "ruth",
  ezr: "ezra",
  neh: "nehemiah",
  est: "esther",
  ps: "psalms",
  psa: "psalms",
  pss: "psalms",
  pro: "proverbs",
  prov: "proverbs",
  ecc: "ecclesiastes",
  eccl: "ecclesiastes",
  isa: "isaiah",
  jer: "jeremiah",
  lam: "lamentations",
  ezk: "ezekiel",
  eze: "ezekiel",
  ezek: "ezekiel",
  dan: "daniel",
  hos: "hosea",
  jol: "joel",
  amo: "amos",
  oba: "obadiah",
  obad: "obadiah",
  jon: "jonah",
  mic: "micah",
  nah: "nahum",
  hab: "habakkuk",
  zep: "zephaniah",
  zeph: "zephaniah",
  hag: "haggai",
  zec: "zechariah",
  zech: "zechariah",
  mal: "malachi",
  mt: "matthew",
  matt: "matthew",
  mk: "mark",
  mrk: "mark",
  lk: "luke",
  luk: "luke",
  jn: "john",
  jhn: "john",
  act: "acts",
  rom: "romans",
  gal: "galatians",
  eph: "ephesians",
  php: "philippians",
  phil: "philippians",
  col: "colossians",
  tit: "titus",
  phm: "philemon",
  phlm: "philemon",
  heb: "hebrews",
  jas: "james",
  rev: "revelation",
};

/** Numbered-book shorts (`1jn`, `1 pe`, `2cor`). */
const NUMBERED_BOOK_ABBREVIATIONS: Record<string, string> = {
  sa: "samuel",
  sam: "samuel",
  ki: "kings",
  kg: "kings",
  kgs: "kings",
  ch: "chronicles",
  chr: "chronicles",
  co: "corinthians",
  cor: "corinthians",
  th: "thessalonians",
  thess: "thessalonians",
  ti: "timothy",
  tim: "timothy",
  pe: "peter",
  pet: "peter",
  pt: "peter",
  jn: "john",
  jhn: "john",
};

function spacerBeforeChapter(rest: string): string {
  return rest && !/^\s/.test(rest) && /^\d/.test(rest) ? " " : "";
}

function expandBookAbbreviation(s: string): string {
  const numbered = s.match(/^(\d+)\s*([a-z]+)(.*)$/);
  if (numbered) {
    const expanded = NUMBERED_BOOK_ABBREVIATIONS[numbered[2]!];
    if (expanded) {
      const rest = numbered[3] ?? "";
      return `${numbered[1]} ${expanded}${spacerBeforeChapter(rest)}${rest}`;
    }
  }

  const unnumbered = s.match(/^([a-z]+)(.*)$/);
  if (unnumbered) {
    const expanded = BOOK_ABBREVIATIONS[unnumbered[1]!];
    if (expanded) {
      const rest = unnumbered[2] ?? "";
      return `${expanded}${spacerBeforeChapter(rest)}${rest}`;
    }
  }

  return s;
}

/**
 * `john 3 16` / `John 3 16-18` → colon form. Requires a letter in the book
 * part so digit-only `316` / `23` and bookless `3 16` stay untouched.
 */
function normalizeSpaceSeparatedChapterVerse(s: string): string {
  const match = s.match(/^(.+[a-z].*)\s+(\d+)\s+(\d+)(?:-(\d+))?$/);
  if (!match) return s;

  const book = match[1]!.trim();
  if (!book || /^\d+$/.test(book)) return s;

  const verse = match[4] != null ? `${match[3]}-${match[4]}` : match[3];
  return `${book} ${match[2]}:${verse}`;
}

/**
 * Expand common reference shorthand before search (book names, ordinals, abbreviations).
 * Operates on a normalized lowercase query string.
 */
export function expandReferenceQuery(q: string): string {
  let s = q.trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return s;

  // Roman numeral book prefixes (longest first).
  s = s.replace(/^iii\s+/, "3 ");
  s = s.replace(/^ii\s+/, "2 ");
  s = s.replace(/^iv\s+/, "4 ");
  s = s.replace(/^vi\s+/, "6 ");
  s = s.replace(/^ix\s+/, "9 ");
  s = s.replace(/^viii\s+/, "8 ");
  s = s.replace(/^vii\s+/, "7 ");
  s = s.replace(/^v\s+/, "5 ");
  s = s.replace(/^i\s+/, "1 ");

  // 1st / 2nd / 3rd / 23rd → numeric prefix.
  s = s.replace(/^(\d+)(?:st|nd|rd|th)\s+/, "$1 ");

  // first / second / third → 1 / 2 / 3.
  s = s.replace(/^(first|second|third|fourth|fifth)\s+/, (match, word: string) => {
    const digit = ORDINAL_WORD_TO_DIGIT[word];
    return digit ? `${digit} ` : match;
  });

  // Saint abbreviations.
  s = s.replace(/^st\.?\s+john\b/, "john");
  s = s.replace(/^st\.?\s+matthew\b/, "matthew");
  s = s.replace(/^st\.?\s+mark\b/, "mark");
  s = s.replace(/^st\.?\s+luke\b/, "luke");
  s = s.replace(/^st\.?\s+paul\b/, "paul");

  s = expandBookAbbreviation(s);

  // "Psalm 23" → "Psalms 23" (KJV/WEB plural title). `ps` / `psa` already map above.
  s = s.replace(/^psalm(\s+\d)/, "psalms$1");

  // Alternate Song of Solomon title.
  s = s.replace(/^song\s+of\s+songs(\s+\d)/, "song of solomon$1");

  s = normalizeSpaceSeparatedChapterVerse(s);

  return s.replace(/\s+/g, " ").trim();
}
