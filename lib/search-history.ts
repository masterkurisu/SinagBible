import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "search_history";
const MAX_ITEMS = 10;

export async function loadSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Most recent first, max length {@link MAX_ITEMS}. */
export async function prependSearchHistory(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return loadSearchHistory();
  const prev = await loadSearchHistory();
  const withoutDup = prev.filter((item) => item !== q);
  const next = [q, ...withoutDup].slice(0, MAX_ITEMS);
  try {
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    return prev;
  }
  return next;
}

export async function removeSearchHistoryItem(query: string): Promise<string[]> {
  const prev = await loadSearchHistory();
  const next = prev.filter((item) => item !== query);
  try {
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    return prev;
  }
  return next;
}
