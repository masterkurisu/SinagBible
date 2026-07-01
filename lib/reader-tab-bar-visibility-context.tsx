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
import { tabHapticKeyFromPathname } from "@/lib/tab-route-key";
import { ReaderBottomNavSlideChrome } from "@/src/features/search/ReaderBottomNavSlideChrome";
import {
  M3_EMPHASIZED_ACCELERATE_EASING,
  M3_EMPHASIZED_DECELERATE_EASING,
  M3_MOTION_DURATION_SHORT3_MS,
  M3_MOTION_DURATION_SHORT4_MS,
} from "@/src/components/m3/m3-motion";

/** Matches `READER_MOBILE_SETTINGS_PANEL_BG` in readerSettingsPanelChrome (settings strip + tab bar). */
export { READER_MOBILE_SETTINGS_PANEL_BG as READER_TOOLS_MENU_TAB_BAR_COLOR } from "@/src/features/reader/readerSettingsPanelChrome";

/** M3 emphasized motion — faster exit, slightly softer enter. */
const TAB_BAR_SLIDE_HIDE_MS = M3_MOTION_DURATION_SHORT3_MS;
const TAB_BAR_SLIDE_SHOW_MS = M3_MOTION_DURATION_SHORT4_MS;

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

type ReaderTabBarVisibilityContextValue = {
  /** Layout / reader chrome — updates immediately when scroll crosses threshold. */
  scrollHidden: boolean;
  /** NativeTabs `hidden` — deferred until slide-out completes; held during slide-in. */
  nativeTabBarHidden: boolean;
  /** 0–1 tint for the reader settings menu tab bar (Android, tab bar visible only). */
  settingsTabBarTint: number;
  /** Reader settings menu slide (0 = closed, 1 = open) when on the chapter screen. */
  settingsSlideProgress: Animated.Value | null;
  /** 0 = tab bar shown, 1 = slid down off-screen — snapped for list padding. */
  hideProgress: Animated.Value;
  /** 0 = on-screen, 1 = off-screen below — drives translateY slide (no opacity). */
  tabBarSlideProgress: Animated.Value;
  setScrollHidden: (hidden: boolean) => void;
  /** Instant reset — chapter changes, route leave (no slide animation). */
  snapScrollHidden: (hidden: boolean) => void;
  registerReaderSettingsSlideProgress: (progress: Animated.Value | null) => void;
};

const ReaderTabBarVisibilityContext = createContext<ReaderTabBarVisibilityContextValue | null>(null);

export function ReaderTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrollHidden, setScrollHiddenState] = useState(false);
  const [nativeTabBarHidden, setNativeTabBarHidden] = useState(false);
  const [settingsSlideProgress, setSettingsSlideProgress] = useState<Animated.Value | null>(null);
  const [settingsTabBarTint, setSettingsTabBarTint] = useState(0);
  const hideProgress = useRef(new Animated.Value(0)).current;
  const tabBarSlideProgress = useRef(new Animated.Value(0)).current;
  const scrollHiddenRef = useRef(false);
  const slideAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [slideOverlayActive, setSlideOverlayActive] = useState(false);

  const stopSlideAnimation = useCallback(() => {
    slideAnimationRef.current?.stop();
    tabBarSlideProgress.stopAnimation();
  }, [tabBarSlideProgress]);

  const snapScrollHidden = useCallback(
    (hidden: boolean) => {
      stopSlideAnimation();
      scrollHiddenRef.current = hidden;
      setScrollHiddenState(hidden);
      setNativeTabBarHidden(hidden);
      hideProgress.setValue(hidden ? 1 : 0);
      tabBarSlideProgress.setValue(hidden ? 1 : 0);
      setSlideOverlayActive(false);
    },
    [hideProgress, stopSlideAnimation, tabBarSlideProgress],
  );

  const playTabBarSlide = useCallback(
    (hidden: boolean) => {
      if (Platform.OS !== "android") return;

      stopSlideAnimation();
      setSlideOverlayActive(true);

      if (hidden) {
        setSlideOverlayActive(true);
        setNativeTabBarHidden(true);
        tabBarSlideProgress.setValue(0);
        requestAnimationFrame(() => {
          slideAnimationRef.current = Animated.timing(tabBarSlideProgress, {
            toValue: 1,
            duration: TAB_BAR_SLIDE_HIDE_MS,
            easing: M3_EMPHASIZED_ACCELERATE_EASING,
            useNativeDriver: true,
          });
          slideAnimationRef.current.start(({ finished }) => {
            if (finished) {
              setSlideOverlayActive(false);
            }
          });
        });
        return;
      }

      setNativeTabBarHidden(true);
      tabBarSlideProgress.setValue(1);
      slideAnimationRef.current = Animated.timing(tabBarSlideProgress, {
        toValue: 0,
        duration: TAB_BAR_SLIDE_SHOW_MS,
        easing: M3_EMPHASIZED_DECELERATE_EASING,
        useNativeDriver: true,
      });
      slideAnimationRef.current.start(({ finished }) => {
        if (finished) {
          setNativeTabBarHidden(false);
          setSlideOverlayActive(false);
        }
      });
    },
    [stopSlideAnimation, tabBarSlideProgress],
  );

  const setScrollHidden = useCallback(
    (hidden: boolean) => {
      if (scrollHiddenRef.current === hidden) return;
      scrollHiddenRef.current = hidden;
      setScrollHiddenState(hidden);
      hideProgress.setValue(hidden ? 1 : 0);
      playTabBarSlide(hidden);
    },
    [hideProgress, playTabBarSlide],
  );

  useEffect(() => () => {
    slideAnimationRef.current?.stop();
  }, []);

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

  const value = useMemo(
    () => ({
      scrollHidden,
      nativeTabBarHidden,
      settingsTabBarTint,
      settingsSlideProgress,
      hideProgress,
      tabBarSlideProgress,
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
      tabBarSlideProgress,
      setScrollHidden,
      snapScrollHidden,
      registerReaderSettingsSlideProgress,
    ],
  );

  return (
    <ReaderTabBarVisibilityContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <ReaderBottomNavSlideChrome
          tabBarSlideProgress={tabBarSlideProgress}
          slideOverlayActive={slideOverlayActive}
          nativeTabBarHidden={nativeTabBarHidden}
          settingsTabBarTint={settingsTabBarTint}
          tabBarInteractionHidden={scrollHidden}
        />
      </View>
    </ReaderTabBarVisibilityContext.Provider>
  );
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

export function useReaderTabBarSlideProgress(): Animated.Value {
  return useReaderTabBarVisibilityContext().tabBarSlideProgress;
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
