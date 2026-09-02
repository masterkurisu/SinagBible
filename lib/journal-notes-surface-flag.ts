/**
 * Global kill switch for the reflection notes surface.
 *
 * On → note-surface writing path (Enriched default). Nested lists and screen
 * readers still use the live-markdown editor via `shouldMountLegacyReflectionEditor`.
 * Off → today's compact MarkdownTextInput sheet editor for everyone; no row mutation.
 *
 * This is a store binary, not a remote flip. Set to `false` and ship a new
 * build to roll back. Pair that with a halt-able Play Console staged rollout
 * and an iOS phased release — rollback takes days, not minutes.
 *
 * Do not uninstall live-markdown or drop `journal_entry_pre_enriched_snapshots`
 * until one production release with no halt; those ship together later.
 */
export const JOURNAL_NOTES_SURFACE_ENABLED = true;
