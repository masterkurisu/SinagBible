import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import {
  getPexelsKeywordsForImageTheme,
  getPexelsSearchKeywordForImageTheme,
  usesCarouselPhotoBackground,
  type CarouselImageTheme,
} from "@/lib/carousel-image-themes";
import { loadJournalCarouselSettings } from "@/lib/journal-carousel-settings";
import { searchPexelsImages } from "@/lib/pexels-api";
import {
  getPexelsSearchKeywordForVerse,
  getPexelsSearchKeywords,
  keywordPoolStorageSlug,
  type CarouselImageCategory,
} from "@/lib/pexels-image-mapper";

/** Minimum unique image URLs kept cached across keyword pools. */
export const CAROUSEL_IMAGE_POOL_TARGET = 30;

const POOL_FETCH_PER_PAGE = 20;
const CARD_STORAGE_PREFIX = "sb:pexels:card:v2:";
const CARD_STORAGE_PREFIX_V3 = "sb:pexels:card:v3:";
const POOL_STORAGE_PREFIX = "sb:pexels:pool:v2:";

type KeywordPool = {
  urls: string[];
  nextPage: number;
};

type CarouselVerseRef = {
  id: string;
  imageCategory: CarouselImageCategory;
};

const pendingPoolFetches = new Map<string, Promise<string[]>>();
const sessionCardUrlByVerseId = new Map<string, string>();
const sessionResolvedByVersesKey = new Map<string, Record<string, string>>();
const warmedKeywordSets = new Set<string>();
const imageRefreshListeners = new Set<(urlsByVerseId: Record<string, string>) => void>();
const verseConsumers = new Map<number, readonly CarouselVerseRef[]>();
let nextVerseConsumerId = 0;

export function registerCarouselVerseConsumer(
  verses: readonly CarouselVerseRef[],
): { id: number; update: (next: readonly CarouselVerseRef[]) => void; unregister: () => void } {
  const id = ++nextVerseConsumerId;
  verseConsumers.set(id, verses);
  return {
    id,
    update: (next) => {
      verseConsumers.set(id, next);
    },
    unregister: () => {
      verseConsumers.delete(id);
    },
  };
}

function collectActiveCarouselVerses(): CarouselVerseRef[] {
  const byId = new Map<string, CarouselVerseRef>();
  for (const verses of verseConsumers.values()) {
    for (const verse of verses) {
      byId.set(verse.id, verse);
    }
  }
  return [...byId.values()];
}

export function subscribeCarouselImageRefresh(
  listener: (urlsByVerseId: Record<string, string>) => void,
): () => void {
  imageRefreshListeners.add(listener);
  return () => imageRefreshListeners.delete(listener);
}

function notifyCarouselImageRefresh(urlsByVerseId: Record<string, string>): void {
  for (const listener of imageRefreshListeners) {
    listener(urlsByVerseId);
  }
}

export async function requestCarouselImageRefresh(
  imageTheme?: CarouselImageTheme,
): Promise<Record<string, string>> {
  const verses = collectActiveCarouselVerses();
  if (verses.length === 0) return {};

  const theme = imageTheme ?? (await loadJournalCarouselSettings()).imageTheme;
  const result = await refreshCarouselBackgroundUrls(verses, theme);
  notifyCarouselImageRefresh(result);
  return result;
}

export function buildCarouselVersesKey(
  verses: readonly CarouselVerseRef[],
  imageTheme: CarouselImageTheme = "auto",
): string {
  const base = verses.map((verse) => `${verse.id}:${verse.imageCategory}`).join("|");
  return `${base}@theme=${imageTheme}`;
}

function cardAssignmentCacheKey(verseId: string, assignmentKey: string): string {
  return `${verseId}:${assignmentKey}`;
}

function resolveAssignmentKey(imageTheme: CarouselImageTheme, verse: CarouselVerseRef): string {
  if (imageTheme === "auto") return verse.imageCategory;
  return imageTheme;
}

/** Synchronous session cache — avoids URL flash when revisiting the journal tab. */
export function getCarouselBackgroundUrlSession(
  verses: readonly CarouselVerseRef[],
  imageTheme: CarouselImageTheme = "auto",
): Record<string, string> | null {
  if (verses.length === 0) return null;
  if (!usesCarouselPhotoBackground(imageTheme)) return {};

  const key = buildCarouselVersesKey(verses, imageTheme);
  const resolved = sessionResolvedByVersesKey.get(key);
  if (resolved && verses.every((verse) => resolved[verse.id])) {
    return resolved;
  }

  const fromCards: Record<string, string> = {};
  for (const verse of verses) {
    const assignmentKey = resolveAssignmentKey(imageTheme, verse);
    const url = sessionCardUrlByVerseId.get(cardAssignmentCacheKey(verse.id, assignmentKey));
    if (!url) return null;
    fromCards[verse.id] = url;
  }
  return fromCards;
}

