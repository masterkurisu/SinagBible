import { describe, expect, it } from "vitest";
import {
  READER_M3_SHEET_KEYBOARD_GAP_PX,
  computeReaderM3SheetKeyboardMetrics,
} from "@/src/components/m3/readerM3SheetKeyboard";

describe("computeReaderM3SheetKeyboardMetrics", () => {
  it("keeps the sheet on the screen edge when the keyboard is closed", () => {
    const metrics = computeReaderM3SheetKeyboardMetrics({
      screenHeight: 800,
      keyboardHeight: 0,
      statusBarInset: 24,
      maxHeight: 440,
    });
    expect(metrics.bottomInset).toBe(0);
    expect(metrics.maxHeight).toBe(440);
    expect(metrics.floating).toBe(false);
  });

  it("docks just above a tall Gboard-style keyboard", () => {
    const metrics = computeReaderM3SheetKeyboardMetrics({
      screenHeight: 800,
      keyboardHeight: 360,
      statusBarInset: 24,
      maxHeight: 440,
    });
    expect(metrics.bottomInset).toBe(360 + READER_M3_SHEET_KEYBOARD_GAP_PX);
    expect(metrics.floating).toBe(true);
    expect(metrics.bottomInset + metrics.maxHeight + 24).toBeLessThanOrEqual(800);
  });

  it("shrinks for a taller keyboard instead of overflowing the screen", () => {
    const metrics = computeReaderM3SheetKeyboardMetrics({
      screenHeight: 800,
      keyboardHeight: 520,
      statusBarInset: 24,
      maxHeight: 440,
    });
    expect(metrics.maxHeight).toBe(800 - (520 + READER_M3_SHEET_KEYBOARD_GAP_PX) - 24);
    expect(metrics.bottomInset + metrics.maxHeight + 24).toBeLessThanOrEqual(800);
  });

  it("tracks a shorter floating keyboard without keeping the previous tall inset", () => {
    const tall = computeReaderM3SheetKeyboardMetrics({
      screenHeight: 844,
      keyboardHeight: 420,
      statusBarInset: 47,
      maxHeight: 464,
    });
    const compact = computeReaderM3SheetKeyboardMetrics({
      screenHeight: 844,
      keyboardHeight: 280,
      statusBarInset: 47,
      maxHeight: 464,
    });
    expect(compact.bottomInset).toBeLessThan(tall.bottomInset);
    expect(compact.bottomInset).toBe(280 + READER_M3_SHEET_KEYBOARD_GAP_PX);
  });
});
