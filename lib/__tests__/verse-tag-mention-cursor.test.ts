import { describe, expect, it } from "vitest";
import { createVerseTagComposer } from "@/src/features/verse-tags/verseTagComposer";
import { inferCursorAfterTextEdit } from "@/src/features/verse-tags/useVerseTagMention";

describe("inferCursorAfterTextEdit", () => {
  it("advances the caret on each append when selection is kept in sync", () => {
    let selection = { start: 0, end: 0 };
    let text = "";

    for (const chunk of ["T", "e", "s", "t", "\n", "@"]) {
      const next = text + chunk;
      const cursor = inferCursorAfterTextEdit(text, next, selection);
      selection = { start: cursor, end: cursor };
      text = next;
    }

    expect(text).toBe("Test\n@");
    expect(selection.end).toBe(text.length);
  });
});

describe("verse-tag composer with inferred cursor", () => {
  it("opens a mention when MarkdownTextInput omits selection on every keystroke", () => {
    const composer = createVerseTagComposer();
    let text = "";
    let selection = { start: 0, end: 0 };

    for (const chunk of ["T", "e", "s", "t", "\n", "@", "m", "a", "t", "t", "h", "e", "w", " ", "7", ":", "1", " "]) {
      const next = text + chunk;
      const cursor = inferCursorAfterTextEdit(text, next, selection);
      selection = { start: cursor, end: cursor };
      const result = composer.push({ type: "change", text: next, cursorIndex: cursor });
      text = result.commit?.text ?? next;
      if (result.commit) {
        selection = { start: result.commit.cursorIndex, end: result.commit.cursorIndex };
      }
    }

    expect(text).toContain("[@matthew:7:1]");
    expect(text).not.toMatch(/@matthew\s+7:1/);
  });
});
