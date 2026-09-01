import { describe, expect, it } from "vitest";
import { parseReflectionLiveMarkdown } from "@/lib/journal-reflection-live-markdown-parser";
import {
  applyReflectionToolbarAction,
  deleteAtomicVerseTagOnEdit,
  insertReflectionImageToken,
  insertReflectionVerseTag,
  listReflectionImageIds,
  toggleLinePrefix,
  wrapMarkdownMarker,
  type ReflectionToolbarFormatAction,
} from "@/lib/journal-reflection-markdown-edit";

function hasType(input: string, type: string) {
  return parseReflectionLiveMarkdown(input).some((range) => range.type === type);
}

describe("listReflectionImageIds", () => {
  it("returns nothing when there are no image tokens", () => {
    expect(listReflectionImageIds("just text\n- [ ] todo")).toEqual([]);
  });

  it("collects [image:id] tokens in document order", () => {
    expect(listReflectionImageIds("before\n[image:img-0]\nmiddle [image:img-1]\n")).toEqual([
      "img-0",
      "img-1",
    ]);
  });
});

describe("wrapMarkdownMarker", () => {
  it("inserts a marker pair at the caret when nothing is selected", () => {
    expect(wrapMarkdownMarker("ab", { start: 1, end: 1 }, "**")).toEqual({
      text: "a****b",
      selection: { start: 3, end: 3 },
    });
  });

  it("wraps the current selection", () => {
    expect(wrapMarkdownMarker("say hi now", { start: 4, end: 6 }, "**")).toEqual({
      text: "say **hi** now",
      selection: { start: 4, end: 10 },
    });
  });

  it("unwraps when the caret sits inside a matching pair", () => {
    expect(wrapMarkdownMarker("say **hi** now", { start: 6, end: 8 }, "**")).toEqual({
      text: "say hi now",
      selection: { start: 4, end: 6 },
    });
  });

  it("unwraps when the selection includes the markers", () => {
    expect(wrapMarkdownMarker("**hi**", { start: 0, end: 6 }, "**")).toEqual({
      text: "hi",
      selection: { start: 0, end: 2 },
    });
  });
});

describe("toggleLinePrefix", () => {
  it("prefixes the line the caret is on, not the start of the document", () => {
    const text = "alpha\nbeta\ngamma";
    const caret = text.indexOf("beta") + 2;
    expect(toggleLinePrefix(text, { start: caret, end: caret }, "- ")).toEqual({
      text: "alpha\n- beta\ngamma",
      selection: { start: caret + 2, end: caret + 2 },
    });
  });

  it("toggles the same prefix off", () => {
    expect(toggleLinePrefix("- hello", { start: 4, end: 4 }, "- ")).toEqual({
      text: "hello",
      selection: { start: 2, end: 2 },
    });
  });

  it("replaces a different line style instead of stacking", () => {
    expect(toggleLinePrefix("- hello", { start: 4, end: 4 }, "## ")).toEqual({
      text: "## hello",
      selection: { start: 5, end: 5 },
    });
  });
});

describe("applyReflectionToolbarAction", () => {
  const doc = "Keep the first line.\n\nEdit this word here.";
  const wordStart = doc.indexOf("this word");
  const wordEnd = wordStart + "this word".length;
  const wordSelection = { start: wordStart, end: wordEnd };
  const caretInSecondLine = { start: wordStart, end: wordStart };

  it("applies bold at a mid-document selection, not at offset 0", () => {
    const next = applyReflectionToolbarAction(doc, wordSelection, "bold");
    expect(next.text).toBe("Keep the first line.\n\nEdit **this word** here.");
    expect(next.selection).toEqual({ start: wordStart, end: wordEnd + 4 });
    expect(next.text.startsWith("Keep the first line.")).toBe(true);
  });

  it("applies italic at a mid-document selection", () => {
    const next = applyReflectionToolbarAction(doc, wordSelection, "italic");
    expect(next.text).toBe("Keep the first line.\n\nEdit _this word_ here.");
  });

  it("applies heading / lists / checklist to the caret's line only", () => {
    const cases: [ReflectionToolbarFormatAction, string][] = [
      ["heading", "Keep the first line.\n\n## Edit this word here."],
      ["bullet", "Keep the first line.\n\n- Edit this word here."],
      ["numbered", "Keep the first line.\n\n1. Edit this word here."],
      ["checklist", "Keep the first line.\n\n- [ ] Edit this word here."],
    ];
    for (const [action, expected] of cases) {
      const next = applyReflectionToolbarAction(doc, caretInSecondLine, action);
      expect(next.text).toBe(expected);
      expect(next.text.startsWith("Keep the first line.")).toBe(true);
    }
  });

  it("inserts a link template at the caret, and wraps a selection as the label", () => {
    const empty = applyReflectionToolbarAction("see ", { start: 4, end: 4 }, "link");
    expect(empty).toEqual({
      text: "see [](https://)",
      selection: { start: 5, end: 5 },
    });

    const wrapped = applyReflectionToolbarAction("see here now", { start: 4, end: 8 }, "link");
    expect(wrapped.text).toBe("see [here](https://) now");
    expect(wrapped.selection).toEqual({ start: 11, end: 19 });
  });

  it("inserts an image token at the caret", () => {
    const next = insertReflectionImageToken("hello", { start: 5, end: 5 }, "img-1");
    expect(next.text).toBe("hello\n[image:img-1]\n");
    expect(next.selection).toEqual({ start: next.text.length, end: next.text.length });
    expect(listReflectionImageIds(next.text)).toEqual(["img-1"]);
  });
});

