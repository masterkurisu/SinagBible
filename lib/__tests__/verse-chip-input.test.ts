import { describe, expect, it } from "vitest";
import { isVerseTagMentionTrigger } from "@sinag-bible/core/verse-tags";
import { createVerseTagComposer } from "@/src/features/verse-tags/verseTagComposer";
import { getKjvCanonicalBookNav } from "@sinag-bible/core/bible-meta";
import {
  buildVerseChipInputModel,
  canTriggerVerseTagAt,
  deleteAtomicBeforeCursor,
  findTextRunAtCursor,
  flattenVerseChipInputRuns,
  globalCursorFromLocal,
  inferLocalCursorAfterEdit,
  replaceTextRunValue,
} from "@/src/features/verse-tags/verseChipInputModel";

function testVerseCount(book: string, chapter: number): number | null {
  const nav = getKjvCanonicalBookNav().find((item) => item.slug === book);
  if (!nav || chapter < 1 || chapter > nav.chapterCount) return null;
  if (book === "john" && chapter === 3) return 36;
  if (book === "mark" && chapter === 11) return 33;
  return 60;
}

describe("buildVerseChipInputModel", () => {
  it("gives an empty note one trailing text run", () => {
    const lines = buildVerseChipInputModel("");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.runs).toEqual([
      {
        kind: "text",
        id: "text-0",
        value: "",
        start: 0,
        end: 0,
        lineIndex: 0,
        trailing: true,
      },
    ]);
  });

  it("keeps plain text as a single trailing run so a tap can place the caret mid-run", () => {
    const lines = buildVerseChipInputModel("hello world");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.runs).toEqual([
      expect.objectContaining({
        kind: "text",
        value: "hello world",
        start: 0,
        end: 11,
        trailing: true,
      }),
    ]);
    const run = lines[0]!.runs[0]!;
    expect(run.kind).toBe("text");
    expect(globalCursorFromLocal(run.start, 6)).toBe(6);
    expect(canTriggerVerseTagAt("hello world", 6)).toBe(true);
    expect(canTriggerVerseTagAt("user@example.com", 4)).toBe(false);
  });

  it("renders formed tags as chips and leaves malformed tokens editable as text", () => {
    const lines = buildVerseChipInputModel("See [@john:3:16] and [@bad] plus");
    const runs = flattenVerseChipInputRuns(lines);
    expect(runs.map((run) => run.kind)).toEqual(["text", "chip", "text"]);
    expect(runs[1]).toEqual(
      expect.objectContaining({
        kind: "chip",
        raw: "[@john:3:16]",
        ref: { book: "john", chapter: 3, verseStart: 16 },
      }),
    );
    expect(runs[2]).toEqual(
      expect.objectContaining({
        kind: "text",
        value: " and [@bad] plus",
        trailing: true,
      }),
    );
  });

  it("leaves an invalid complete-looking ref as text instead of a chip", () => {
    const runs = flattenVerseChipInputRuns(buildVerseChipInputModel("@mark 11:99 "));
    expect(runs.every((run) => run.kind === "text")).toBe(true);
    expect(runs[0]).toEqual(expect.objectContaining({ value: "@mark 11:99 " }));
  });

  it("adds a trailing empty input after a chip on the same line", () => {
    const lines = buildVerseChipInputModel("[@mark:11:22]");
    expect(flattenVerseChipInputRuns(lines).map((run) => run.kind)).toEqual(["chip", "text"]);
    expect(lines[0]!.runs[1]).toEqual(
      expect.objectContaining({ kind: "text", value: "", start: 13, end: 13, trailing: true }),
    );
  });

  it("gives each newline its own trailing text input", () => {
    const lines = buildVerseChipInputModel("hello [@john:3:16]\nworld");
    expect(lines).toHaveLength(2);
    expect(lines[0]!.runs.map((run) => run.kind)).toEqual(["text", "chip", "text"]);
    expect(lines[0]!.runs[2]).toEqual(
      expect.objectContaining({ kind: "text", value: "", trailing: true }),
    );
    expect(lines[1]!.runs).toEqual([
      expect.objectContaining({ kind: "text", value: "world", trailing: true, lineIndex: 1 }),
    ]);
  });
});

describe("mid-segment verse chip insertion", () => {
  it("turns hello world into hello [chip] world when @ is typed at the word boundary", () => {
    const prefix = "hello ";
    const suffix = "world";
    const composer = createVerseTagComposer({
      translation: "KJV",
      getVerseCount: testVerseCount,
    });

    let text = prefix + suffix;
    const insertAt = prefix.length;
    expect(canTriggerVerseTagAt(text, insertAt)).toBe(true);

    const typed = "@John 3:16 ";
    for (let index = 0; index < typed.length; index += 1) {
      const inserted = typed.slice(0, index + 1);
      text = prefix + inserted + suffix;
      const cursor = prefix.length + inserted.length;
      if (inserted.endsWith("@") || inserted.startsWith("@")) {
        expect(isVerseTagMentionTrigger(prefix + "@" + suffix, prefix.length + 1)).toBe(true);
      }
      const result = composer.push({ type: "change", text, cursorIndex: cursor });
      if (result.commit) {
        text = result.commit.text;
        expect(text).toBe("hello [@john:3:16] world");
        const lines = buildVerseChipInputModel(text);
        const runs = flattenVerseChipInputRuns(lines);
        expect(runs.map((run) => (run.kind === "text" ? run.value : run.raw))).toEqual([
          "hello ",
          "[@john:3:16]",
          " world",
        ]);
        const caretRun = findTextRunAtCursor(lines, result.commit.cursorIndex);
        expect(caretRun).toEqual(
          expect.objectContaining({ kind: "text", value: " world", trailing: true }),
        );
        return;
      }
    }

    throw new Error("expected composer to commit a chip");
  });
});

describe("replaceTextRunValue and caret inference", () => {
  it("rewrites only the focused text run in the tokenized string", () => {
    const text = "hello [@john:3:16] world";
    const run = flattenVerseChipInputRuns(buildVerseChipInputModel(text))[2];
    expect(run?.kind).toBe("text");
    if (run?.kind !== "text") return;
    expect(replaceTextRunValue(text, run, " notes")).toBe("hello [@john:3:16] notes");
  });

  it("keeps the caret inside a run after an insertion", () => {
    expect(
      inferLocalCursorAfterEdit("hello world", "hello xworld", { start: 6, end: 6 }),
    ).toBe(7);
  });
});

describe("deleteAtomicBeforeCursor", () => {
  it("deletes the previous chip when the following text run is empty", () => {
    const text = "hello [@john:3:16]";
    const cursor = text.length;
    expect(deleteAtomicBeforeCursor(text, cursor)).toEqual({
      text: "hello ",
      cursorIndex: "hello ".length,
    });
  });

  it("deletes the previous chip when the caret is at the start of the following run", () => {
    const text = "hello [@john:3:16] world";
    const chipEnd = "hello [@john:3:16]".length;
    expect(deleteAtomicBeforeCursor(text, chipEnd)).toEqual({
      text: "hello  world",
      cursorIndex: "hello ".length,
    });
  });

  it("does not delete a chip when the caret is mid-run", () => {
    const text = "hello [@john:3:16] world";
    expect(deleteAtomicBeforeCursor(text, text.length)).toBeNull();
  });

  it("joins lines when Backspace is pressed at the start of the next line", () => {
    const text = "hello\nworld";
    expect(deleteAtomicBeforeCursor(text, "hello\n".length)).toEqual({
      text: "helloworld",
      cursorIndex: "hello".length,
    });
  });
});
