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
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";

/** Matches `READER_MOBILE_SETTINGS_PANEL_BG` in readerSettingsPanelChrome (settings strip + tab bar). */
export { READER_MOBILE_SETTINGS_PANEL_BG as READER_TOOLS_MENU_TAB_BAR_COLOR } from "@/src/features/reader/readerSettingsPanelChrome";

const TAB_BAR_SLIDE_MS = 220;
/** Material standard deceleration — reads as a physical slide, not a fade. */
const TAB_BAR_SLIDE_EASING = Easing.bezier(0.4, 0, 0.2, 1);

type ReaderTabBarVisibilityContextValue = {
  /** Native tab bar hidden while reading mid-chapter (Android). */
  scrollHidden: boolean;
  /** 0–1 tint for the reader settings menu tab bar (Android, tab bar visible only). */
  settingsTabBarTint: number;
  /** Reader settings menu slide (0 = closed, 1 = open) when on the chapter screen. */
  settingsSlideProgress: Animated.Value | null;
  /** 0 = tab bar shown, 1 = slid down off-screen — native-driver slide overlay. */
  hideProgress: Animated.Value;
  setScrollHidden: (hidden: boolean) => void;
  registerReaderSettingsSlideProgress: (progress: Animated.Value | null) => void;
};

const ReaderTabBarVisibilityContext = createContext<ReaderTabBarVisibilityContextValue | null>(null);

export function ReaderTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [scrollHidden, setScrollHiddenState] = useState(false);
  const [settingsSlideProgress, setSettingsSlideProgress] = useState<Animated.Value | null>(null);
  const [settingsTabBarTint, setSettingsTabBarTint] = useState(0);
  /** Snapped for list padding; slide overlay uses tabBarSlideProgress. */
  const hideProgress = useRef(new Animated.Value(0)).current;
  /** 0 = tab bar shown, 1 = tab bar slid down — drives translateY on the slide overlay. */
  const tabBarSlideProgress = useRef(new Animated.Value(0)).current;
  const scrollHiddenRef = useRef(false);
  const slideAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [slideOverlayActive, setSlideOverlayActive] = useState(false);

  const playTabBarSlide = useCallback(
    (hidden: boolean) => {
      if (Platform.OS !== "android") return;
      slideAnimationRef.current?.stop();
      tabBarSlideProgress.stopAnimation();
      setSlideOverlayActive(true);
      slideAnimationRef.current = Animated.timing(tabBarSlideProgress, {
        toValue: hidden ? 1 : 0,
        duration: TAB_BAR_SLIDE_MS,
        easing: TAB_BAR_SLIDE_EASING,
        useNativeDriver: true,
      });
      slideAnimationRef.current.start(({ finished }) => {
        if (finished) {
          setSlideOverlayActive(false);
        }
      });
    },
    [tabBarSlideProgress],
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
      settingsTabBarTint,
      settingsSlideProgress,
      hideProgress,
      setScrollHidden,
      registerReaderSettingsSlideProgress,
    }),
    [
      scrollHidden,
      settingsTabBarTint,
      settingsSlideProgress,
      hideProgress,
      setScrollHidden,
      registerReaderSettingsSlideProgress,
    ],
  );

  return (
    <ReaderTabBarVisibilityContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <ReaderTabBarChromeOverlays
          tabBarSlideProgress={tabBarSlideProgress}
          slideOverlayActive={slideOverlayActive}
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

function ReaderTabBarChromeOverlays({
  tabBarSlideProgress,
  slideOverlayActive,
}: {
  tabBarSlideProgress: Animated.Value;
  slideOverlayActive: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { bundle } = useMobileAppTheme();
  const tabBarHeight = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const tabBarSurface = bundle.chrome.tabBarBackground;

  const slideTranslateY = tabBarSlideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabBarHeight],
  });

  if (Platform.OS !== "android") return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.overlay,
          {
            height: tabBarHeight,
            backgroundColor: tabBarSurface,
            opacity: slideOverlayActive ? 1 : 0,
            transform: [{ translateY: slideTranslateY }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    elevation: 1,
  },
});
