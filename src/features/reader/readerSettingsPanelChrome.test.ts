import { describe, expect, it } from "vitest";
import {
  READER_OVERLAY_CONTENT_SCALE,
  readerM3SheetMaxHeightRatio,
  readerM3SheetMaxWidthPx,
  readerPickerSheetMaxWidthPx,
  shouldPresentReaderSettingsAsSideSheet,
} from "@/src/features/reader/readerSettingsPanelChrome";

describe("shouldPresentReaderSettingsAsSideSheet", () => {
  it("uses the side sheet on phone layouts", () => {
    expect(shouldPresentReaderSettingsAsSideSheet(false)).toBe(true);
  });

  it("uses the behind-content panel on tablet reader layouts", () => {
    expect(shouldPresentReaderSettingsAsSideSheet(true)).toBe(false);
  });

  it("forces the side sheet on tablet/fold screens that do not slide content", () => {
    expect(shouldPresentReaderSettingsAsSideSheet(true, true)).toBe(true);
  });
});

describe("reader overlay sheet chrome", () => {
  it("keeps overlay type at the phone M3 scale on every device", () => {
    expect(READER_OVERLAY_CONTENT_SCALE).toBe(1);
  });

  it("lets phone sheets use the full window width", () => {
    expect(readerM3SheetMaxWidthPx(390, false, "compact")).toBe(390);
    expect(readerM3SheetMaxWidthPx(390, false, "reading")).toBe(390);
  });

  it("keeps compact tablet sheets at a control-sized card", () => {
    expect(readerM3SheetMaxWidthPx(1280, true, "compact")).toBe(440);
    expect(readerM3SheetMaxWidthPx(800, true, "compact")).toBe(440);
  });

  it("widens reading sheets on landscape tablets without going edge-to-edge", () => {
    expect(readerM3SheetMaxWidthPx(1280, true, "reading")).toBe(717);
    expect(readerM3SheetMaxWidthPx(800, true, "reading")).toBe(520);
  });

  it("never exceeds the available tablet gutter", () => {
    expect(readerM3SheetMaxWidthPx(500, true, "reading")).toBe(452);
    expect(readerPickerSheetMaxWidthPx(600, true)).toBe(552);
    expect(readerPickerSheetMaxWidthPx(1280, true)).toBe(720);
  });

  it("caps compact tablet sheets shorter than reading sheets", () => {
    expect(readerM3SheetMaxHeightRatio(false, 0.82, "compact")).toBe(0.82);
    expect(readerM3SheetMaxHeightRatio(true, 0.82, "compact")).toBe(0.72);
    expect(readerM3SheetMaxHeightRatio(true, 0.78, "reading")).toBe(0.82);
    expect(readerM3SheetMaxHeightRatio(true, 0.9, "reading")).toBe(0.9);
  });
});