describe("insertReflectionVerseTag", () => {
  const john316 = { book: "john", chapter: 3, verseStart: 16 };

  it("inserts [@john:3:16] and a trailing space at the caret", () => {
    expect(insertReflectionVerseTag("see ", { start: 4, end: 4 }, john316, "KJV")).toEqual({
      text: "see [@john:3:16] ",
      selection: { start: 17, end: 17 },
    });
  });

  it("replaces an active @mention instead of inserting beside it", () => {
    expect(insertReflectionVerseTag("see @john", { start: 9, end: 9 }, john316, "KJV")).toEqual({
      text: "see [@john:3:16] ",
      selection: { start: 17, end: 17 },
    });
  });
});

describe("deleteAtomicVerseTagOnEdit", () => {
  const text = "see [@john:3:16] now";
  const tokenStart = text.indexOf("[@");
  const tokenEnd = text.indexOf("]") + 1;

  it("expands backspace at the token end into a whole-token delete", () => {
    const next = text.slice(0, tokenEnd - 1) + text.slice(tokenEnd);
    expect(deleteAtomicVerseTagOnEdit(text, next)).toEqual({
      text: "see  now",
      selection: { start: tokenStart, end: tokenStart },
    });
  });

  it("expands a deletion inside the token into a whole-token delete", () => {
    const inner = text.indexOf("john");
    const next = text.slice(0, inner) + text.slice(inner + 1);
    expect(deleteAtomicVerseTagOnEdit(text, next)).toEqual({
      text: "see  now",
      selection: { start: tokenStart, end: tokenStart },
    });
  });

  it("leaves a native whole-token delete unchanged", () => {
    const next = text.slice(0, tokenStart) + text.slice(tokenEnd);
    expect(deleteAtomicVerseTagOnEdit(text, next)).toBeNull();
  });

  it("does not treat ordinary backspace as a verse-token delete", () => {
    expect(deleteAtomicVerseTagOnEdit("hello", "hell")).toBeNull();
  });
});

describe("toolbar output live-parses", () => {
  it("paints bold / italic / heading / lists / checklist / link / image immediately", () => {
    const doc = "Keep the first line.\n\nEdit this word here.";
    const wordStart = doc.indexOf("this word");
    const wordEnd = wordStart + "this word".length;
    const caret = { start: wordStart, end: wordStart };
    const word = { start: wordStart, end: wordEnd };

    const bold = applyReflectionToolbarAction(doc, word, "bold").text;
    expect(hasType(bold, "bold")).toBe(true);

    const italic = applyReflectionToolbarAction(doc, word, "italic").text;
    expect(hasType(italic, "italic")).toBe(true);

    const heading = applyReflectionToolbarAction(doc, caret, "heading").text;
    // ## maps to bold (no h2 MarkdownType); first line stays unstyled heading.
    expect(hasType(heading, "bold")).toBe(true);
    expect(hasType(heading, "h1")).toBe(false);

    const bullet = applyReflectionToolbarAction(doc, caret, "bullet").text;
    expect(hasType(bullet, "syntax")).toBe(true);

    const numbered = applyReflectionToolbarAction(doc, caret, "numbered").text;
    expect(hasType(numbered, "syntax")).toBe(true);

    const checklist = applyReflectionToolbarAction(doc, caret, "checklist").text;
    expect(hasType(checklist, "syntax")).toBe(true);

    const link = applyReflectionToolbarAction(doc, word, "link").text;
    expect(hasType(link, "link")).toBe(true);

    const image = insertReflectionImageToken("before", { start: 6, end: 6 }, "img-9").text;
    expect(hasType(image, "syntax")).toBe(true);

    const verse = insertReflectionVerseTag("before", { start: 6, end: 6 }, {
      book: "john",
      chapter: 3,
      verseStart: 16,
    }, "KJV").text;
    expect(hasType(verse, "link")).toBe(true);
    expect(verse).toContain("[@john:3:16]");
  });
});
