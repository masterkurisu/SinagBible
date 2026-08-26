/**
 * Find a span in verse text to highlight for overlay search snippets.
 * Prefers the longest query token that is not digits-only (so `love` in `love`
 * and `anxious` can match; `John 3:16` highlights nothing unless a token appears).
 */
export function findSnippetHighlightRange(
  verseText: string,
  query: string,
): { start: number; end: number } | null {
  const text = verseText.trim();
  const raw = query.trim();
  if (!text || !raw) return null;

  const tokens = raw
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}']+/gu, ""))
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));
  const candidates = tokens.length > 0 ? tokens : [raw.replace(/[^\p{L}\p{N}']+/gu, "")];
  candidates.sort((a, b) => b.length - a.length);

  for (const token of candidates) {
    if (token.length < 2) continue;
    try {
      const escaped = escapeRegExp(token);
      const whole = new RegExp(`\\b${escaped}\\b`, "i");
      const wholeMatch = whole.exec(text);
      if (wholeMatch && wholeMatch.index >= 0) {
        return { start: wholeMatch.index, end: wholeMatch.index + wholeMatch[0].length };
      }
      const prefix = new RegExp(`\\b${escaped}\\p{L}*`, "iu");
      const prefixMatch = prefix.exec(text);
      if (prefixMatch && prefixMatch.index >= 0) {
        return { start: prefixMatch.index, end: prefixMatch.index + prefixMatch[0].length };
      }
    } catch {
      /* ignore invalid tokens */
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
