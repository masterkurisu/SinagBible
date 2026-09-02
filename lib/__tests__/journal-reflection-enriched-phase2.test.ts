import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  asyncStorageMock,
  expoSqliteMock,
  getMockPreEnrichedSnapshots,
  makeJournalEntry,
  resetJournalStorageMocks,
} from "./journal-storage-mocks";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMock,
}));
vi.mock("expo-sqlite", () => expoSqliteMock);

import {
  capturePreEnrichedSnapshotOnce,
  reflectionMarkdownToContent,
  saveLocalEntry,
  updateLocalEntry,
} from "@/lib/journal-local";
import {
  JOURNAL_DRAFT_CONTENT_KEY,
  loadDefaultJournalDraft,
  registerJournalDraft,
} from "@/lib/journal-draft-index";
import { resetJournalDbStateForTests } from "@/lib/journal-db";
import {
  convertEnrichedDraftHtmlForLegacy,
  hydrateJournalDraftReflection,
  isEnrichedReflectionNoOpSave,
  planEnrichedReflectionSave,
  resolveEnrichedSeedHtml,
} from "@/lib/journal-reflection-enriched-session";
import {
  ENRICHED_HTML_CONTENT_FORMAT,
  ENRICHED_HTML_LIBRARY_PIN,
  REFLECTION_MARKDOWN_CONVERTER_REVISION,
  compositeEnrichedEditorVersion,
  shouldMountLegacyReflectionEditor,
} from "@/lib/journal-reflection-legacy-route";

