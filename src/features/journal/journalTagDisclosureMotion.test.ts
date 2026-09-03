import { describe, expect, it } from "vitest";
import { disclosureChevronRotationDeg } from "./journalTagDisclosureMotion";

describe("disclosureChevronRotationDeg", () => {
  it("returns 0 when collapsed", () => {
    expect(disclosureChevronRotationDeg(0)).toBe(0);
  });

  it("returns 180 when expanded", () => {
    expect(disclosureChevronRotationDeg(1)).toBe(180);
  });
});
