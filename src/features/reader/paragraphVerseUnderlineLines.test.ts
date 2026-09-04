import { describe, expect, it } from "vitest";
import type { TextLayoutLine } from "react-native";
import { paragraphUnderlineExtraOffsetY } from "@/src/features/reader/verseAnnotationUnderlineMetrics";
import {
  buildParagraphRunPlainText,
  collectParagraphFillLinesByVerse,
  collectParagraphUnderlineLinesByVerse,
  normalizeParagraphTextLayoutLines,
} from "@/src/features/reader/paragraphVerseUnderlineLines";

function line(
  text: string,
  y: number,
  width: number,
  height = 18.133333206176758,
): TextLayoutLine {
  return {
    text,
    x: 0,
    y,
    width,
    height,
    ascender: 19.9,
    descender: -1.78,
    capHeight: 14,
    xHeight: 10,
  };
}

describe("normalizeParagraphTextLayoutLines", () => {
  it("scales Android nested-text metrics up to the styled line height", () => {
    const styled = 36.1816;
    const out = normalizeParagraphTextLayoutLines(
      [line("a", 0, 100), line("b", 18.133333206176758, 100)],
      styled,
    );
    expect(out[0]?.y).toBeCloseTo(0, 3);
    expect(out[0]?.height).toBeCloseTo(styled, 3);
    expect(out[1]?.y).toBeCloseTo(styled, 3);
    expect(out[1]?.height).toBeCloseTo(styled, 3);
  });

  it("leaves already-correct metrics alone", () => {
    const styled = 36.18;
    const out = normalizeParagraphTextLayoutLines(
      [line("a", 0, 100, 36.27), line("b", 36.27, 100, 36.27)],
      styled,
    );
    expect(out[0]?.y).toBe(0);
    expect(out[0]?.height).toBe(36.27);
    expect(out[1]?.y).toBe(36.27);
  });
});

describe("paragraphUnderlineExtraOffsetY", () => {
  it("adds line-by-line descender clearance when nested Text reports no descender", () => {
    expect(paragraphUnderlineExtraOffsetY(22.72, -1.78)).toBe(10);
    expect(paragraphUnderlineExtraOffsetY(22.72, 9.6)).toBe(0);
  });
});

describe("collectParagraphUnderlineLinesByVerse", () => {
  it("clips mid-line verse starts and keeps full lines for a single verse", () => {
    const v1 =
      "As they approached Jerusalem and came to Bethphage and Bethany at the Mount of Olives, Jesus sent two of his disciples,";
    const v2 = "saying to them, Go.";
    const verses = [
      { verseIndex: 0, verseText: v1 },
      { verseIndex: 1, verseText: v2 },
    ];
    const { text } = buildParagraphRunPlainText(verses);
    const first = text.slice(0, 20);
    const restStart = text.indexOf("two of his disciples");
    const boundary = text.slice(restStart, restStart + 28);

    const lines = [
      line(first, 0, 400),
      line(boundary, 18.133333206176758, 400),
    ];

    const byVerse = collectParagraphUnderlineLinesByVerse(
      lines,
      verses,
      {
        2: { style: "underline", colorId: "red", underlineStyle: "straight" },
      },
      new Set(),
      36.1816,
    );

    const verse2 = byVerse.get(2);
    expect(verse2?.length).toBe(1);
    expect(verse2?.[0]?.x).toBeGreaterThan(0);
    expect(verse2?.[0]?.width).toBeLessThan(400);
    expect(byVerse.has(1)).toBe(false);
  });
});

describe("collectParagraphFillLinesByVerse", () => {
  it("maps highlight verses without the underline extra offset", () => {
    const verses = [
      { verseIndex: 0, verseText: "First verse text goes here and wraps." },
      { verseIndex: 6, verseText: "When they brought the colt to Jesus." },
    ];
    const { text, ranges } = buildParagraphRunPlainText(verses);
    const v7 = ranges.find((range) => range.verseNum === 7);
    const slice = text.slice(v7!.start, v7!.start + 20);
    const lines = [line(slice, 0, 400)];
    const fills = collectParagraphFillLinesByVerse(
      lines,
      verses,
      { 7: { style: "highlight", colorId: "green" } },
      new Set(),
      36.1816,
    );
    expect(fills.has(7)).toBe(true);
    expect(fills.has(1)).toBe(false);
    const y = fills.get(7)?.[0]?.y ?? -1;
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(40);
  });
});