describe("shouldMountLegacyReflectionEditor", () => {
  it("routes nested lists and screen readers to legacy before any Enriched mount", () => {
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

describe("compositeEnrichedEditorVersion", () => {
  it("combines the library pin and converter revision", () => {
    expect(compositeEnrichedEditorVersion()).toBe(
      `enriched-html@${ENRICHED_HTML_LIBRARY_PIN}+md${REFLECTION_MARKDOWN_CONVERTER_REVISION}`,
    );
  });
});

describe("resolveEnrichedSeedHtml", () => {
  it("prefers stored edit HTML, then draft HTML, then markdown, then empty", () => {
    const markdownToHtml = reflectionMarkdownToContent;
    expect(
      resolveEnrichedSeedHtml({
        storedHtml: "<p>Stored</p>",
        draftHtml: "<p>Draft</p>",
        draftMarkdown: "ignored",
        markdownToHtml,
      }),
    ).toBe("<p>Stored</p>");
    expect(
      resolveEnrichedSeedHtml({
        draftHtml: "<p>Draft</p>",
        draftMarkdown: "**bold**",
        markdownToHtml,
      }),
    ).toBe("<p>Draft</p>");
    expect(resolveEnrichedSeedHtml({ draftMarkdown: "**bold**", markdownToHtml })).toBe(
      "<p><strong>bold</strong></p>",
    );
    expect(resolveEnrichedSeedHtml({ markdownToHtml })).toBe("<p></p>");
  });

  it("maps owned verse spans and checklists into the Enriched seed dialect", () => {
    const markdownToHtml = reflectionMarkdownToContent;
    expect(
      resolveEnrichedSeedHtml({
        storedHtml: '<p>See <span data-verse-ref="john:3:16">John 3:16</span> today.</p>',
        markdownToHtml,
      }),
    ).toBe(
      '<p>See <mention indicator="@" text="John 3:16" data-verse-ref="john:3:16">John 3:16</mention> today.</p>',
    );
    expect(
      resolveEnrichedSeedHtml({
        storedHtml:
          '<ul data-checklist="true"><li data-checked="false">☐ todo one</li><li data-checked="true">☑ done one</li></ul>',
        markdownToHtml,
      }),
    ).toBe('<ul data-type="checkbox"><li>todo one</li><li checked>done one</li></ul>');
  });
});

describe("isEnrichedReflectionNoOpSave", () => {
  it("compares against stored markdown when present", () => {
    expect(
      isEnrichedReflectionNoOpSave({
        editorHtml: "<p>Hello world</p>",
        storedMarkdown: "Hello world",
        storedHtml: "<p>ignored</p>",
      }),
    ).toBe(true);
    expect(
      isEnrichedReflectionNoOpSave({
        editorHtml: "<p>Hello world</p>",
        storedMarkdown: "Different",
        storedHtml: "<p>Hello world</p>",
      }),
    ).toBe(false);
  });

  it("uses stored HTML through one converter when markdown is null", () => {
    expect(
      isEnrichedReflectionNoOpSave({
        editorHtml: "<p>Hello world</p>",
        storedMarkdown: null,
        storedHtml: "<p>Hello world</p>",
      }),
    ).toBe(true);
  });

  it("treats whitespace-only diffs as no-op after normalize", () => {
    expect(
      isEnrichedReflectionNoOpSave({
        editorHtml: "<p>Hello world</p>",
        storedMarkdown: "Hello world  \n\n",
        storedHtml: "<p>Hello world</p>",
      }),
    ).toBe(true);
  });

  it("no-ops when only leading/trailing blanks differ after canonical seed", () => {
    expect(
      isEnrichedReflectionNoOpSave({
        editorHtml: "<p>Hello</p>",
        storedMarkdown: "Hello",
        storedHtml: "<p></p><p>Hello</p><p><br></p>",
      }),
    ).toBe(true);
  });

  it("writes when interior blank spacing changes even if markdown matches", () => {
    expect(
      isEnrichedReflectionNoOpSave({
        editorHtml: `<p>Hello</p><p></p><p></p><p>World</p>`,
        storedMarkdown: "Hello\n\nWorld",
        storedHtml: `<p>Hello</p><p></p><p>World</p>`,
      }),
    ).toBe(false);
  });
});

describe("planEnrichedReflectionSave", () => {
  it("no-ops existing rows that match stored markdown", () => {
    expect(
      planEnrichedReflectionSave({
        editorHtml: "<p>Hello</p>",
        storedMarkdown: "Hello",
        storedHtml: "<p>Hello</p>",
        isExistingEntry: true,
      }),
    ).toEqual({ kind: "noop" });
  });

  it("no-ops open-with-no-edits when interior blank spacing matches", () => {
    expect(
      planEnrichedReflectionSave({
        editorHtml: `<p>Hello</p><p></p><p></p><p>World</p>`,
        storedMarkdown: "Hello\n\nWorld",
        storedHtml: `<p>Hello</p><p></p><p></p><p>World</p>`,
        isExistingEntry: true,
      }),
    ).toEqual({ kind: "noop" });
  });

  it("writes when interior blank spacing increases", () => {
    const plan = planEnrichedReflectionSave({
      editorHtml: `<p>Hello</p><p></p><p></p><p>World</p>`,
      storedMarkdown: "Hello\n\nWorld",
      storedHtml: `<p>Hello</p><p></p><p>World</p>`,
      isExistingEntry: true,
    });
    expect(plan.kind).toBe("write");
  });

  it("no-ops untouched legacy rows without stamping format fields", () => {
    expect(
      planEnrichedReflectionSave({
        editorHtml: "<p>Original</p>",
        storedMarkdown: "Original",
        storedHtml: "<p>Original</p>",
        isExistingEntry: true,
      }),
    ).toEqual({ kind: "noop" });
  });

  it("canonicalizes owned HTML on write", () => {
    const plan = planEnrichedReflectionSave({
      editorHtml: `<p>Changed</p><p></p>`,
      storedMarkdown: "Hello",
      storedHtml: "<p>Hello</p>",
      isExistingEntry: true,
    });
    expect(plan.kind).toBe("write");
    if (plan.kind !== "write") return;
    expect(plan.content).toBe("<p>Changed</p>");
  });

  it("stamps format fields and asks for a snapshot on a real existing-id edit", () => {
    const plan = planEnrichedReflectionSave({
      editorHtml: "<p>Changed</p>",
      storedMarkdown: "Hello",
      storedHtml: "<p>Hello</p>",
      isExistingEntry: true,
    });
    expect(plan.kind).toBe("write");
    if (plan.kind !== "write") return;
    expect(plan.content).toBe("<p>Changed</p>");
    expect(plan.content_markdown).toBe("Changed");
    expect(plan.content_format).toBe(ENRICHED_HTML_CONTENT_FORMAT);
    expect(plan.editor_version).toBe(compositeEnrichedEditorVersion());
    expect(plan.captureSnapshot).toBe(true);
  });

  it("writes new entries without a snapshot", () => {
    const plan = planEnrichedReflectionSave({
      editorHtml: "<p>New note</p>",
      storedMarkdown: null,
      storedHtml: "",
      isExistingEntry: false,
    });
    expect(plan.kind).toBe("write");
    if (plan.kind !== "write") return;
    expect(plan.captureSnapshot).toBe(false);
  });

  it("dual-writes owned HTML for mentions and native checklists", () => {
    const mentionPlan = planEnrichedReflectionSave({
      editorHtml:
        '<p>See <mention indicator="@" text="John 3:16" data-verse-ref="john:3:16">John 3:16</mention> today.</p>',
      storedMarkdown: "Hello",
      storedHtml: "<p>Hello</p>",
      isExistingEntry: true,
    });
    expect(mentionPlan.kind).toBe("write");
    if (mentionPlan.kind !== "write") return;
    expect(mentionPlan.content).toBe(
      '<p>See <span data-verse-ref="john:3:16">John 3:16</span> today.</p>',
    );
    expect(mentionPlan.content_markdown).toBe("See [@john:3:16] today.");

    const checklistPlan = planEnrichedReflectionSave({
      editorHtml: '<ul data-type="checkbox"><li>todo one</li><li checked>done one</li></ul>',
      storedMarkdown: "Hello",
      storedHtml: "<p>Hello</p>",
      isExistingEntry: true,
    });
    expect(checklistPlan.kind).toBe("write");
    if (checklistPlan.kind !== "write") return;
    expect(checklistPlan.content).toBe(
      '<ul data-checklist="true"><li data-checked="false">☐ todo one</li><li data-checked="true">☑ done one</li></ul>',
    );
    expect(checklistPlan.content_markdown).toBe("- [ ] todo one\n- [x] done one");
  });
});

describe("convertEnrichedDraftHtmlForLegacy", () => {
  it("converts Enriched HTML into legacy markdown", () => {
    expect(convertEnrichedDraftHtmlForLegacy("<p><strong>bold</strong></p>")).toEqual({
      kind: "converted",
      markdown: "**bold**",
    });
    expect(
      convertEnrichedDraftHtmlForLegacy(
        '<p>See <mention indicator="@" text="John 3:16" data-verse-ref="john:3:16">John 3:16</mention></p>',
      ),
    ).toEqual({ kind: "converted", markdown: "See [@john:3:16]" });
    expect(
      convertEnrichedDraftHtmlForLegacy(
        '<ul data-type="checkbox"><li>todo one</li><li checked>done one</li></ul>',
      ),
    ).toEqual({ kind: "converted", markdown: "- [ ] todo one\n- [x] done one" });
  });

  it("discards when conversion is empty", () => {
    expect(convertEnrichedDraftHtmlForLegacy("<p></p>")).toEqual({
      kind: "discarded",
      reason: "empty",
    });
    expect(convertEnrichedDraftHtmlForLegacy("   ")).toEqual({
      kind: "discarded",
      reason: "empty",
    });
  });

  it("discards when conversion throws", () => {
    expect(
      convertEnrichedDraftHtmlForLegacy("<p>keep me</p>", () => {
        throw new Error("converter failed");
      }),
    ).toEqual({ kind: "discarded", reason: "threw" });
  });
});

describe("hydrateJournalDraftReflection", () => {
  it("converts Enriched drafts on kill and omits HTML so legacy never mounts it", () => {
    expect(
      hydrateJournalDraftReflection(
        {
          reflectionMarkdown: "stale",
          reflectionHtml: "<p><em>kept</em></p>",
          reflectionEditor: "enriched-html",
        },
        { convertEnrichedForLegacy: true },
      ),
    ).toEqual({
      reflectionMarkdown: "_kept_",
      reflectionEditor: "markdown",
    });
  });

  it("discards the body on kill when conversion is empty, keeping the draft shell", () => {
    expect(
      hydrateJournalDraftReflection(
        {
          reflectionMarkdown: "stale",
          reflectionHtml: "<p></p>",
          reflectionEditor: "enriched-html",
        },
        { convertEnrichedForLegacy: true },
      ),
    ).toEqual({
      reflectionMarkdown: "",
      reflectionEditor: "markdown",
    });
  });

  it("migrates html-only Pell drafts to markdown instead of treating them as Enriched", () => {
    expect(
      hydrateJournalDraftReflection(
        { reflectionHtml: "<p>old pell</p>" },
        { convertEnrichedForLegacy: false },
      ),
    ).toEqual({
      reflectionMarkdown: "old pell",
      reflectionEditor: "markdown",
    });
  });

  it("keeps HTML for the Enriched seed when the kill switch is on", () => {
    expect(
      hydrateJournalDraftReflection(
        {
          reflectionMarkdown: "_kept_",
          reflectionHtml: "<p><em>kept</em></p>",
          reflectionEditor: "enriched-html",
        },
        { convertEnrichedForLegacy: false },
      ),
    ).toEqual({
      reflectionMarkdown: "_kept_",
      reflectionHtml: "<p><em>kept</em></p>",
      reflectionEditor: "enriched-html",
    });
  });
});

describe("loadDefaultJournalDraft kill/resume", () => {
  beforeEach(() => {
    resetJournalStorageMocks();
  });

  it("converts an Enriched draft when asked to hydrate for legacy", async () => {
    await registerJournalDraft(
      "default",
      JSON.stringify({
        passage: "John 3:16",
        title: "Draft",
        reflectionMarkdown: "stale",
        reflectionHtml: "<p>From Enriched</p>",
        reflectionEditor: "enriched-html",
        journalTranslationId: "KJV",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const draft = await loadDefaultJournalDraft({ convertEnrichedForLegacy: true });
    expect(draft?.reflectionMarkdown).toBe("From Enriched");
    expect(draft?.reflectionHtml).toBeUndefined();
    expect(draft?.reflectionEditor).toBe("markdown");
    expect(draft?.passage).toBe("John 3:16");
  });

  it("discards only the reflection body when conversion is empty", async () => {
    await registerJournalDraft(
      "default",
      JSON.stringify({
        passage: "John 3:16",
        title: "Keep title",
        reflectionMarkdown: "stale",
        reflectionHtml: "<p></p>",
        reflectionEditor: "enriched-html",
        journalTranslationId: "KJV",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const draft = await loadDefaultJournalDraft({ convertEnrichedForLegacy: true });
    expect(draft?.title).toBe("Keep title");
    expect(draft?.reflectionMarkdown).toBe("");
  });
});

describe("capturePreEnrichedSnapshotOnce", () => {
  beforeEach(async () => {
    resetJournalStorageMocks();
    await resetJournalDbStateForTests();
  });

  it("writes the current row once and ignores a second capture", async () => {
    const saved = await saveLocalEntry({
      book: "john",
      chapter: 3,
      verse_start: 16,
      verse_end: null,
      bible_translation: "KJV",
      title: "First",
      content: "<p>Original</p>",
      content_markdown: "Original",
      is_favorite: false,
      tags: [],
    });

    const first = await capturePreEnrichedSnapshotOnce({
      id: saved.id,
      content: saved.content,
      content_markdown: saved.content_markdown ?? null,
    });
    const second = await capturePreEnrichedSnapshotOnce({
      id: saved.id,
      content: "<p>Should not replace</p>",
      content_markdown: "nope",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    const row = getMockPreEnrichedSnapshots().get(saved.id);
    expect(row?.content).toBe("<p>Original</p>");
    expect(row?.content_markdown).toBe("Original");
  });

  it("stamps content_format and editor_version on a real Enriched update", async () => {
    vi.stubGlobal("__DEV__", false);
    const saved = await saveLocalEntry({
      book: "john",
      chapter: 3,
      verse_start: 16,
      verse_end: null,
      bible_translation: "KJV",
      title: "First",
      content: "<p>Original</p>",
      content_markdown: "Original",
      is_favorite: false,
      tags: [],
    });
    const updated = await updateLocalEntry(saved.id, {
      content: "<p>Edited</p>",
      content_markdown: "Edited",
      content_format: ENRICHED_HTML_CONTENT_FORMAT,
      editor_version: compositeEnrichedEditorVersion(),
    });
    expect(updated?.content_format).toBe(ENRICHED_HTML_CONTENT_FORMAT);
    expect(updated?.editor_version).toBe(compositeEnrichedEditorVersion());
    expect(updated?.content).toBe("<p>Edited</p>");
  });
});

describe("JOURNAL_DRAFT_CONTENT_KEY", () => {
  it("stays the default draft storage key", () => {
    expect(JOURNAL_DRAFT_CONTENT_KEY).toBe("sinagbible_journal_draft");
  });
});

describe("makeJournalEntry format columns", () => {
  it("defaults new format columns to undefined so unmarked rows stay unmarked", () => {
    const entry = makeJournalEntry({ id: "local-1" });
    expect(entry.content_format).toBeUndefined();
    expect(entry.editor_version).toBeUndefined();
  });
});
