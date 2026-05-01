/** Decode common HTML entities for plain-text previews (`&amp;` last). */
export function decodeBasicHtmlEntities(input: string): string {
  return input
    .replace(/&#x0*A0;/gi, " ")
    .replace(/&#0*160;/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Strip HTML to a short plain-text preview (matches web `stripHtmlPreview`). */
export function stripHtmlPreview(html: string, maxLength: number): string {
  if (!html || typeof html !== "string") return "";
  const stripped = html.replace(/<[^>]*>/g, " ");
  const text = decodeBasicHtmlEntities(stripped).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

export function stripHtmlToPlain(html: string): string {
  if (!html) return "";
  const stripped = html.replace(/<[^>]*>/g, "\n");
  return decodeBasicHtmlEntities(stripped).replace(/\n+/g, "\n").trim();
}