function rememberSessionUrls(versesKey: string, urls: Record<string, string>): void {
  sessionResolvedByVersesKey.set(versesKey, urls);
}

function poolStorageKey(keyword: string): string {
  return `${POOL_STORAGE_PREFIX}${keywordPoolStorageSlug(keyword)}`;
}

function cardStorageKey(verseId: string, assignmentKey: string): string {
  return `${CARD_STORAGE_PREFIX_V3}${verseId}:${assignmentKey}`;
}

async function loadKeywordPool(keyword: string): Promise<KeywordPool> {
  try {
    const raw = await AsyncStorage.getItem(poolStorageKey(keyword));
    if (raw) {
      const parsed = JSON.parse(raw) as KeywordPool;
      if (Array.isArray(parsed.urls) && typeof parsed.nextPage === "number") {
        return {
          urls: [...new Set(parsed.urls.filter((url) => typeof url === "string" && url.length > 0))],
          nextPage: Math.max(1, parsed.nextPage),
        };
      }
    }
  } catch {
    /* fall through */
  }

  return { urls: [], nextPage: 1 };
}

async function saveKeywordPool(keyword: string, pool: KeywordPool): Promise<void> {
  try {
    await AsyncStorage.setItem(
      poolStorageKey(keyword),
      JSON.stringify({
        urls: [...new Set(pool.urls)],
        nextPage: pool.nextPage,
      }),
    );
  } catch {
    /* ignore */
  }
}

async function getCardAssignment(verseId: string, assignmentKey: string): Promise<string | null> {
  const cacheKey = cardAssignmentCacheKey(verseId, assignmentKey);
  const sessionUrl = sessionCardUrlByVerseId.get(cacheKey);
  if (sessionUrl) return sessionUrl;

  try {
    const url = await AsyncStorage.getItem(cardStorageKey(verseId, assignmentKey));
    const trimmed = url?.trim() || null;
    if (trimmed) {
      sessionCardUrlByVerseId.set(cacheKey, trimmed);
      return trimmed;
    }

    const legacy = await AsyncStorage.getItem(`${CARD_STORAGE_PREFIX}${verseId}`);
    const legacyTrimmed = legacy?.trim() || null;
    if (legacyTrimmed) {
      sessionCardUrlByVerseId.set(cacheKey, legacyTrimmed);
      return legacyTrimmed;
    }
  } catch {
    return null;
  }

  return null;
}

async function saveCardAssignment(
  verseId: string,
  assignmentKey: string,
  url: string,
): Promise<void> {
  const cacheKey = cardAssignmentCacheKey(verseId, assignmentKey);
  sessionCardUrlByVerseId.set(cacheKey, url);
  try {
    await AsyncStorage.setItem(cardStorageKey(verseId, assignmentKey), url);
  } catch {
    /* ignore */
  }
}

async function fetchNextPoolPage(keyword: string): Promise<string[]> {
  const poolKey = keywordPoolStorageSlug(keyword);
  const pending = pendingPoolFetches.get(poolKey);
  if (pending) return pending;

  const promise = (async () => {
    const pool = await loadKeywordPool(keyword);
    const fetched = await searchPexelsImages(keyword, {
      page: pool.nextPage,
      perPage: POOL_FETCH_PER_PAGE,
    });

    const existing = new Set(pool.urls);
    const added = fetched.filter((url) => !existing.has(url));

    pool.urls.push(...added);
    pool.nextPage = fetched.length > 0 ? pool.nextPage + 1 : pool.nextPage;
    await saveKeywordPool(keyword, pool);

    return added;
  })().finally(() => {
    pendingPoolFetches.delete(poolKey);
  });

  pendingPoolFetches.set(poolKey, promise);
  return promise;
}

function keywordsForCategory(category: CarouselImageCategory, verseId: string): string[] {
  const primary = getPexelsSearchKeywordForVerse(category, verseId);
  const rest = getPexelsSearchKeywords(category).filter((keyword) => keyword !== primary);
  return [primary, ...rest];
}

