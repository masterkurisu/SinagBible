/**
 * Enriched session helpers: seed HTML, no-op save, draft kill/resume.
 * Seed HTML is mapped to the Enriched dialect (mentions, native checklists).
 * Dual-write `content` is mapped back to owned HTML for the read renderer.
 */

import { htmlToReflectionMarkdown } from "@/lib/journal-reflection-html";
import {
  enrichedHtmlToOwnedHtml,
  ownedHtmlToEnrichedHtml,
} from "@/lib/journal-reflection-enriched-mapping";
import {
  canonicalizeOwnedReflectionHtml,
  reflectionSpacerSignature,
} from "@/lib/journal-reflection-owned-html";
import {
  ENRICHED_HTML_CONTENT_FORMAT,
  compositeEnrichedEditorVersion,
  normalizeReflectionMarkdownForCompare,
} from "@/lib/journal-reflection-legacy-route";

export type EnrichedDraftKillResult =
  | { kind: "converted"; markdown: string }
  | { kind: "discarded"; reason: "empty" | "threw" };

export type EnrichedSaveContentPlan =
  | { kind: "noop" }
  | {
      kind: "write";
      content: string;
      content_markdown: string;
      content_format: typeof ENRICHED_HTML_CONTENT_FORMAT;
      editor_version: string;
      /** Existing rows only — INSERT OR IGNORE in the shadow table. */
      captureSnapshot: boolean;
    };

export type JournalDraftEditorKind = "enriched-html" | "markdown";

export type HydratedJournalDraftReflection = {
  reflectionMarkdown: string;
  reflectionHtml?: string;
  reflectionEditor?: JournalDraftEditorKind;
};

const EMPTY_EDITOR_HTML = "<p></p>";

function canonicalOwnedOrEmpty(html: string): string {
  return canonicalizeOwnedReflectionHtml(html) || EMPTY_EDITOR_HTML;
}

function ownedMarkdownComparable(html: string): string {
  return normalizeReflectionMarkdownForCompare(htmlToReflectionMarkdown(html));
}

function markdownMatches(editorHtml: string, storedMarkdown: string | null | undefined, storedHtml: string): boolean {
  const left = ownedMarkdownComparable(editorHtml);
  const stored = storedMarkdown?.trim();
  const right = stored
    ? normalizeReflectionMarkdownForCompare(storedMarkdown ?? "")
    : ownedMarkdownComparable(storedHtml);
  return left === right;
}

function spacerMatches(editorHtml: string, storedHtml: string): boolean {
  const editorOwned = canonicalizeOwnedReflectionHtml(enrichedHtmlToOwnedHtml(editorHtml));
  const storedOwned = canonicalizeOwnedReflectionHtml(storedHtml);
  return reflectionSpacerSignature(editorOwned) === reflectionSpacerSignature(storedOwned);
}

/**
 * Kill/resume: convert an Enriched draft into the legacy markdown shape.
 * Discard the reflection body only if conversion is empty or throws.
 */
export function convertEnrichedDraftHtmlForLegacy(
  html: string,
  convert: (value: string) => string = htmlToReflectionMarkdown,
): EnrichedDraftKillResult {
  try {
    const markdown = convert(html).trim();
    if (!markdown) return { kind: "discarded", reason: "empty" };
    return { kind: "converted", markdown };
  } catch {
    return { kind: "discarded", reason: "threw" };
  }
}

/**
 * Three seed sources for `setValue`: stored edit HTML, unsaved Enriched draft HTML,
 * or markdown (new / markdown draft) converted once. Empty new notes get `<p></p>`.
 */
export function resolveEnrichedSeedHtml(opts: {
  storedHtml?: string | null;
  draftHtml?: string | null;
  draftMarkdown?: string | null;
  images?: Record<string, string>;
  markdownToHtml: (markdown: string, images: Record<string, string>) => string;
}): string {
  const stored = opts.storedHtml?.trim();
  if (stored) return ownedHtmlToEnrichedHtml(canonicalOwnedOrEmpty(stored));

  const draftHtml = opts.draftHtml?.trim();
  if (draftHtml) {
    const owned = /<mention\b/i.test(draftHtml)
      ? enrichedHtmlToOwnedHtml(draftHtml)
      : draftHtml;
    return ownedHtmlToEnrichedHtml(canonicalOwnedOrEmpty(owned));
  }

  const draftMarkdown = opts.draftMarkdown?.trim();
  if (draftMarkdown) {
    return ownedHtmlToEnrichedHtml(
      canonicalOwnedOrEmpty(opts.markdownToHtml(draftMarkdown, opts.images ?? {})),
    );
  }

  return ownedHtmlToEnrichedHtml(EMPTY_EDITOR_HTML);
}

/**
 * Owned HTML for compact preview — same precedence as Enriched seed, without dialect mapping.
 */
