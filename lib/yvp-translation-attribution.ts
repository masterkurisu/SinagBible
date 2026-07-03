import { canonicalTranslationId } from "@/lib/canonical-translation-id";
import { isChapterDbOpen } from "@/lib/chapter-db";
import { getTranslationMetaSync, type TranslationMeta } from "@/lib/chapter-store";
import { isYvpTranslationId, parseYvpBibleId } from "@/lib/youversion-api";

/** Licensed Biblica translations pinned by default (NIV, ASD). */
const BIBLICA_YVP_BIBLE_IDS = new Set([111, 1264]);

export const BIBLICA_PUBLISHER_URL = "https://www.biblica.com/";

export type YvpTranslationAttribution = {
  copyrightNotice: string | null;
  trademarkNotice: string | null;
  publisherUrl: string | null;
  showBiblicaLink: boolean;
};

export function yvpTranslationShowsBiblicaLink(
  translationId: string,
  copyrightNotice?: string | null,
): boolean {
  const bibleId = parseYvpBibleId(translationId);
  if (bibleId != null && BIBLICA_YVP_BIBLE_IDS.has(bibleId)) return true;
  return (copyrightNotice ?? "").toLowerCase().includes("biblica");
}

export function translationMetaToYvpAttribution(
  translationId: string,
  meta: TranslationMeta,
): YvpTranslationAttribution {
  const copyrightNotice = meta.copyrightNotice?.trim() || null;
  const trademarkNotice = meta.trademarkNotice?.trim() || null;
  const showBiblicaLink = yvpTranslationShowsBiblicaLink(translationId, copyrightNotice);

  return {
    copyrightNotice,
    trademarkNotice,
    publisherUrl: showBiblicaLink ? BIBLICA_PUBLISHER_URL : null,
    showBiblicaLink,
  };
}

export function loadYvpTranslationAttribution(
  translationId: string,
): YvpTranslationAttribution | null {
  if (!isYvpTranslationId(translationId) || !isChapterDbOpen()) return null;

  const meta = getTranslationMetaSync(canonicalTranslationId(translationId));
  if (!meta) return null;

  return translationMetaToYvpAttribution(translationId, meta);
}