async function allocateUniqueUrl(
  category: CarouselImageCategory,
  verseId: string,
  usedUrls: Set<string>,
  fallbackCategories: CarouselImageCategory[],
): Promise<string | null> {
  const categoriesToTry = [category, ...fallbackCategories.filter((c) => c !== category)];

  for (const candidateCategory of categoriesToTry) {
    for (const keyword of keywordsForCategory(candidateCategory, verseId)) {
      const url = await allocateUniqueUrlFromKeyword(keyword, usedUrls);
      if (url) return url;
    }
  }

  return null;
}

async function allocateUniqueUrlFromKeyword(
  keyword: string,
  usedUrls: Set<string>,
): Promise<string | null> {
  let pool = await loadKeywordPool(keyword);

  for (let attempt = 0; attempt < 6; attempt++) {
    const unused = pool.urls.find((url) => !usedUrls.has(url));
    if (unused) return unused;

    const added = await fetchNextPoolPage(keyword);
    if (added.length === 0) break;

    pool = await loadKeywordPool(keyword);
  }

  return null;
}

async function allocateUniqueUrlFromImageTheme(
  imageTheme: CarouselImageTheme,
  verseId: string,
  usedUrls: Set<string>,
): Promise<string | null> {
  const keywords = getPexelsKeywordsForImageTheme(imageTheme);
  if (!keywords) return null;

  const primary = getPexelsSearchKeywordForImageTheme(imageTheme, verseId);
  const ordered = primary
    ? [primary, ...keywords.filter((keyword) => keyword !== primary)]
    : [...keywords];

  for (const keyword of ordered) {
    const url = await allocateUniqueUrlFromKeyword(keyword, usedUrls);
    if (url) return url;
  }

  return null;
}

function collectKeywordsForCategories(categories: readonly CarouselImageCategory[]): string[] {
  const keywords = new Set<string>();
  for (const category of categories) {
    for (const keyword of getPexelsSearchKeywords(category)) {
      keywords.add(keyword);
    }
  }
  return [...keywords];
}

function collectKeywordsForImageTheme(
  imageTheme: CarouselImageTheme,
  verses: readonly CarouselVerseRef[],
): string[] {
  if (imageTheme === "auto") {
    const categories = [...new Set(verses.map((verse) => verse.imageCategory))];
    return collectKeywordsForCategories(categories);
  }

  const keywords = getPexelsKeywordsForImageTheme(imageTheme);
  return keywords ? [...keywords] : [];
}

type ResolveCarouselBackgroundOptions = {
  excludeUrls?: Iterable<string>;
  imageTheme?: CarouselImageTheme;
};

/**
 * Assigns a unique background URL to each visible carousel card.
 * Persists per-verse assignments so the same card keeps its image across sessions.
 */
export async function resolveCarouselBackgroundUrls(
  verses: readonly CarouselVerseRef[],
  options?: ResolveCarouselBackgroundOptions,
): Promise<Record<string, string>> {
  if (verses.length === 0) return {};

  const imageTheme = options?.imageTheme ?? "auto";
  if (!usesCarouselPhotoBackground(imageTheme)) return {};

  const versesKey = buildCarouselVersesKey(verses, imageTheme);
  const session = options?.excludeUrls ? null : getCarouselBackgroundUrlSession(verses, imageTheme);
  if (session) return session;

  const usedUrls = new Set<string>(options?.excludeUrls ?? []);
  const result: Record<string, string> = {};
  const categories = [...new Set(verses.map((verse) => verse.imageCategory))];
  const keywords = collectKeywordsForImageTheme(imageTheme, verses);
  const keywordsKey = `${imageTheme}|${keywords.join("|")}`;
  const fallbackCategories: CarouselImageCategory[] = [
    ...categories,
    "default",
    "daily-verse",
    "psalms-proverbs",
    "gospels",
    "ot-narrative",
    "epistles",
    "revelation",
  ];

  for (const verse of verses) {
    const assignmentKey = resolveAssignmentKey(imageTheme, verse);
    let url = options?.excludeUrls ? null : await getCardAssignment(verse.id, assignmentKey);
    if (url && usedUrls.has(url)) url = null;

    if (!url) {
      url =
        imageTheme === "auto"
          ? await allocateUniqueUrl(verse.imageCategory, verse.id, usedUrls, fallbackCategories)
          : await allocateUniqueUrlFromImageTheme(imageTheme, verse.id, usedUrls);
    }

    if (url) {
      result[verse.id] = url;
      usedUrls.add(url);
      await saveCardAssignment(verse.id, assignmentKey, url);
    }
  }

  rememberSessionUrls(versesKey, result);

  if (keywords.length > 0 && !warmedKeywordSets.has(keywordsKey)) {
    if (imageTheme === "auto") {
      await warmCarouselImagePool(categories, CAROUSEL_IMAGE_POOL_TARGET);
    } else {
      await warmCarouselImagePoolFromKeywords(keywords, CAROUSEL_IMAGE_POOL_TARGET);
    }
    warmedKeywordSets.add(keywordsKey);
  }

  const prefetchUrls = new Set<string>(Object.values(result));
  for (const keyword of keywords) {
    const pool = await loadKeywordPool(keyword);
    for (const url of pool.urls) prefetchUrls.add(url);
  }
  for (const url of prefetchUrls) {
    void Image.prefetch(url, "disk");
  }

  return result;
}

