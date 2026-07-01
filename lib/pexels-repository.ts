import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { searchPexelsImages } from "@/lib/pexels-api";
import {
  getPexelsSearchKeyword,
  type CarouselImageCategory,
} from "@/lib/pexels-image-mapper";

/** Minimum unique image URLs kept cached across category pools. */
export const CAROUSEL_IMAGE_POOL_TARGET = 30;

const POOL_FETCH_PER_PAGE = 20;
const CARD_STORAGE_PREFIX = "sb:pexels:card:";
const POOL_STORAGE_PREFIX = "sb:pexels:pool:";
const LEGACY_CATEGORY_PREFIX = "sb:pexels:url:";

type CategoryPool = {
  urls: string[];
  nextPage: number;
};

type CarouselVerseRef = {
  id: string;
  imageCategory: CarouselImageCategory;
};

const pendingPoolFetches = new Map<CarouselImageCategory, Promise<string[]>>();
const sessionCardUrlByVerseId = new Map<string, string>();
const sessionResolvedByVersesKey = new Map<string, Record<string, string>>();
const warmedCategorySets = new Set<string>();

export function buildCarouselVersesKey(verses: readonly CarouselVerseRef[]): string {
  return verses.map((verse) => `${verse.id}:${verse.imageCategory}`).join("|");
}

/** Synchronous session cache — avoids URL flash when revisiting the journal tab. */
export function getCarouselBackgroundUrlSession(
  verses: readonly CarouselVerseRef[],
): Record<string, string> | null {
  if (verses.length === 0) return null;

  const key = buildCarouselVersesKey(verses);
  const resolved = sessionResolvedByVersesKey.get(key);
  if (resolved && verses.every((verse) => resolved[verse.id])) {
    return resolved;
  }

  const fromCards: Record<string, string> = {};
  for (const verse of verses) {
    const url = sessionCardUrlByVerseId.get(verse.id);
    if (!url) return null;
    fromCards[verse.id] = url;
  }
  return fromCards;
}

function rememberSessionUrls(versesKey: string, urls: Record<string, string>): void {
  sessionResolvedByVersesKey.set(versesKey, urls);
  for (const [verseId, url] of Object.entries(urls)) {
    sessionCardUrlByVerseId.set(verseId, url);
  }
}

function poolStorageKey(category: CarouselImageCategory): string {
  return `${POOL_STORAGE_PREFIX}${category}`;
}

function cardStorageKey(verseId: string): string {
  return `${CARD_STORAGE_PREFIX}${verseId}`;
}

