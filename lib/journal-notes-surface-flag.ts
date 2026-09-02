/**
 * Global kill switch for the reflection notes surface (Phase 1+).
 *
 * Off → today's compact MarkdownTextInput field, manual expand, floating pill.
 * Store builds stay off until Phase 4 staged rollout (`__DEV__` is false in release).
 *
 * Independent of `reflectionHtmlNeedsLegacyEditor` (per-row router, Phase 2).
 */
export const JOURNAL_NOTES_SURFACE_ENABLED = __DEV__;
