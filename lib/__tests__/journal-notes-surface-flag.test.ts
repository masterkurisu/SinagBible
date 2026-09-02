import { describe, expect, it } from "vitest";
import { JOURNAL_NOTES_SURFACE_ENABLED } from "@/lib/journal-notes-surface-flag";
import { shouldMountLegacyReflectionEditor } from "@/lib/journal-reflection-legacy-route";

describe("JOURNAL_NOTES_SURFACE_ENABLED", () => {
  it("is on for store builds; rollback is a binary flip of this constant", () => {
    expect(JOURNAL_NOTES_SURFACE_ENABLED).toBe(true);
  });

  it("does not replace the per-row legacy router", () => {
    expect(
      shouldMountLegacyReflectionEditor({
        html: "<p>Hello</p>",
        screenReaderEnabled: false,
      }),
    ).toBe(false);
    expect(
      shouldMountLegacyReflectionEditor({
        html: "<ul><li>outer<ul><li>inner</li></ul></li></ul>",
        screenReaderEnabled: false,
      }),
    ).toBe(true);
    expect(
      shouldMountLegacyReflectionEditor({
        html: "<p>Hello</p>",
        screenReaderEnabled: true,
      }),
    ).toBe(true);
  });
});
