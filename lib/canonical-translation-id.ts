import { getInternalIdFromApiId } from "@sinag-bible/core/bible-translations";

/** Normalize API or internal ids to the store / reader key shape. */
export function canonicalTranslationId(apiOrInternalId: string): string {
  return getInternalIdFromApiId(apiOrInternalId) ?? apiOrInternalId;
}
