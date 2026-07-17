import {
  buildImageMapFromReflectionHtml,
  htmlToReflectionMarkdown,
} from "@/lib/journal-reflection-html";

export type ReflectionEditState = {
  markdown: string;
  images: Record<string, string>;
};

/** Resolve editable markdown for journal reflection (dual-write or legacy HTML). */
export function resolveReflectionMarkdownForEdit(entry: {
  content: string;
  content_markdown?: string | null;
}): ReflectionEditState {
  const images = buildImageMapFromReflectionHtml(entry.content);
  const stored = entry.content_markdown?.trim();
  if (stored) {
    return { markdown: stored, images };
  }
  return {
    markdown: htmlToReflectionMarkdown(entry.content, images),
    images,
  };
}
