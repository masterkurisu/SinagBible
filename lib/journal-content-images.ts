/**
 * Stores journal reflection images on disk instead of embedding base64 in AsyncStorage.
 */

import {
  deleteAsync,
  documentDirectory,
  EncodingType,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";

const JOURNAL_IMAGES_ROOT = "journal-images";

const DATA_URL_IMG_RE =
  /<img\b([^>]*)\bsrc=(["'])(data:image\/[^"']+)\2([^>]*)>/gi;

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:(image\/[^;]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function extensionForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function sanitizeEntryId(entryId: string): string {
  return entryId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function entryImageDir(entryId: string): string | null {
  if (!documentDirectory) return null;
  return `${documentDirectory}${JOURNAL_IMAGES_ROOT}/${sanitizeEntryId(entryId)}/`;
}

function journalImagesRootDir(): string | null {
  if (!documentDirectory) return null;
  return `${documentDirectory}${JOURNAL_IMAGES_ROOT}/`;
}

async function ensureEntryImageDir(entryId: string): Promise<string | null> {
  const dir = entryImageDir(entryId);
  if (!dir) return null;
  await makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

function referencedImagePaths(content: string): Set<string> {
  const paths = new Set<string>();
  const srcRe = /<img\b[^>]*\bsrc=(["'])([^"']+)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRe.exec(content)) !== null) {
    const src = match[2]?.trim();
    if (!src || src.startsWith("data:image/")) continue;
    paths.add(src);
    if (src.startsWith("file://")) {
      paths.add(src.slice("file://".length));
    } else {
      paths.add(`file://${src}`);
    }
  }
  return paths;
}

async function pruneOrphanImages(entryId: string, content: string): Promise<void> {
  const dir = entryImageDir(entryId);
  if (!dir) return;

  let files: string[] = [];
  try {
    files = await readDirectoryAsync(dir);
  } catch {
    return;
  }

  const referenced = referencedImagePaths(content);
  await Promise.all(
    files.map(async (fileName) => {
      const fullPath = `${dir}${fileName}`;
      const fileUri = fullPath.startsWith("file://") ? fullPath : `file://${fullPath}`;
      if (referenced.has(fullPath) || referenced.has(fileUri) || referenced.has(fileName)) return;
      await deleteAsync(fullPath, { idempotent: true }).catch(() => {});
    }),
  );
}

/** Replace embedded data-URL images with on-disk file URIs before persisting entry content. */
export async function externalizeContentImages(content: string, entryId: string): Promise<string> {
  if (!/data:image\//i.test(content)) {
    await pruneOrphanImages(entryId, content);
    return content;
  }

  const dir = await ensureEntryImageDir(entryId);
  if (!dir) return content;

  const chunks: string[] = [];
  let lastIndex = 0;
  let imageIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(DATA_URL_IMG_RE.source, DATA_URL_IMG_RE.flags);

  while ((match = re.exec(content)) !== null) {
    chunks.push(content.slice(lastIndex, match.index));
    const dataUrl = match[3] ?? "";
    const parsed = parseDataUrl(dataUrl);

    if (!parsed) {
      chunks.push(match[0]);
    } else {
      const ext = extensionForMime(parsed.mime);
      const filePath = `${dir}img-${imageIndex++}.${ext}`;
      await writeAsStringAsync(filePath, parsed.base64, { encoding: EncodingType.Base64 });
      const fileUri = filePath.startsWith("file://") ? filePath : `file://${filePath}`;
      chunks.push(`<img${match[1] ?? ""}src="${escapeXmlAttr(fileUri)}"${match[4] ?? ""}>`);
    }

    lastIndex = match.index + match[0].length;
  }

  chunks.push(content.slice(lastIndex));
  const next = chunks.join("");
  await pruneOrphanImages(entryId, next);
  return next;
}

export async function externalizeEntryImages(
  entry: { id: string; content: string },
): Promise<{ id: string; content: string; changed: boolean }> {
  const content = await externalizeContentImages(entry.content, entry.id);
  return { ...entry, content, changed: content !== entry.content };
}

/** Remove all image files stored for a journal entry. */
export async function deleteEntryImages(entryId: string): Promise<void> {
  const dir = entryImageDir(entryId);
  if (!dir) return;
  await deleteAsync(dir, { idempotent: true }).catch(() => {});
}

/** Remove every on-disk journal image (used by delete-my-data). */
export async function deleteAllJournalImages(): Promise<void> {
  const root = journalImagesRootDir();
  if (!root) return;
  await deleteAsync(root, { idempotent: true }).catch(() => {});
}

const EXPORT_IMG_SRC_RE =
  /<img\b([^>]*)\bsrc=(["'])([^"']+)\2([^>]*)>/gi;

function mimeFromImagePath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Embeds on-disk journal images as data URLs so backups are portable across devices. */
export async function inlineContentImagesForExport(content: string): Promise<string> {
  if (!/<img\b/i.test(content)) return content;

  const chunks: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EXPORT_IMG_SRC_RE.source, EXPORT_IMG_SRC_RE.flags);

  while ((match = re.exec(content)) !== null) {
    chunks.push(content.slice(lastIndex, match.index));
    const src = match[3]?.trim() ?? "";
    let replacement = match[0];

    if (src && !src.startsWith("data:image/")) {
      const fileUri = src.startsWith("file://") ? src : `file://${src}`;
      try {
        const base64 = await readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
        const dataUrl = `data:${mimeFromImagePath(src)};base64,${base64}`;
        replacement = `<img${match[1] ?? ""}src="${escapeXmlAttr(dataUrl)}"${match[4] ?? ""}>`;
      } catch {
        /* keep original src when the file is missing */
      }
    }

    chunks.push(replacement);
    lastIndex = match.index + match[0].length;
  }

  chunks.push(content.slice(lastIndex));
  return chunks.join("");
}
