import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTabBarSearch } from "@/lib/tab-bar-search-context";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookSuggestion } from "@sinag-bible/types";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact } from "@/lib/haptics";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import { SearchResultsBody } from "@/src/features/search/SearchResultsBody";
import { useBibleSearch } from "@/src/features/search/useBibleSearch";
import { TAB_BAR_SEARCH_FAB_SIZE_PX } from "@/src/features/search/tabBarSearchFabChrome";

const SEARCH_PILL_HEIGHT_PX = 56;
const SEARCH_PILL_RADIUS_PX = 28;
const COLLAPSED_PILL_WIDTH_PX = TAB_BAR_SEARCH_FAB_SIZE_PX;
const SHEET_HORIZONTAL_INSET_PX = 12;
const SHEET_GAP_ABOVE_PILL_PX = 8;
const SHEET_MAX_HEIGHT_RATIO = 0.62;
const EXPAND_SPRING = { damping: 22, stiffness: 280, mass: 0.85 } as const;

/** Bottom-tab search — pill expands above the nav bar; results in a sheet above the pill. */
export function TabBarSearchLayer() {
  const { isOpen, closeSearch } = useTabBarSearch();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const s = bundle.search;
  const chrome = bundle.chrome;
  const isAndroid = Platform.OS === "android";

  const [layerMounted, setLayerMounted] = useState(isOpen);

  const search = useBibleSearch({ enabled: isOpen });
  const inputRef = useRef<TextInput>(null);

  const tabBarTopPx = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const pillBottomPx = tabBarTopPx;
  const expandedPillWidthPx = screenW - SHEET_HORIZONTAL_INSET_PX * 2;
  const sheetMaxHeightPx =
    screenH * SHEET_MAX_HEIGHT_RATIO - SEARCH_PILL_HEIGHT_PX - SHEET_GAP_ABOVE_PILL_PX - pillBottomPx;

  const openProgress = useSharedValue(isOpen ? 1 : 0);
  const pillWidthProgress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    if (isOpen) {
      setLayerMounted(true);
      openProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      pillWidthProgress.value = withSpring(1, EXPAND_SPRING);
      const id = setTimeout(() => inputRef.current?.focus(), 160);
      return () => clearTimeout(id);
    }
    openProgress.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
    pillWidthProgress.value = withSpring(0, EXPAND_SPRING);
    Keyboard.dismiss();
    const id = setTimeout(() => setLayerMounted(false), 200);
    return () => clearTimeout(id);
  }, [isOpen, openProgress, pillWidthProgress]);

  const dismissSearch = useCallback(() => {
    hapticLightImpact();
    closeSearch();
  }, [closeSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismissSearch();
      return true;
    });
    return () => sub.remove();
  }, [dismissSearch, isOpen]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 0.22], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 0.35, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(openProgress.value, [0, 1], [28, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const pillStyle = useAnimatedStyle(() => {
    const width = interpolate(
      pillWidthProgress.value,
      [0, 1],
      [COLLAPSED_PILL_WIDTH_PX, expandedPillWidthPx],
      Extrapolation.CLAMP,
    );
    return {
      width,
      alignSelf: "stretch" as const,
      opacity: interpolate(openProgress.value, [0, 0.2, 1], [0, 1, 1], Extrapolation.CLAMP),
    };
  });

  const onPickBookSuggestion = useCallback(
    (suggestion: BookSuggestion) => {
      search.runImmediateSearch(suggestion.correctedQuery);
    },
    [search],
  );

  const pillSurfaceColor = isAndroid ? chrome.androidIndicator : s.cardBackground;
  const showClear = search.query.length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          ...StyleSheet.absoluteFill,
          zIndex: 200,
          elevation: 200,
        },
        scrim: {
          ...StyleSheet.absoluteFill,
          backgroundColor: "#000000",
        },
        sheet: {
          position: "absolute",
          left: SHEET_HORIZONTAL_INSET_PX,
          right: SHEET_HORIZONTAL_INSET_PX,
          bottom: pillBottomPx + SEARCH_PILL_HEIGHT_PX + SHEET_GAP_ABOVE_PILL_PX,
          maxHeight: Math.max(180, sheetMaxHeightPx),
          borderRadius: 24,
          backgroundColor: s.pageBackground,
          borderWidth: isAndroid ? 0 : StyleSheet.hairlineWidth,
          borderColor: s.cardBorder,
          overflow: "hidden",
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 8,
          shadowColor: "#16120c",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.14,
          shadowRadius: 16,
          elevation: 12,
        },
        sheetHandle: {
          alignSelf: "center",
          width: 44,
          height: 5,
          borderRadius: 999,
          backgroundColor: "rgba(0,0,0,0.18)",
          marginBottom: 8,
        },
        dock: {
          position: "absolute",
          left: SHEET_HORIZONTAL_INSET_PX,
          right: SHEET_HORIZONTAL_INSET_PX,
          bottom: pillBottomPx,
          alignItems: "center",
        },
        pill: {
          height: SEARCH_PILL_HEIGHT_PX,
          borderRadius: SEARCH_PILL_RADIUS_PX,
          backgroundColor: pillSurfaceColor,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 8,
          overflow: "hidden",
          ...(isAndroid
            ? {}
            : {
                borderWidth: 1,
                borderColor: s.searchBarBorder,
                shadowColor: "#242423",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 5,
              }),
        },
        searchIcon: { marginRight: isAndroid ? 12 : 10 },
        input: {
          flex: 1,
          fontFamily: "Inter_400Regular",
          fontSize: isAndroid ? 16 : 15,
          color: s.primaryText,
          paddingVertical: isAndroid ? 14 : 12,
          paddingRight: 6,
          margin: 0,
          minWidth: 0,
        },
        clearButton: {
          justifyContent: "center",
          alignItems: "center",
          minWidth: 36,
          minHeight: 36,
        },
      }),
    [isAndroid, pillBottomPx, pillSurfaceColor, s, sheetMaxHeightPx],
  );

  if (!layerMounted) {
    return null;
  }

  return (
    <View pointerEvents={isOpen ? "box-none" : "none"} style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss search"
        onPress={dismissSearch}
      >
        <Animated.View style={[styles.scrim, scrimStyle]} />
      </Pressable>

      <Animated.View pointerEvents="box-none" style={[styles.sheet, sheetStyle]}>
        <View style={styles.sheetHandle} pointerEvents="none" />
        <SearchResultsBody
          search={search}
          bundle={bundle}
          onPickBookSuggestion={onPickBookSuggestion}
          onNavigateResult={dismissSearch}
        />
      </Animated.View>

      <View pointerEvents="box-none" style={styles.dock}>
        <Animated.View style={[styles.pill, pillStyle]}>
          <MaterialCommunityIcons
            name="magnify"
            size={28}
            color={isAndroid ? s.muted : s.bodyText}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            value={search.query}
            onChangeText={search.onSearchQueryChange}
            placeholder="Search Bible, references, and journal"
            placeholderTextColor={s.placeholder}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={s.tint}
            onSubmitEditing={search.onSubmitSearch}
          />
          {showClear ? (
            <TouchableOpacity
              onPressIn={() => {
                search.onClearQuery();
                Keyboard.dismiss();
              }}
              activeOpacity={0.65}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.clearButton}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close-circle" size={22} color={s.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={dismissSearch}
              activeOpacity={0.65}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.clearButton}
              accessibilityLabel="Close search"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="close" size={22} color={s.muted} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
