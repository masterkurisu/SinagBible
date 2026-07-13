import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Platform, View } from "react-native";
import { usePathname } from "expo-router";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { tabHapticKeyFromPathname } from "@/lib/tab-route-key";
import { ReaderBottomNavSlideChrome } from "@/src/features/search/ReaderBottomNavSlideChrome";

/** Matches `READER_MOBILE_SETTINGS_PANEL_BG` in readerSettingsPanelChrome (settings strip + tab bar). */
export { READER_MOBILE_SETTINGS_PANEL_BG as READER_TOOLS_MENU_TAB_BAR_COLOR } from "@/src/features/reader/readerSettingsPanelChrome";

/** True when the active reader tab is showing a chapter (not the redirect index). */
function isReaderChapterRoute(pathname: string | null): boolean {
  if (pathname == null || pathname === "") return false;
  const parts = pathname.split("/").filter(Boolean);
  let i = 0;
  if (parts[0] === "(tabs)") i = 1;
  if (parts[i] !== "reader") return false;
  const afterReader = parts.slice(i + 1);
  return afterReader.length >= 2 && afterReader[0] !== "index";
}

type ReaderTabBarSlideControllerValue = {
  tabBarSlideProgressSV: SharedValue<number>;
  /** Hide: overlay only. Native `hidden` is deferred until slide-out completes. */
  onHideSlideBegin: () => void;
  onHideSlideComplete: () => void;
  /** Show: overlay slides in; native `hidden` cleared only when slide completes. */
  onShowSlideBegin: () => void;
  onShowSlideComplete: () => void;
  updateScrollHiddenState: (hidden: boolean) => void;
  snapScrollHidden: (hidden: boolean) => void;
};

type ReaderTabBarVisibilityContextValue = {
  /** Layout / reader chrome — updates when scroll crosses threshold. */
  scrollHidden: boolean;
  /** NativeTabs `hidden` — toggled only at rest, after slide animations settle. */
  nativeTabBarHidden: boolean;
  /** 0–1 tint for the reader settings menu tab bar (Android, tab bar visible only). */
  settingsTabBarTint: number;
  /** Reader settings menu slide (0 = closed, 1 = open) when on the chapter screen. */
  settingsSlideProgress: Animated.Value | null;
  /** 0 = tab bar shown, 1 = slid down off-screen — snapped for list padding. */
  hideProgress: Animated.Value;
  /** @deprecated Scroll driver owns slide animation on the UI thread. */
  setScrollHidden: (hidden: boolean) => void;
  /** Instant reset — chapter changes, route leave (no slide animation). */
  snapScrollHidden: (hidden: boolean) => void;
  registerReaderSettingsSlideProgress: (progress: Animated.Value | null) => void;
};

const ReaderTabBarSlideControllerContext = createContext<ReaderTabBarSlideControllerValue | null>(
  null,
);
const ReaderTabBarVisibilityContext = createContext<ReaderTabBarVisibilityContextValue | null>(
  null,
);

