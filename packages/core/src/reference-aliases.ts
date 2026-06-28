const ORDINAL_WORD_TO_DIGIT: Record<string, string> = {
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
};

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

  // Common book abbreviations at query start.
  s = s.replace(/^prov\b/, "proverbs");
  s = s.replace(/^eccl\b/, "ecclesiastes");
  s = s.replace(/^phil\b/, "philippians");
  s = s.replace(/^gen\b/, "genesis");
  s = s.replace(/^ex\b/, "exodus");
  s = s.replace(/^deut\b/, "deuteronomy");
  s = s.replace(/^rev\b/, "revelation");
  s = s.replace(/^matt\b/, "matthew");

  // "Psalm 23" → "Psalms 23" (KJV/WEB plural title).
  s = s.replace(/^psalm(\s+\d)/, "psalms$1");

  // Alternate Song of Solomon title.
  s = s.replace(/^song\s+of\s+songs(\s+\d)/, "song of solomon$1");

  return s.replace(/\s+/g, " ").trim();
}
