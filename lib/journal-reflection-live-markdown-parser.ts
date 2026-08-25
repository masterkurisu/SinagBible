import type { MarkdownRange } from "@expensify/react-native-live-markdown";

/**
 * Worklet parser for journal reflection markdown.
 *
 * The library's default `parseExpensiMark` understands `*bold*` (single asterisk),
 * not the app's GitHub-style `**bold**`, and has no list / checklist / `[image:id]`
 * types. This parser emits only the library's `MarkdownType` set:
 *
 * | App construct              | Emitted type                         |
 * |----------------------------|--------------------------------------|
 * | `**bold**`                 | `syntax` + `bold` + `syntax`         |
 * | `_italic_`                 | `syntax` + `italic` + `syntax`       |
 * | `# heading`                | `syntax` (`# `) + `h1` (rest)        |
 * | `## heading`               | `syntax` (`## `) + `bold` (rest)     |
 * | `- ` / `1. ` lists         | `syntax` on the prefix               |
 * | `- [ ] ` / `- [x] `        | `syntax` on the prefix               |
 * | `[label](url)`             | `link` on label; `syntax` on markup  |
 * | `[image:id]`               | `syntax` on the whole token          |
 *
 * Checklists and image tokens cannot live-render as widgets — only as dimmed
 * text. The live editor keeps that handling rather than expecting native
 * checkbox or inline-image types (those types exist for ExpensiMark, not for
 * `[image:id]`).
 */
