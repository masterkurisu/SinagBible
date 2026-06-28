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

/** Matches `READER_MOBILE_SETTINGS_PANEL_BG` in ReaderModals (settings strip + tab bar). */
export const READER_TOOLS_MENU_TAB_BAR_COLOR = "#2e2e2e";

const TAB_BAR_HIDE_MS = 240;
const TAB_BAR_SHOW_MS = 280;

type ReaderTabBarVisibilityContextValue = {
  /** Native tab bar hidden while reading mid-chapter (Android). */
  scrollHidden: boolean;
  /** 0–1 tint for the reader settings menu tab bar (Android, tab bar visible only). */
  settingsTabBarTint: number;
  /** Reader settings menu slide (0 = closed, 1 = open) when on the chapter screen. */
  settingsSlideProgress: Animated.Value | null;
  /** 0 = tab bar visible, 1 = hidden — drives list padding / action bar motion (layout / JS driver). */
  hideProgress: Animated.Value;
  setScrollHidden: (hidden: boolean) => void;
  registerReaderSettingsSlideProgress: (progress: Animated.Value | null) => void;
};

const ReaderTabBarVisibilityContext = createContext<ReaderTabBarVisibilityContextValue | null>(null);

export function ReaderTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [scrollHidden, setScrollHiddenState] = useState(false);
  const [settingsSlideProgress, setSettingsSlideProgress] = useState<Animated.Value | null>(null);
  const [settingsTabBarTint, setSettingsTabBarTint] = useState(0);
  /** Layout-driven hide progress (padding, action bar bottom) — JS driver only. */
  const hideProgress = useRef(new Animated.Value(0)).current;
  /** Opacity-only hide progress for the brief scroll cover — native driver. */
  const hideScrollCoverProgress = useRef(new Animated.Value(0)).current;
  const scrollHiddenRef = useRef(false);

  const setScrollHidden = useCallback(
    (hidden: boolean) => {
      if (scrollHiddenRef.current === hidden) return;
      scrollHiddenRef.current = hidden;
      setScrollHiddenState(hidden);

      const toValue = hidden ? 1 : 0;
      Animated.parallel([
        Animated.timing(hideProgress, {
          toValue,
          duration: hidden ? TAB_BAR_HIDE_MS : TAB_BAR_SHOW_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(hideScrollCoverProgress, {
          toValue,
          duration: hidden ? TAB_BAR_HIDE_MS : TAB_BAR_SHOW_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [hideProgress, hideScrollCoverProgress],
  );

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
        <ReaderTabBarChromeOverlays hideScrollCoverProgress={hideScrollCoverProgress} />
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

export function useRegisterReaderSettingsSlideProgress(slideProgress: Animated.Value): void {
  const ctx = useContext(ReaderTabBarVisibilityContext);
  const register = ctx?.registerReaderSettingsSlideProgress;

  useEffect(() => {
    register?.(slideProgress);
    return () => register?.(null);
  }, [register, slideProgress]);
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
  hideScrollCoverProgress,
}: {
  hideScrollCoverProgress: Animated.Value;
}) {
  const insets = useSafeAreaInsets();
  const { bundle } = useMobileAppTheme();
  const tabBarHeight = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const readerSurface = bundle.reader.sceneSurface;

  /** Brief cover during the native tab bar show/hide layout change. */
  const scrollCoverOpacity = hideScrollCoverProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 1, 0],
  });

  if (Platform.OS !== "android") return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.overlay,
          {
            height: tabBarHeight,
            backgroundColor: readerSurface,
            opacity: scrollCoverOpacity,
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
