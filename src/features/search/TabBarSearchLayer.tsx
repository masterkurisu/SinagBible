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
  cancelAnimation,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookSuggestion } from "@sinag-bible/types";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact } from "@/lib/haptics";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import {
  M3_CONTAINER_TRANSFORM_ENTER_MS,
  M3_CONTAINER_TRANSFORM_RETURN_MS,
  M3_SCRIM_OPACITY,
  animateM3SpatialProgress,
} from "@/src/components/m3/m3-motion";
import { SearchResultsBody } from "@/src/features/search/SearchResultsBody";
import { useBibleSearch } from "@/src/features/search/useBibleSearch";
import { TAB_BAR_SEARCH_FAB_SIZE_PX } from "@/src/features/search/tabBarSearchFabChrome";

const SEARCH_PILL_HEIGHT_PX = 56;
const SEARCH_PILL_RADIUS_PX = 28;
const COLLAPSED_PILL_WIDTH_PX = TAB_BAR_SEARCH_FAB_SIZE_PX;
const SHEET_HORIZONTAL_INSET_PX = 12;
const SHEET_GAP_ABOVE_PILL_PX = 8;
const SHEET_MAX_HEIGHT_RATIO = 0.62;
const FADE_THROUGH_OUTGOING_END = 0.25;
const FADE_THROUGH_INCOMING_START = 0.25;
const SHEET_TRANSLATE_FROM_PX = 28;
const LAYER_UNMOUNT_BUFFER_MS = 50;

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

  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);

    if (isOpen) {
      setLayerMounted(true);
      animateM3SpatialProgress(progress, 1, true);
      const focusDelayMs = Math.round(M3_CONTAINER_TRANSFORM_ENTER_MS * FADE_THROUGH_INCOMING_START);
      const id = setTimeout(() => inputRef.current?.focus(), focusDelayMs);
      return () => clearTimeout(id);
    }

    animateM3SpatialProgress(progress, 0, false);
    Keyboard.dismiss();
    const id = setTimeout(
      () => setLayerMounted(false),
      M3_CONTAINER_TRANSFORM_RETURN_MS + LAYER_UNMOUNT_BUFFER_MS,
    );
    return () => clearTimeout(id);
  }, [isOpen, progress]);

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
    opacity: interpolate(progress.value, [0, 1], [0, M3_SCRIM_OPACITY], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [FADE_THROUGH_INCOMING_START, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [SHEET_TRANSLATE_FROM_PX, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [0, 1],
      [COLLAPSED_PILL_WIDTH_PX, expandedPillWidthPx],
      Extrapolation.CLAMP,
    ),
    alignSelf: "stretch" as const,
  }));

  const outgoingIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, FADE_THROUGH_OUTGOING_END],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const incomingPillContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [FADE_THROUGH_INCOMING_START, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

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
        outgoingIcon: {
          ...StyleSheet.absoluteFill,
          alignItems: "center",
          justifyContent: "center",
        },
        incomingPillContent: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 8,
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
          <Animated.View style={[styles.outgoingIcon, outgoingIconStyle]} pointerEvents="none">
            <MaterialCommunityIcons
              name="magnify"
              size={28}
              color={isAndroid ? s.muted : s.bodyText}
            />
          </Animated.View>
          <Animated.View style={[styles.incomingPillContent, incomingPillContentStyle]}>
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
        </Animated.View>
      </View>
    </View>
  );
}
