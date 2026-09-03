/** Chevron rotation (degrees) for the tag disclosure header from expand progress 0–1. */
export function disclosureChevronRotationDeg(expandProgress: number): number {
  return expandProgress * 180;
}
