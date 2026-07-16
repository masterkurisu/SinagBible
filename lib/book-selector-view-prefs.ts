import AsyncStorage from "@react-native-async-storage/async-storage";

export type BookSelectorViewMode = "grid" | "az" | "testament";
export type SelectorTestamentTab = "old" | "new";

export type BookSelectorViewPrefs = {
  mode: BookSelectorViewMode;
  testamentTab: SelectorTestamentTab;
};

const BOOK_SELECTOR_VIEW_STORAGE_KEY = "sb:reader:bookSelectorView";

const DEFAULT_BOOK_SELECTOR_VIEW_PREFS: BookSelectorViewPrefs = {
  mode: "grid",
  testamentTab: "new",
};

let cachedBookSelectorViewPrefs: BookSelectorViewPrefs | null = null;
let bookSelectorViewPrefsLoadPromise: Promise<BookSelectorViewPrefs> | null = null;

function parseBookSelectorViewPrefs(raw: string | null): BookSelectorViewPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      mode?: BookSelectorViewMode;
      testamentTab?: SelectorTestamentTab;
    };
    const mode =
      parsed.mode === "grid" || parsed.mode === "az" || parsed.mode === "testament"
        ? parsed.mode
        : DEFAULT_BOOK_SELECTOR_VIEW_PREFS.mode;
    const testamentTab =
      parsed.testamentTab === "old" || parsed.testamentTab === "new"
        ? parsed.testamentTab
        : DEFAULT_BOOK_SELECTOR_VIEW_PREFS.testamentTab;
    return { mode, testamentTab };
  } catch {
    return null;
  }
}

function patchCachedBookSelectorViewPrefs(patch: Partial<BookSelectorViewPrefs>): void {
  cachedBookSelectorViewPrefs = cachedBookSelectorViewPrefs
    ? { ...cachedBookSelectorViewPrefs, ...patch }
    : { ...DEFAULT_BOOK_SELECTOR_VIEW_PREFS, ...patch };
}

export function getInitialBookSelectorViewPrefs(): BookSelectorViewPrefs {
  return cachedBookSelectorViewPrefs ?? DEFAULT_BOOK_SELECTOR_VIEW_PREFS;
}

export function isBookSelectorViewPrefsCached(): boolean {
  return cachedBookSelectorViewPrefs != null;
}

export function loadBookSelectorViewPrefs(): Promise<BookSelectorViewPrefs> {
  if (cachedBookSelectorViewPrefs) {
    return Promise.resolve(cachedBookSelectorViewPrefs);
  }
  if (bookSelectorViewPrefsLoadPromise) {
    return bookSelectorViewPrefsLoadPromise;
  }

  bookSelectorViewPrefsLoadPromise = AsyncStorage.getItem(BOOK_SELECTOR_VIEW_STORAGE_KEY)
    .then((raw) => {
      cachedBookSelectorViewPrefs =
        parseBookSelectorViewPrefs(raw) ?? { ...DEFAULT_BOOK_SELECTOR_VIEW_PREFS };
      return cachedBookSelectorViewPrefs;
    })
    .catch(() => {
      cachedBookSelectorViewPrefs = { ...DEFAULT_BOOK_SELECTOR_VIEW_PREFS };
      return cachedBookSelectorViewPrefs;
    })
    .finally(() => {
      bookSelectorViewPrefsLoadPromise = null;
    });

  return bookSelectorViewPrefsLoadPromise;
}

export function persistBookSelectorViewPrefs(prefs: BookSelectorViewPrefs): void {
  patchCachedBookSelectorViewPrefs(prefs);
  void AsyncStorage.setItem(BOOK_SELECTOR_VIEW_STORAGE_KEY, JSON.stringify(prefs)).catch(() => {});
}

/** Warm prefs before the book picker sheet opens. */
void loadBookSelectorViewPrefs();