export function resolveOwnedReflectionPreviewHtml(opts: {
  storedHtml?: string | null;
  draftHtml?: string | null;
  draftMarkdown?: string | null;
  images?: Record<string, string>;
  markdownToHtml: (markdown: string, images: Record<string, string>) => string;
}): string {
  const stored = opts.storedHtml?.trim();
  if (stored) return canonicalOwnedOrEmpty(stored);

  const draftHtml = opts.draftHtml?.trim();
  if (draftHtml) {
    const owned = /<mention\b/i.test(draftHtml) ? enrichedHtmlToOwnedHtml(draftHtml) : draftHtml;
    return canonicalOwnedOrEmpty(owned);
  }

  const draftMarkdown = opts.draftMarkdown?.trim();
  if (draftMarkdown) {
    return canonicalOwnedOrEmpty(opts.markdownToHtml(draftMarkdown, opts.images ?? {}));
  }

  return EMPTY_EDITOR_HTML;
}

export function isEnrichedReflectionNoOpSave(opts: {
  editorHtml: string;
  storedMarkdown: string | null | undefined;
  storedHtml: string;
}): boolean {
  if (!markdownMatches(opts.editorHtml, opts.storedMarkdown, opts.storedHtml)) return false;
  return spacerMatches(opts.editorHtml, opts.storedHtml);
}

/**
 * Dual-write plan from on-demand `getHTML()`. New entries always write (caller
 * already rejected empty reflections). Existing rows no-op when markdown matches
 * after `normalizeReflectionMarkdownForCompare`.
 */
export function planEnrichedReflectionSave(opts: {
  editorHtml: string;
  storedMarkdown: string | null | undefined;
  storedHtml: string;
  isExistingEntry: boolean;
}): EnrichedSaveContentPlan {
  const markdown = htmlToReflectionMarkdown(opts.editorHtml);
  if (opts.isExistingEntry) {
    if (
      isEnrichedReflectionNoOpSave({
        editorHtml: opts.editorHtml,
        storedMarkdown: opts.storedMarkdown,
        storedHtml: opts.storedHtml,
      })
    ) {
      return { kind: "noop" };
    }
  }

  return {
    kind: "write",
    content: canonicalizeOwnedReflectionHtml(enrichedHtmlToOwnedHtml(opts.editorHtml)),
    content_markdown: markdown,
    content_format: ENRICHED_HTML_CONTENT_FORMAT,
    editor_version: compositeEnrichedEditorVersion(),
    captureSnapshot: opts.isExistingEntry,
  };
}

export function hydrateJournalDraftReflection(
  parsed: {
    reflectionMarkdown?: unknown;
    reflectionHtml?: unknown;
    reflectionEditor?: unknown;
  },
  opts: { convertEnrichedForLegacy: boolean },
): HydratedJournalDraftReflection | null {
  const storedMarkdown =
    typeof parsed.reflectionMarkdown === "string" ? parsed.reflectionMarkdown : "";
  const storedHtml = typeof parsed.reflectionHtml === "string" ? parsed.reflectionHtml : "";
  const editor: JournalDraftEditorKind | undefined =
    parsed.reflectionEditor === "enriched-html"
      ? "enriched-html"
      : parsed.reflectionEditor === "markdown"
        ? "markdown"
        : undefined;

  const isEnrichedDraft = editor === "enriched-html" && storedHtml.length > 0;

  if (opts.convertEnrichedForLegacy && isEnrichedDraft) {
    const converted = convertEnrichedDraftHtmlForLegacy(storedHtml);
    return {
      reflectionMarkdown: converted.kind === "converted" ? converted.markdown : "",
      reflectionEditor: "markdown",
    };
  }

  if (isEnrichedDraft) {
    const preview = storedMarkdown.trim()
      ? storedMarkdown
      : (() => {
          const converted = convertEnrichedDraftHtmlForLegacy(storedHtml);
          return converted.kind === "converted" ? converted.markdown : "";
        })();
    return {
      reflectionMarkdown: preview,
      reflectionHtml: storedHtml,
      reflectionEditor: "enriched-html",
    };
  }

  if (typeof parsed.reflectionMarkdown === "string") {
    return {
      reflectionMarkdown: storedMarkdown,
      reflectionEditor: storedMarkdown ? "markdown" : undefined,
    };
  }

  if (storedHtml) {
    const converted = convertEnrichedDraftHtmlForLegacy(storedHtml);
    return {
      reflectionMarkdown: converted.kind === "converted" ? converted.markdown : "",
      reflectionEditor: "markdown",
    };
  }

  if (typeof parsed.reflectionMarkdown !== "string" && typeof parsed.reflectionHtml !== "string") {
    return null;
  }

  return { reflectionMarkdown: storedMarkdown };
}
