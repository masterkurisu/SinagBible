import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInput as TextInputType,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MaterialIcons } from "@expo/vector-icons";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { ReaderM3IconButton } from "@/src/features/reader/ReaderM3IconButton";
import {
  READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
  READER_M3_APP_BAR_ICON_BUTTON_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

const SEARCH_BAR_HEIGHT_PX = 48;
const SEARCH_OPEN_MS = 320;
const SEARCH_CLOSE_MS = 240;

export type JournalListAndroidAppBarProps = {
  topInsetPx: number;
  backgroundColor: string;
  insets: { left: number; right: number };
  windowWidth: number;
  leadingAction: ReactNode;
  filterAction: ReactNode;
  searchOpen: boolean;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  searchIconColor: string;
  rippleColor: string;
};

/** M3 top app bar with an expanding tonal search field centered between leading and trailing actions. */
export function JournalListAndroidAppBar({
  topInsetPx,
  backgroundColor,
  insets,
  windowWidth,
  leadingAction,
  filterAction,
  searchOpen,
  searchQuery,
  onChangeSearchQuery,
  onOpenSearch,
  onCloseSearch,
  searchIconColor,
  rippleColor,
}: JournalListAndroidAppBarProps) {
  const { bundle } = useMobileAppTheme();
  const s = bundle.search;
  const chrome = bundle.chrome;
  const inputRef = useRef<TextInputType | null>(null);
  const searchProgress = useRef(new Animated.Value(0)).current;
  const focusAfterOpenRef = useRef(false);

  const paddingLeft = Math.max(insets.left, 4);
  const paddingRight = Math.max(insets.right, 4);
  const centerGapPx = 8;

  const expandedSearchWidth = useMemo(() => {
    const trailingFilterPx = READER_M3_APP_BAR_ICON_BUTTON_PX;
    const leadingPx = READER_M3_APP_BAR_ICON_BUTTON_PX;
    return Math.max(
      READER_M3_APP_BAR_ICON_BUTTON_PX,
      windowWidth -
        paddingLeft -
        paddingRight -
        leadingPx -
        trailingFilterPx -
        centerGapPx * 2,
    );
  }, [centerGapPx, paddingLeft, paddingRight, windowWidth]);

  useEffect(() => {
    if (searchOpen) {
      focusAfterOpenRef.current = true;
    }
    Animated.timing(searchProgress, {
      toValue: searchOpen ? 1 : 0,
      duration: searchOpen ? SEARCH_OPEN_MS : SEARCH_CLOSE_MS,
      easing: searchOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && searchOpen && focusAfterOpenRef.current) {
        focusAfterOpenRef.current = false;
        inputRef.current?.focus();
      }
    });
  }, [searchOpen, searchProgress]);

  const animatedSearchWidth = searchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [READER_M3_APP_BAR_ICON_BUTTON_PX, expandedSearchWidth],
  });

  const searchFieldOpacity = searchProgress.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 1, 1],
    extrapolate: "clamp",
  });

  const searchIconOpacity = searchProgress.interpolate({
    inputRange: [0, 0.28],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const inputOpacity = searchProgress.interpolate({
    inputRange: [0.35, 0.72, 1],
    outputRange: [0, 0.4, 1],
    extrapolate: "clamp",
  });

  const trailingWidth = searchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [READER_M3_APP_BAR_ICON_BUTTON_PX * 2, READER_M3_APP_BAR_ICON_BUTTON_PX],
  });

  const showClear = searchQuery.length > 0;

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        input: {
          flex: 1,
          fontFamily: "Inter_400Regular",
          fontSize: 16,
          color: s.primaryText,
          paddingVertical: 10,
          paddingRight: 4,
          margin: 0,
          minWidth: 0,
        },
      }),
    [s.primaryText],
  );

  if (Platform.OS !== "android") return null;

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: topInsetPx, backgroundColor }}>
        <View
          style={[
            styles.barRow,
            {
              height: READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
              paddingLeft,
              paddingRight,
            },
          ]}
        >
          <View style={styles.leading}>{leadingAction}</View>

          <View style={[styles.center, { marginHorizontal: centerGapPx / 2 }]}>
            <Animated.View
              pointerEvents={searchOpen ? "auto" : "none"}
              style={[
                styles.searchShell,
                {
                  width: animatedSearchWidth,
                  opacity: searchFieldOpacity,
                  backgroundColor: chrome.androidIndicator,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={s.muted}
                style={styles.searchGlyph}
              />
              <Animated.View style={[styles.inputWrap, { opacity: inputOpacity }]}>
                <TextInput
                  ref={inputRef}
                  value={searchQuery}
                  onChangeText={onChangeSearchQuery}
                  placeholder="Search entries, verses, dates…"
                  placeholderTextColor={s.placeholder}
                  style={themedStyles.input}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={s.tint}
                  accessibilityLabel="Search journal entries"
                />
              </Animated.View>
              {showClear ? (
                <TouchableOpacity
                  onPress={() => onChangeSearchQuery("")}
                  activeOpacity={0.65}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.clearButton}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={s.muted} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={onCloseSearch}
                activeOpacity={0.65}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeButton}
                accessibilityLabel="Close search"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={22} color={s.muted} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View style={[styles.trailing, { width: trailingWidth }]}>
            <Animated.View
              style={[styles.searchIconSlot, { opacity: searchIconOpacity }]}
              pointerEvents={searchOpen ? "none" : "auto"}
            >
              <ReaderM3IconButton
                onPress={onOpenSearch}
                accessibilityLabel="Search journal entries"
                rippleColor={rippleColor}
                suppressHaptic
              >
                <View style={styles.iconInner}>
                  <MaterialIcons name="search" size={24} color={searchIconColor} />
                </View>
              </ReaderM3IconButton>
            </Animated.View>
            <View style={styles.filterSlot}>{filterAction}</View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leading: {
    width: READER_M3_APP_BAR_ICON_BUTTON_PX,
    height: READER_M3_APP_BAR_ICON_BUTTON_PX,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  center: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    alignItems: "flex-end",
    height: READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    height: SEARCH_BAR_HEIGHT_PX,
    borderRadius: SEARCH_BAR_HEIGHT_PX / 2,
    paddingLeft: 14,
    paddingRight: 4,
    overflow: "hidden",
  },
  searchGlyph: {
    marginRight: 8,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
  },
  clearButton: {
    justifyContent: "center",
    alignItems: "center",
    minWidth: 32,
    minHeight: 32,
  },
  closeButton: {
    justifyContent: "center",
    alignItems: "center",
    minWidth: 36,
    minHeight: 36,
    marginLeft: 2,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    height: READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
    zIndex: 2,
  },
  searchIconSlot: {
    width: READER_M3_APP_BAR_ICON_BUTTON_PX,
    height: READER_M3_APP_BAR_ICON_BUTTON_PX,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSlot: {
    width: READER_M3_APP_BAR_ICON_BUTTON_PX,
    height: READER_M3_APP_BAR_ICON_BUTTON_PX,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
