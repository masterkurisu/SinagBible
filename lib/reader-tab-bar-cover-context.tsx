import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";

/** Matches `READER_MOBILE_SETTINGS_PANEL_BG` in ReaderModals (settings strip + tab cover). */
const READER_TAB_BAR_COVER_COLOR = "#2e2e2e";

const ReaderTabBarCoverVisibleContext = createContext(false);

const ReaderTabBarCoverSetContext = createContext<((covers: boolean) => void) | null>(null);

export function ReaderTabBarCoverProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const setReaderToolsMenuCoversNativeTabBar = useCallback((covers: boolean) => {
    setVisible(covers);
  }, []);
  return (
    <ReaderTabBarCoverVisibleContext.Provider value={visible}>
      <ReaderTabBarCoverSetContext.Provider value={setReaderToolsMenuCoversNativeTabBar}>
        {children}
      </ReaderTabBarCoverSetContext.Provider>
    </ReaderTabBarCoverVisibleContext.Provider>
  );
}

export function useSetReaderTabBarCoverFromReaderMenu(): ((covers: boolean) => void) | null {
  return useContext(ReaderTabBarCoverSetContext);
}

/** Sits above the native tab bar in the tabs `View` wrapper; slides up when the reader tools menu is open. */
export function ReaderTabBarSlideCover() {
  const visible = useContext(ReaderTabBarCoverVisibleContext);
  const insets = useSafeAreaInsets();
  const height = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 280 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.cover,
        {
          height,
          backgroundColor: READER_TAB_BAR_COVER_COLOR,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
});