async function loadCategoryPool(category: CarouselImageCategory): Promise<CategoryPool> {
  try {
    const raw = await AsyncStorage.getItem(poolStorageKey(category));
    if (raw) {
      const parsed = JSON.parse(raw) as CategoryPool;
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

  // Migrate legacy single-URL cache into the pool.
  try {
    const legacy = await AsyncStorage.getItem(`${LEGACY_CATEGORY_PREFIX}${category}`);
    if (legacy) {
      return { urls: [legacy], nextPage: 2 };
    }
  } catch {
    /* ignore */
  }

  return { urls: [], nextPage: 1 };
}

async function saveCategoryPool(category: CarouselImageCategory, pool: CategoryPool): Promise<void> {
  try {
    await AsyncStorage.setItem(
      poolStorageKey(category),
      JSON.stringify({
        urls: [...new Set(pool.urls)],
        nextPage: pool.nextPage,
      }),
    );
  } catch {
    /* ignore */
  }
}

async function getCardAssignment(verseId: string): Promise<string | null> {
  const sessionUrl = sessionCardUrlByVerseId.get(verseId);
  if (sessionUrl) return sessionUrl;

  try {
    const url = await AsyncStorage.getItem(cardStorageKey(verseId));
    const trimmed = url?.trim() || null;
    if (trimmed) sessionCardUrlByVerseId.set(verseId, trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

async function saveCardAssignment(verseId: string, url: string): Promise<void> {
  sessionCardUrlByVerseId.set(verseId, url);
  try {
    await AsyncStorage.setItem(cardStorageKey(verseId), url);
  } catch {
    /* ignore */
  }
}

async function fetchNextPoolPage(category: CarouselImageCategory): Promise<string[]> {
  const pending = pendingPoolFetches.get(category);
  if (pending) return pending;

  const promise = (async () => {
    const pool = await loadCategoryPool(category);
    const keyword = getPexelsSearchKeyword(category);
    const fetched = await searchPexelsImages(keyword, {
      page: pool.nextPage,
      perPage: POOL_FETCH_PER_PAGE,
    });

    const existing = new Set(pool.urls);
    const added = fetched.filter((url) => !existing.has(url));

    pool.urls.push(...added);
    pool.nextPage = fetched.length > 0 ? pool.nextPage + 1 : pool.nextPage;
    await saveCategoryPool(category, pool);

    return added;
  })().finally(() => {
    pendingPoolFetches.delete(category);
  });

  pendingPoolFetches.set(category, promise);
  return promise;
}

async function allocateUniqueUrl(
  category: CarouselImageCategory,
  usedUrls: Set<string>,
  fallbackCategories: CarouselImageCategory[],
): Promise<string | null> {
  const categoriesToTry = [category, ...fallbackCategories.filter((c) => c !== category)];

  for (const candidateCategory of categoriesToTry) {
    let pool = await loadCategoryPool(candidateCategory);

    for (let attempt = 0; attempt < 6; attempt++) {
      const unused = pool.urls.find((url) => !usedUrls.has(url));
      if (unused) return unused;

      const added = await fetchNextPoolPage(candidateCategory);
      if (added.length === 0) break;

      pool = await loadCategoryPool(candidateCategory);
    }
  }

  return null;
}

function collectUniqueCategories(verses: readonly CarouselVerseRef[]): CarouselImageCategory[] {
  return [...new Set(verses.map((verse) => verse.imageCategory))];
}

/**
 * Assigns a unique background URL to each visible carousel card.
 * Persists per-verse assignments so the same card keeps its image across sessions.
 */
export async function resolveCarouselBackgroundUrls(
  verses: readonly CarouselVerseRef[],
): Promise<Record<string, string>> {
  if (verses.length === 0) return {};

  const versesKey = buildCarouselVersesKey(verses);
  const session = getCarouselBackgroundUrlSession(verses);
  if (session) return session;

  const usedUrls = new Set<string>();
  const result: Record<string, string> = {};
  const categories = collectUniqueCategories(verses);
  const categoriesKey = categories.join("|");
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
    let url = await getCardAssignment(verse.id);
    if (url && usedUrls.has(url)) url = null;

    if (!url) {
      url = await allocateUniqueUrl(verse.imageCategory, usedUrls, fallbackCategories);
    }

    if (url) {
      result[verse.id] = url;
      usedUrls.add(url);
      await saveCardAssignment(verse.id, url);
    }
  }

  rememberSessionUrls(versesKey, result);

  if (!warmedCategorySets.has(categoriesKey)) {
    await warmCarouselImagePool(categories, CAROUSEL_IMAGE_POOL_TARGET);
    warmedCategorySets.add(categoriesKey);
  }

  const prefetchUrls = new Set<string>(Object.values(result));
  for (const category of categories) {
    const pool = await loadCategoryPool(category);
    for (const url of pool.urls) prefetchUrls.add(url);
  }
  for (const url of prefetchUrls) {
    void Image.prefetch(url, "disk");
  }

  return result;
}

/**
 * Grows category pools until at least `targetSize` unique URLs are cached.
 */
export async function warmCarouselImagePool(
  categories: readonly CarouselImageCategory[],
  targetSize = CAROUSEL_IMAGE_POOL_TARGET,
): Promise<void> {
  if (categories.length === 0) return;

  const uniqueCategories = [...new Set(categories)];

  async function countUniquePoolUrls(): Promise<number> {
    const all = new Set<string>();
    for (const category of uniqueCategories) {
      const pool = await loadCategoryPool(category);
      for (const url of pool.urls) all.add(url);
    }
    return all.size;
  }

  let stagnantRounds = 0;
  let categoryIndex = 0;

  while ((await countUniquePoolUrls()) < targetSize && stagnantRounds < uniqueCategories.length * 3) {
    const before = await countUniquePoolUrls();
    const category = uniqueCategories[categoryIndex % uniqueCategories.length]!;
    await fetchNextPoolPage(category);
    const after = await countUniquePoolUrls();

    stagnantRounds = after > before ? 0 : stagnantRounds + 1;
    categoryIndex += 1;
  }
}