export function ReaderTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrollHidden, setScrollHiddenState] = useState(false);
  const [nativeTabBarHidden, setNativeTabBarHidden] = useState(false);
  const [settingsSlideProgress, setSettingsSlideProgress] = useState<Animated.Value | null>(null);
  const [settingsTabBarTint, setSettingsTabBarTint] = useState(0);
  const hideProgress = useRef(new Animated.Value(0)).current;
  const tabBarSlideProgressSV = useSharedValue(0);
  const scrollHiddenRef = useRef(false);
  const [slideOverlayActive, setSlideOverlayActive] = useState(false);

  const snapScrollHidden = useCallback(
    (hidden: boolean) => {
      scrollHiddenRef.current = hidden;
      setScrollHiddenState(hidden);
      setNativeTabBarHidden(hidden);
      hideProgress.setValue(hidden ? 1 : 0);
      // Direct snap — no timing. Keeps overlay translateY in sync with committedHiddenSV.
      tabBarSlideProgressSV.value = hidden ? 1 : 0;
      setSlideOverlayActive(false);
    },
    [hideProgress, tabBarSlideProgressSV],
  );

  const updateScrollHiddenState = useCallback(
    (hidden: boolean) => {
      if (scrollHiddenRef.current === hidden) return;
      scrollHiddenRef.current = hidden;
      setScrollHiddenState(hidden);
      hideProgress.setValue(hidden ? 1 : 0);
    },
    [hideProgress],
  );

  const onHideSlideBegin = useCallback(() => {
    if (Platform.OS !== "android") return;
    setSlideOverlayActive(true);
    updateScrollHiddenState(true);
  }, [updateScrollHiddenState]);

  const onHideSlideComplete = useCallback(() => {
    if (Platform.OS !== "android") return;
    setNativeTabBarHidden(true);
    setSlideOverlayActive(false);
  }, []);

  const onShowSlideBegin = useCallback(() => {
    if (Platform.OS !== "android") return;
    setSlideOverlayActive(true);
    updateScrollHiddenState(false);
  }, [updateScrollHiddenState]);

  const onShowSlideComplete = useCallback(() => {
    if (Platform.OS !== "android") return;
    setNativeTabBarHidden(false);
    setSlideOverlayActive(false);
  }, []);

  /** @deprecated Scroll driver animates on the UI thread; kept for legacy callers. */
  const setScrollHidden = useCallback(
    (hidden: boolean) => {
      updateScrollHiddenState(hidden);
      snapScrollHidden(hidden);
    },
    [snapScrollHidden, updateScrollHiddenState],
  );

  useEffect(() => {
    const onReaderChapter =
      tabHapticKeyFromPathname(pathname) === "reader" && isReaderChapterRoute(pathname);
    if (!onReaderChapter) {
      snapScrollHidden(false);
    }
  }, [pathname, snapScrollHidden]);

  const registerReaderSettingsSlideProgress = useCallback((progress: Animated.Value | null) => {
    setSettingsSlideProgress(progress);
  }, []);

  useEffect(() => {
    if (scrollHidden || settingsSlideProgress == null) {
      setSettingsTabBarTint(0);
      return;
    }

    const syncTint = (value: number) => {
      setSettingsTabBarTint(value);
    };

    const listenerId = settingsSlideProgress.addListener(({ value }) => {
      syncTint(value);
    });

    settingsSlideProgress.stopAnimation(syncTint);

    return () => {
      settingsSlideProgress.removeListener(listenerId);
      setSettingsTabBarTint(0);
    };
  }, [scrollHidden, settingsSlideProgress]);

  const slideController = useMemo(
    () => ({
      tabBarSlideProgressSV,
      onHideSlideBegin,
      onHideSlideComplete,
      onShowSlideBegin,
      onShowSlideComplete,
      updateScrollHiddenState,
      snapScrollHidden,
    }),
    [
      tabBarSlideProgressSV,
      onHideSlideBegin,
      onHideSlideComplete,
      onShowSlideBegin,
      onShowSlideComplete,
      updateScrollHiddenState,
      snapScrollHidden,
    ],
  );

  const value = useMemo(
    () => ({
      scrollHidden,
      nativeTabBarHidden,
      settingsTabBarTint,
      settingsSlideProgress,
      hideProgress,
      setScrollHidden,
      snapScrollHidden,
      registerReaderSettingsSlideProgress,
    }),
    [
      scrollHidden,
      nativeTabBarHidden,
      settingsTabBarTint,
      settingsSlideProgress,
      hideProgress,
      setScrollHidden,
      snapScrollHidden,
      registerReaderSettingsSlideProgress,
    ],
  );

  return (
    <ReaderTabBarSlideControllerContext.Provider value={slideController}>
      <ReaderTabBarVisibilityContext.Provider value={value}>
        <View style={{ flex: 1 }}>
          {children}
          <ReaderBottomNavSlideChrome
            tabBarSlideProgressSV={tabBarSlideProgressSV}
            slideOverlayActive={slideOverlayActive}
            nativeTabBarHidden={nativeTabBarHidden}
            settingsTabBarTint={settingsTabBarTint}
            tabBarInteractionHidden={scrollHidden}
          />
        </View>
      </ReaderTabBarVisibilityContext.Provider>
    </ReaderTabBarSlideControllerContext.Provider>
  );
}

export function useReaderTabBarSlideController(): ReaderTabBarSlideControllerValue {
  const ctx = useContext(ReaderTabBarSlideControllerContext);
  if (ctx == null) {
    throw new Error("ReaderTabBarVisibilityProvider is missing from the tree");
  }
  return ctx;
}

function useReaderTabBarVisibilityContext(): ReaderTabBarVisibilityContextValue {
  const ctx = useContext(ReaderTabBarVisibilityContext);
  if (ctx == null) {
    throw new Error("ReaderTabBarVisibilityProvider is missing from the tree");
  }
  return ctx;
}

export function useReaderTabBarScrollHidden(): boolean {
  return useReaderTabBarVisibilityContext().scrollHidden;
}

export function useReaderNativeTabBarHidden(): boolean {
  return useReaderTabBarVisibilityContext().nativeTabBarHidden;
}

export function useReaderSettingsTabBarTint(): number {
  const ctx = useContext(ReaderTabBarVisibilityContext);
  return ctx?.settingsTabBarTint ?? 0;
}

export function useReaderTabBarHideProgress(): Animated.Value {
  return useReaderTabBarVisibilityContext().hideProgress;
}

export function useSetReaderTabBarScrollHidden(): (hidden: boolean) => void {
  return useReaderTabBarVisibilityContext().setScrollHidden;
}

export function useSnapReaderTabBarScrollHidden(): (hidden: boolean) => void {
  return useReaderTabBarVisibilityContext().snapScrollHidden;
}

export function useRegisterReaderSettingsSlideProgress(
  slideProgress: Animated.Value,
  enabled = true,
): void {
  const ctx = useContext(ReaderTabBarVisibilityContext);
  const register = ctx?.registerReaderSettingsSlideProgress;

  useEffect(() => {
    if (!enabled) {
      register?.(null);
      return;
    }
    register?.(slideProgress);
    return () => register?.(null);
  }, [enabled, register, slideProgress]);
}

/** @deprecated Settings slide progress is registered via useRegisterReaderSettingsSlideProgress. */
export function useSetReaderTabBarCoverFromReaderMenu(): ((covers: boolean) => void) | null {
  return null;
}

/** @deprecated Use ReaderTabBarVisibilityProvider */
export const ReaderTabBarCoverProvider = ReaderTabBarVisibilityProvider;

/** @deprecated Use useSetReaderTabBarCoverFromReaderMenu */
export function useSetReaderTabBarCoverFromReaderMenuDeprecated(): ((covers: boolean) => void) | null {
  return useSetReaderTabBarCoverFromReaderMenu();
}