/** Clears persisted and in-memory image assignments for the given verse IDs. */
export async function clearCarouselCardAssignments(
  verseIds: readonly string[],
  assignmentKeys?: readonly string[],
): Promise<void> {
  for (const verseId of verseIds) {
    if (assignmentKeys) {
      for (const assignmentKey of assignmentKeys) {
        sessionCardUrlByVerseId.delete(cardAssignmentCacheKey(verseId, assignmentKey));
        try {
          await AsyncStorage.removeItem(cardStorageKey(verseId, assignmentKey));
        } catch {
          /* ignore */
        }
      }
    }

    for (const cacheKey of [...sessionCardUrlByVerseId.keys()]) {
      if (cacheKey.startsWith(`${verseId}:`)) {
        sessionCardUrlByVerseId.delete(cacheKey);
      }
    }

    try {
      await AsyncStorage.removeItem(`${CARD_STORAGE_PREFIX}${verseId}`);
    } catch {
      /* ignore */
    }
  }
  sessionResolvedByVersesKey.clear();
}

/** Clears stored assignments and fetches new unique background URLs for visible cards. */
export async function refreshCarouselBackgroundUrls(
  verses: readonly CarouselVerseRef[],
  imageTheme: CarouselImageTheme = "auto",
): Promise<Record<string, string>> {
  if (verses.length === 0) return {};
  if (!usesCarouselPhotoBackground(imageTheme)) {
    await clearCarouselCardAssignments(verses.map((verse) => verse.id));
    return {};
  }

  const excludeUrls = new Set<string>();
  for (const verse of verses) {
    const assignmentKey = resolveAssignmentKey(imageTheme, verse);
    const url = await getCardAssignment(verse.id, assignmentKey);
    if (url) excludeUrls.add(url);
  }

  const assignmentKeys = [
    ...new Set(verses.map((verse) => resolveAssignmentKey(imageTheme, verse))),
  ];
  await clearCarouselCardAssignments(
    verses.map((verse) => verse.id),
    assignmentKeys,
  );
  return resolveCarouselBackgroundUrls(verses, { excludeUrls, imageTheme });
}

/**
 * Grows keyword pools until at least `targetSize` unique URLs are cached.
 */
export async function warmCarouselImagePool(
  categories: readonly CarouselImageCategory[],
  targetSize = CAROUSEL_IMAGE_POOL_TARGET,
): Promise<void> {
  if (categories.length === 0) return;
  const keywords = collectKeywordsForCategories(categories);
  await warmCarouselImagePoolFromKeywords(keywords, targetSize);
}

async function warmCarouselImagePoolFromKeywords(
  keywords: readonly string[],
  targetSize = CAROUSEL_IMAGE_POOL_TARGET,
): Promise<void> {
  if (keywords.length === 0) return;

  async function countUniquePoolUrls(): Promise<number> {
    const all = new Set<string>();
    for (const keyword of keywords) {
      const pool = await loadKeywordPool(keyword);
      for (const url of pool.urls) all.add(url);
    }
    return all.size;
  }

  let stagnantRounds = 0;
  let keywordIndex = 0;

  while ((await countUniquePoolUrls()) < targetSize && stagnantRounds < keywords.length * 3) {
    const before = await countUniquePoolUrls();
    const keyword = keywords[keywordIndex % keywords.length]!;
    await fetchNextPoolPage(keyword);
    const after = await countUniquePoolUrls();

    stagnantRounds = after > before ? 0 : stagnantRounds + 1;
    keywordIndex += 1;
  }
}
