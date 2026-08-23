import { describe, expect, it } from "vitest";
import { shouldPresentReaderSettingsAsSideSheet } from "@/src/features/reader/readerSettingsPanelChrome";

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
