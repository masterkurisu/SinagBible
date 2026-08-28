import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Keyboard, Platform } from "react-native";
import { captureScreen, releaseCapture } from "react-native-view-shot";

/** Wait until the overlay close animation finishes before deleting the snapshot. */
const ANDROID_BACKDROP_RELEASE_MS = 330;

type TabBarSearchContextValue = {
  isOpen: boolean;
  /** Android: frozen screenshot of the current tab, captured before the overlay mounts. */
  androidBackdropUri: string | null;
  openSearch: () => void;
  closeSearch: () => void;
};

const TabBarSearchContext = createContext<TabBarSearchContextValue | null>(null);

async function captureAndroidSearchBackdrop(): Promise<string | null> {
  try {
    const captured = await captureScreen({
      format: "jpg",
      quality: 0.55,
      result: "tmpfile",
      handleGLSurfaceViewOnAndroid: true,
    });
    return captured === "" ? null : captured;
  } catch {
    return null;
  }
}

export function TabBarSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [androidBackdropUri, setAndroidBackdropUri] = useState<string | null>(null);
  const openingRef = useRef(false);
  const backdropUriRef = useRef<string | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseBackdrop = useCallback((uri: string | null) => {
    if (uri == null) return;
    try {
      releaseCapture(uri);
    } catch {
      /* tmpfile may already be gone */
    }
  }, []);

  const openSearch = useCallback(() => {
    if (isOpen || openingRef.current) return;
    openingRef.current = true;
    if (releaseTimerRef.current != null) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    const open = (uri: string | null) => {
      const previous = backdropUriRef.current;
      backdropUriRef.current = uri;
      setAndroidBackdropUri(uri);
      setIsOpen(true);
      openingRef.current = false;
      if (previous != null && previous !== uri) releaseBackdrop(previous);
    };

    if (Platform.OS !== "android") {
      open(null);
      return;
    }

    void captureAndroidSearchBackdrop().then(open);
  }, [isOpen, releaseBackdrop]);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    Keyboard.dismiss();
    const uri = backdropUriRef.current;
    if (uri == null) return;
    releaseTimerRef.current = setTimeout(() => {
      releaseTimerRef.current = null;
      if (backdropUriRef.current !== uri) return;
      backdropUriRef.current = null;
      setAndroidBackdropUri(null);
      releaseBackdrop(uri);
    }, ANDROID_BACKDROP_RELEASE_MS);
  }, [releaseBackdrop]);

  const value = useMemo(
    () => ({ isOpen, androidBackdropUri, openSearch, closeSearch }),
    [androidBackdropUri, closeSearch, isOpen, openSearch],
  );

  return <TabBarSearchContext.Provider value={value}>{children}</TabBarSearchContext.Provider>;
}

export function useTabBarSearch(): TabBarSearchContextValue {
  const ctx = useContext(TabBarSearchContext);
  if (ctx == null) {
    throw new Error("TabBarSearchProvider is missing from the tree");
  }
  return ctx;
}
