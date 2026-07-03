import {
  isBundledFeaturedTranslationId,
  isTranslationId,
} from "@sinag-bible/core/bible-translations";
import { canonicalTranslationId } from "@/lib/canonical-translation-id";
import { isChapterDbOpen } from "@/lib/chapter-db";
import { getTranslationMetaSync } from "@/lib/chapter-store";
import { isYvpTranslationId } from "@/lib/youversion-api";

/** Bundled translations shipped in the app — always available offline. */
const LOCAL_BUNDLED_TRANSLATION_IDS = new Set(["KJV", "WEB", "OEB", "ADB1905"]);

export type TranslationOfflinePolicy =
  | "bundled"
  | "cache_as_you_read"
  | "downloadable";

export function isLocalBundledTranslation(translationId: string): boolean {
  const canonical = canonicalTranslationId(translationId);
  if (isTranslationId(canonical) && LOCAL_BUNDLED_TRANSLATION_IDS.has(canonical)) {
    return true;
  }
  return isBundledFeaturedTranslationId(translationId);
}

export function getTranslationOfflinePolicy(translationId: string): TranslationOfflinePolicy {
  if (isLocalBundledTranslation(translationId)) return "bundled";
  if (isYvpTranslationId(translationId)) return "cache_as_you_read";
  return "downloadable";
}

export function supportsFullTranslationDownload(translationId: string): boolean {
  return getTranslationOfflinePolicy(translationId) === "downloadable";
}

export function isTranslationFullyDownloaded(translationId: string): boolean {
  if (!isChapterDbOpen()) return false;
  if (isLocalBundledTranslation(translationId)) return true;
  const meta = getTranslationMetaSync(canonicalTranslationId(translationId));
  return meta?.fullyDownloaded === true;
}

/** Subtitle copy for the translation picker offline row. */
export function translationOfflineStatusLabel(translationId: string): string | null {
  const policy = getTranslationOfflinePolicy(translationId);
  if (policy === "bundled") return "Included with the app";
  if (policy === "cache_as_you_read") return "Available offline as you read";
  if (isTranslationFullyDownloaded(translationId)) return "Downloaded for offline use";
  return null;
}
