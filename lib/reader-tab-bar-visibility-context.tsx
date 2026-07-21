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
  /** Hide: native + slide chrome move together from slide start. */
  onHideSlideBegin: () => void;
  onHideSlideComplete: () => void;
  /** Show: native restores at slide start; FAB rises into the bar in sync. */
  onShowSlideBegin: () => void;
  onShowSlideComplete: () => void;
  updateScrollHiddenState: (hidden: boolean) => void;
  snapScrollHidden: (hidden: boolean) => void;
};

type ReaderTabBarScrollContextValue = {
  /** Layout / reader chrome — updates when scroll crosses threshold. */
  scrollHidden: boolean;
  /** NativeTabs `hidden` — toggled in sync with slide animation start. */
  nativeTabBarHidden: boolean;
  /** 0 = tab bar shown, 1 = slid down off-screen — snapped for list padding. */
  hideProgress: Animated.Value;
  /** @deprecated Scroll driver owns slide animation on the UI thread. */
  setScrollHidden: (hidden: boolean) => void;
  /** Instant reset — chapter changes, route leave (no slide animation). */
  snapScrollHidden: (hidden: boolean) => void;
};

type ReaderTabBarSettingsTintContextValue = {
  /** 0–1 tint for the reader settings menu tab bar (Android, tab bar visible only). */
  settingsTabBarTint: number;
};

type ReaderTabBarSettingsRegistrationContextValue = {
  registerReaderSettingsSlideProgress: (progress: Animated.Value | null) => void;
};

const ReaderTabBarSlideControllerContext = createContext<ReaderTabBarSlideControllerValue | null>(
  null,
);
const ReaderTabBarScrollContext = createContext<ReaderTabBarScrollContextValue | null>(null);
const ReaderTabBarSettingsTintContext = createContext<ReaderTabBarSettingsTintContextValue | null>(
  null,
);
const ReaderTabBarSettingsRegistrationContext =
  createContext<ReaderTabBarSettingsRegistrationContextValue | null>(null);

type ReaderTabBarSettingsChromeHostProps = {
  scrollHidden: boolean;
  nativeTabBarHidden: boolean;
  slideOverlayActive: boolean;
  tabBarSlideProgressSV: SharedValue<number>;
};

/**
 * Sibling overlay for settings-menu tab bar tint. Tint state lives here so chapter
 * scroll consumers are not in an ancestor that re-renders every animation frame.
 */
function ReaderTabBarSettingsChromeHost({
  scrollHidden,
  nativeTabBarHidden,
  slideOverlayActive,
  tabBarSlideProgressSV,
}: ReaderTabBarSettingsChromeHostProps) {
  const [settingsSlideProgress, setSettingsSlideProgress] = useState<Animated.Value | null>(null);
  const [settingsTabBarTint, setSettingsTabBarTint] = useState(0);

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

  const registrationValue = useMemo(
    () => ({ registerReaderSettingsSlideProgress }),
    [registerReaderSettingsSlideProgress],
  );

  const tintValue = useMemo(() => ({ settingsTabBarTint }), [settingsTabBarTint]);

  return (
    <ReaderTabBarSettingsRegistrationContext.Provider value={registrationValue}>
      <ReaderTabBarSettingsTintContext.Provider value={tintValue}>
        <ReaderBottomNavSlideChrome
          tabBarSlideProgressSV={tabBarSlideProgressSV}
          slideOverlayActive={slideOverlayActive}
          nativeTabBarHidden={nativeTabBarHidden}
          settingsTabBarTint={settingsTabBarTint}
          tabBarInteractionHidden={scrollHidden}
        />
      </ReaderTabBarSettingsTintContext.Provider>
    </ReaderTabBarSettingsRegistrationContext.Provider>
  );
}

export function ReaderTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrollHidden, setScrollHiddenState] = useState(false);
  const [nativeTabBarHidden, setNativeTabBarHidden] = useState(false);
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
    setNativeTabBarHidden(true);
    updateScrollHiddenState(true);
  }, [updateScrollHiddenState]);

  const onHideSlideComplete = useCallback(() => {
    if (Platform.OS !== "android") return;
    setSlideOverlayActive(false);
  }, []);

  const onShowSlideBegin = useCallback(() => {
    if (Platform.OS !== "android") return;
    setSlideOverlayActive(true);
    setNativeTabBarHidden(false);
    updateScrollHiddenState(false);
  }, [updateScrollHiddenState]);

  const onShowSlideComplete = useCallback(() => {
    if (Platform.OS !== "android") return;
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

  const scrollValue = useMemo(
    () => ({
      scrollHidden,
      nativeTabBarHidden,
      hideProgress,
      setScrollHidden,
      snapScrollHidden,
    }),
    [scrollHidden, nativeTabBarHidden, hideProgress, setScrollHidden, snapScrollHidden],
  );

  return (
    <ReaderTabBarSlideControllerContext.Provider value={slideController}>
      <ReaderTabBarScrollContext.Provider value={scrollValue}>
        <View style={{ flex: 1 }}>
          {children}
          <ReaderTabBarSettingsChromeHost
            scrollHidden={scrollHidden}
            nativeTabBarHidden={nativeTabBarHidden}
            slideOverlayActive={slideOverlayActive}
            tabBarSlideProgressSV={tabBarSlideProgressSV}
          />
        </View>
      </ReaderTabBarScrollContext.Provider>
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

function useReaderTabBarScrollContext(): ReaderTabBarScrollContextValue {
  const ctx = useContext(ReaderTabBarScrollContext);
  if (ctx == null) {
    throw new Error("ReaderTabBarVisibilityProvider is missing from the tree");
  }
  return ctx;
}

export function useReaderTabBarScrollHidden(): boolean {
  return useReaderTabBarScrollContext().scrollHidden;
}

export function useReaderNativeTabBarHidden(): boolean {
  return useReaderTabBarScrollContext().nativeTabBarHidden;
}

export function useReaderSettingsTabBarTint(): number {
  const ctx = useContext(ReaderTabBarSettingsTintContext);
  return ctx?.settingsTabBarTint ?? 0;
}

export function useReaderTabBarHideProgress(): Animated.Value {
  return useReaderTabBarScrollContext().hideProgress;
}

export function useSetReaderTabBarScrollHidden(): (hidden: boolean) => void {
  return useReaderTabBarScrollContext().setScrollHidden;
}

export function useSnapReaderTabBarScrollHidden(): (hidden: boolean) => void {
  return useReaderTabBarScrollContext().snapScrollHidden;
}

export function useRegisterReaderSettingsSlideProgress(
  slideProgress: Animated.Value,
  enabled = true,
): void {
  const register = useContext(ReaderTabBarSettingsRegistrationContext)
    ?.registerReaderSettingsSlideProgress;

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