export function parseReflectionLiveMarkdown(input: string): MarkdownRange[] {
  "worklet";

  const ranges: MarkdownRange[] = [];
  if (input.length === 0) return ranges;

  const isWs = (ch: string) => ch === " " || ch === "\t";

  const startsWith = (start: number, end: number, token: string) => {
    if (start + token.length > end) return false;
    for (let i = 0; i < token.length; i++) {
      if (input[start + i] !== token[i]) return false;
    }
    return true;
  };

  const indexOfDelim = (from: number, to: number, delim: string) => {
    const n = delim.length;
    for (let i = from; i <= to - n; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) {
        if (input[i + j] !== delim[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
    return -1;
  };

  const matchImageToken = (from: number, to: number) => {
    if (!startsWith(from, to, "[image:")) return -1;
    const close = indexOfDelim(from + 7, to, "]");
    if (close === -1) return -1;
    if (close === from + 7) return -1;
    return close + 1;
  };

  const matchLink = (from: number, to: number) => {
    if (input[from] !== "[") return null;
    let labelEnd = from + 1;
    while (labelEnd < to && input[labelEnd] !== "]" && input[labelEnd] !== "\n") {
      labelEnd += 1;
    }
    if (labelEnd >= to || input[labelEnd] !== "]") return null;
    if (labelEnd + 1 >= to || input[labelEnd + 1] !== "(") return null;
    let urlEnd = labelEnd + 2;
    if (urlEnd >= to) return null;
    while (
      urlEnd < to &&
      input[urlEnd] !== ")" &&
      input[urlEnd] !== "\n" &&
      input[urlEnd] !== " "
    ) {
      urlEnd += 1;
    }
    if (urlEnd >= to || input[urlEnd] !== ")") return null;
    if (urlEnd === labelEnd + 2) return null;
    return { labelStart: from + 1, labelEnd, end: urlEnd + 1 };
  };

  const parseInline = (from: number, to: number) => {
    let i = from;
    while (i < to) {
      if (input[i] === "[") {
        const imageEnd = matchImageToken(i, to);
        if (imageEnd !== -1) {
          ranges.push({ type: "syntax", start: i, length: imageEnd - i });
          i = imageEnd;
          continue;
        }
        const link = matchLink(i, to);
        if (link) {
          ranges.push({ type: "syntax", start: i, length: 1 });
          if (link.labelEnd > link.labelStart) {
            ranges.push({
              type: "link",
              start: link.labelStart,
              length: link.labelEnd - link.labelStart,
            });
            parseInline(link.labelStart, link.labelEnd);
          }
          ranges.push({
            type: "syntax",
            start: link.labelEnd,
            length: link.end - link.labelEnd,
          });
          i = link.end;
          continue;
        }
      }

      if (i + 1 < to && input[i] === "*" && input[i + 1] === "*") {
        const close = indexOfDelim(i + 2, to, "**");
        if (close !== -1 && close > i + 2) {
          ranges.push({ type: "syntax", start: i, length: 2 });
          ranges.push({ type: "bold", start: i + 2, length: close - (i + 2) });
          parseInline(i + 2, close);
          ranges.push({ type: "syntax", start: close, length: 2 });
          i = close + 2;
          continue;
        }
      }

      if (input[i] === "_") {
        const close = indexOfDelim(i + 1, to, "_");
        if (close !== -1 && close > i + 1) {
          ranges.push({ type: "syntax", start: i, length: 1 });
          ranges.push({ type: "italic", start: i + 1, length: close - (i + 1) });
          parseInline(i + 1, close);
          ranges.push({ type: "syntax", start: close, length: 1 });
          i = close + 1;
          continue;
        }
      }

      i += 1;
    }
  };

  const headingPrefixLength = (start: number, end: number) => {
    if (start >= end || input[start] !== "#") return 0;
    let i = start;
    let hashes = 0;
    while (i < end && input[i] === "#" && hashes < 2) {
      hashes += 1;
      i += 1;
    }
    if (hashes === 0 || i >= end || !isWs(input[i])) return 0;
    while (i < end && isWs(input[i])) i += 1;
    return i - start;
  };

  const checklistPrefixLength = (start: number, end: number) => {
    if (end - start < 6) return 0;
    if (input[start] !== "-" || !isWs(input[start + 1])) return 0;
    if (input[start + 2] !== "[") return 0;
    const mark = input[start + 3];
    if (mark !== " " && mark !== "x" && mark !== "X") return 0;
    if (input[start + 4] !== "]") return 0;
    if (!isWs(input[start + 5])) return 0;
    return 6;
  };

  const bulletPrefixLength = (start: number, end: number) => {
    if (start >= end || input[start] !== "-") return 0;
    if (start + 1 >= end || !isWs(input[start + 1])) return 0;
    let i = start + 1;
    while (i < end && isWs(input[i])) i += 1;
    return i - start;
  };

  const orderedPrefixLength = (start: number, end: number) => {
    let i = start;
    if (i >= end || input[i] < "0" || input[i] > "9") return 0;
    while (i < end && input[i] >= "0" && input[i] <= "9") i += 1;
    if (i >= end || input[i] !== ".") return 0;
    i += 1;
    if (i >= end || !isWs(input[i])) return 0;
    while (i < end && isWs(input[i])) i += 1;
    return i - start;
  };

  const parseLine = (lineStart: number, lineEnd: number) => {
    let contentStart = lineStart;
    while (contentStart < lineEnd && isWs(input[contentStart])) contentStart += 1;
    if (contentStart >= lineEnd) return;

    let trimmedEnd = lineEnd;
    while (trimmedEnd > contentStart && isWs(input[trimmedEnd - 1])) trimmedEnd -= 1;

    const imageEnd = matchImageToken(contentStart, trimmedEnd);
    if (imageEnd === trimmedEnd) {
      ranges.push({
        type: "syntax",
        start: contentStart,
        length: trimmedEnd - contentStart,
      });
      return;
    }

    const hLen = headingPrefixLength(contentStart, lineEnd);
    if (hLen > 0) {
      const hashes = input[contentStart + 1] === "#" ? 2 : 1;
      ranges.push({ type: "syntax", start: contentStart, length: hLen });
      const bodyStart = contentStart + hLen;
      if (bodyStart < lineEnd) {
        ranges.push({
          type: hashes === 1 ? "h1" : "bold",
          start: bodyStart,
          length: lineEnd - bodyStart,
        });
        parseInline(bodyStart, lineEnd);
      }
      return;
    }

    const checkLen = checklistPrefixLength(contentStart, lineEnd);
    if (checkLen > 0) {
      ranges.push({ type: "syntax", start: contentStart, length: checkLen });
      parseInline(contentStart + checkLen, lineEnd);
      return;
    }

    const bulletLen = bulletPrefixLength(contentStart, lineEnd);
    if (bulletLen > 0) {
      ranges.push({ type: "syntax", start: contentStart, length: bulletLen });
      parseInline(contentStart + bulletLen, lineEnd);
      return;
    }

    const orderedLen = orderedPrefixLength(contentStart, lineEnd);
    if (orderedLen > 0) {
      ranges.push({ type: "syntax", start: contentStart, length: orderedLen });
      parseInline(contentStart + orderedLen, lineEnd);
      return;
    }

    parseInline(lineStart, lineEnd);
  };

  let lineStart = 0;
  while (lineStart <= input.length) {
    let lineEnd = input.indexOf("\n", lineStart);
    if (lineEnd === -1) lineEnd = input.length;
    parseLine(lineStart, lineEnd);
    if (lineEnd === input.length) break;
    lineStart = lineEnd + 1;
  }

  return ranges;
}
