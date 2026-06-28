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

/** Matches `READER_MOBILE_SETTINGS_PANEL_BG` in ReaderModals (settings strip + tab cover). */
const READER_TOOLS_MENU_TAB_COVER_COLOR = "#2e2e2e";

const TAB_BAR_HIDE_MS = 240;
const TAB_BAR_SHOW_MS = 280;

type ReaderTabBarVisibilityContextValue = {
  /** Native tab bar hidden while reading mid-chapter (Android). */
  scrollHidden: boolean;
  /** 0 = tab bar visible, 1 = hidden — drives list padding / action bar motion. */
  hideProgress: Animated.Value;
  setScrollHidden: (hidden: boolean) => void;
  setToolsMenuCoversNativeTabBar: (covers: boolean) => void;
};

const ReaderTabBarVisibilityContext = createContext<ReaderTabBarVisibilityContextValue | null>(null);

export function ReaderTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [scrollHidden, setScrollHiddenState] = useState(false);
  const [toolsMenuCoverVisible, setToolsMenuCoverVisible] = useState(false);
  const hideProgress = useRef(new Animated.Value(0)).current;
  const scrollHiddenRef = useRef(false);

  const setScrollHidden = useCallback(
    (hidden: boolean) => {
      if (scrollHiddenRef.current === hidden) return;
      scrollHiddenRef.current = hidden;
      setScrollHiddenState(hidden);

      Animated.timing(hideProgress, {
        toValue: hidden ? 1 : 0,
        duration: hidden ? TAB_BAR_HIDE_MS : TAB_BAR_SHOW_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [hideProgress],
  );

  const setToolsMenuCoversNativeTabBar = useCallback((covers: boolean) => {
    setToolsMenuCoverVisible(covers);
  }, []);

  const value = useMemo(
    () => ({
      scrollHidden,
      hideProgress,
      setScrollHidden,
      setToolsMenuCoversNativeTabBar,
    }),
    [scrollHidden, hideProgress, setScrollHidden, setToolsMenuCoversNativeTabBar],
  );

  return (
    <ReaderTabBarVisibilityContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <ReaderTabBarChromeOverlays toolsMenuCoverVisible={toolsMenuCoverVisible} />
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

export function useReaderTabBarHideProgress(): Animated.Value {
  return useReaderTabBarVisibilityContext().hideProgress;
}

export function useSetReaderTabBarScrollHidden(): (hidden: boolean) => void {
  return useReaderTabBarVisibilityContext().setScrollHidden;
}

/** Tools menu: dark strip slides up over the native tab bar. */
export function useSetReaderTabBarCoverFromReaderMenu(): ((covers: boolean) => void) | null {
  const ctx = useContext(ReaderTabBarVisibilityContext);
  return ctx?.setToolsMenuCoversNativeTabBar ?? null;
}

/** @deprecated Use ReaderTabBarVisibilityProvider */
export const ReaderTabBarCoverProvider = ReaderTabBarVisibilityProvider;

/** @deprecated Use useSetReaderTabBarCoverFromReaderMenu */
export function useSetReaderTabBarCoverFromReaderMenuDeprecated(): ((covers: boolean) => void) | null {
  return useSetReaderTabBarCoverFromReaderMenu();
}

function ReaderTabBarChromeOverlays({ toolsMenuCoverVisible }: { toolsMenuCoverVisible: boolean }) {
  const insets = useSafeAreaInsets();
  const { bundle } = useMobileAppTheme();
  const { hideProgress } = useReaderTabBarVisibilityContext();
  const tabBarHeight = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const readerSurface = bundle.reader.sceneSurface;

  const toolsCoverProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(toolsCoverProgress, {
      toValue: toolsMenuCoverVisible ? 1 : 0,
      duration: toolsMenuCoverVisible ? 280 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [toolsMenuCoverVisible, toolsCoverProgress]);

  const toolsCoverTranslateY = toolsCoverProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [tabBarHeight, 0],
  });

  /** Brief cover during the native tab bar show/hide layout change. */
  const scrollCoverOpacity = hideProgress.interpolate({
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
      <Animated.View
        pointerEvents={toolsMenuCoverVisible ? "auto" : "none"}
        style={[
          styles.overlay,
          {
            height: tabBarHeight,
            backgroundColor: READER_TOOLS_MENU_TAB_COVER_COLOR,
            transform: [{ translateY: toolsCoverTranslateY }],
            zIndex: 2,
            elevation: 2,
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
