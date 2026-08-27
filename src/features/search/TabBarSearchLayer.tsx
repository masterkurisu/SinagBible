import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
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
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookSuggestion } from "@sinag-bible/types";
import { isMobileAppDarkThemeId } from "@sinag-bible/tokens";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact } from "@/lib/haptics";
import { nativeTabSheetBottomInsetPx } from "@/lib/native-tab-chrome";
import {
  M3_CONTAINER_TRANSFORM_ENTER_MS,
  M3_CONTAINER_TRANSFORM_RETURN_MS,
  animateM3SpatialProgress,
} from "@/src/components/m3/m3-motion";
import {
  READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
  READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
  READER_M3_BOTTOM_SHEET_RADIUS_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";
import { SearchResultsBody } from "@/src/features/search/SearchResultsBody";
import { getSearchOverlayChrome } from "@/src/features/search/searchOverlayChrome";
import { useBibleSearch } from "@/src/features/search/useBibleSearch";
import { useSearchVoice } from "@/src/features/search/useSearchVoice";
import { TAB_BAR_SEARCH_FAB_SIZE_PX } from "@/src/features/search/tabBarSearchFabChrome";

const SEARCH_PILL_HEIGHT_PX = 56;
const SEARCH_PILL_RADIUS_PX = 28;
const COLLAPSED_PILL_WIDTH_PX = TAB_BAR_SEARCH_FAB_SIZE_PX;
const SEARCH_BAR_HORIZONTAL_INSET_PX = 18;
/** Sheet's bottom edge sits flush against the pill's top edge — no visible seam. */
const SHEET_GAP_ABOVE_PILL_PX = 0;
const SHEET_TOP_GAP_PX = 0;
const SHEET_IDLE_HEIGHT_RATIO = 0.74;
const FADE_THROUGH_OUTGOING_END = 0.25;
const FADE_THROUGH_INCOMING_START = 0.25;
const SHEET_TRANSLATE_FROM_PX = 28;
const LAYER_UNMOUNT_BUFFER_MS = 50;

/** Near-opaque frost so the current tab recedes and the sheet keeps focus. */
function searchFrostScrimColor(isDark: boolean, pageBackground: string): string {
  if (!isDark) return "rgba(255, 255, 255, 0.72)";
  const hex = pageBackground.replace("#", "");
  if (hex.length < 6) return "rgba(0, 0, 0, 0.88)";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.88)`;
}

/** Bottom-tab search — pill expands above the nav bar; results in a sheet above the pill. */
export function TabBarSearchLayer() {
  const { isOpen, closeSearch } = useTabBarSearch();
  const [layerMounted, setLayerMounted] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const progress = useSharedValue(0);

  if (isOpen && !layerMounted) {
    setLayerMounted(true);
  }

  useEffect(() => {
    cancelAnimation(progress);

    if (isOpen) {
      progress.value = 0;
      animateM3SpatialProgress(progress, 1, true);
      let innerId = 0;
      const outerId = requestAnimationFrame(() => {
        innerId = requestAnimationFrame(() => setEngineReady(true));
      });
      return () => {
        cancelAnimationFrame(outerId);
        cancelAnimationFrame(innerId);
      };
    }

    setEngineReady(false);
    animateM3SpatialProgress(progress, 0, false);
    Keyboard.dismiss();
    const id = setTimeout(
      () => setLayerMounted(false),
      M3_CONTAINER_TRANSFORM_RETURN_MS + LAYER_UNMOUNT_BUFFER_MS,
    );
    return () => clearTimeout(id);
  }, [isOpen, progress]);

  if (!layerMounted) {
    return null;
  }

  if (!engineReady) {
    return <TabBarSearchOpeningShell isOpen={isOpen} closeSearch={closeSearch} progress={progress} />;
  }

  return <TabBarSearchOverlay isOpen={isOpen} closeSearch={closeSearch} progress={progress} />;
}

type TabBarSearchOverlayProps = {
  isOpen: boolean;
  closeSearch: () => void;
  progress: SharedValue<number>;
};

/** Scrim + expanding pill only — must paint before `useBibleSearch` mounts. */
function TabBarSearchOpeningShell({ isOpen, closeSearch, progress }: TabBarSearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const md = getSearchOverlayChrome(bundle);
  const pillBottomPx = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const expandedPillWidthPx = screenW - SEARCH_BAR_HORIZONTAL_INSET_PX * 2;
  // Identical to the sheet's surface (not just a close tonal step) — at
  // near-white lightness even a ~7/255 delta reads as "washed out" rather
  // than "intentionally elevated", so exact equality is what actually
  // reads as seamless.
  const pillSurfaceColor = md.surfaceContainerLow;
  const frostColor = searchFrostScrimColor(isMobileAppDarkThemeId(bundle.id), md.surfaceContainerLow);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
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

  return (
    <View
      pointerEvents={isOpen ? "box-none" : "none"}
      style={[StyleSheet.absoluteFill, { zIndex: 5000, elevation: 24 }]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss search"
        onPress={() => {
          hapticLightImpact();
          closeSearch();
        }}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: frostColor },
            scrimStyle,
          ]}
        />
      </Pressable>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: SEARCH_BAR_HORIZONTAL_INSET_PX,
          right: SEARCH_BAR_HORIZONTAL_INSET_PX,
          bottom: pillBottomPx,
          alignItems: "center",
          zIndex: 5000,
        }}
      >
        <Animated.View
          style={[
            {
              height: SEARCH_PILL_HEIGHT_PX,
              borderRadius: SEARCH_PILL_RADIUS_PX,
              backgroundColor: pillSurfaceColor,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            },
            pillStyle,
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={md.onSurface}
          />
        </Animated.View>
      </View>
    </View>
  );
}

function TabBarSearchOverlay({ isOpen, closeSearch, progress }: TabBarSearchOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { bundle } = useMobileAppTheme();
  const md = getSearchOverlayChrome(bundle);

  const search = useBibleSearch({ enabled: isOpen });
  const voice = useSearchVoice({
    enabled: isOpen,
    onTranscript: search.onVoiceTranscript,
  });
  const inputRef = useRef<TextInput>(null);

  const expandProgress = useSharedValue(0);
  const tabBarTopPx = nativeTabSheetBottomInsetPx(insets.bottom, 0);
  const pillBottomPx = tabBarTopPx;
  const expandedPillWidthPx = screenW - SEARCH_BAR_HORIZONTAL_INSET_PX * 2;
  const sheetBottomPx = pillBottomPx + SEARCH_PILL_HEIGHT_PX + SHEET_GAP_ABOVE_PILL_PX;
  const idleSheetHeightPx = Math.max(
    180,
    screenH * SHEET_IDLE_HEIGHT_RATIO - SEARCH_PILL_HEIGHT_PX - SHEET_GAP_ABOVE_PILL_PX - pillBottomPx,
  );
  const expandedSheetHeightPx = Math.max(
    idleSheetHeightPx,
    screenH - insets.top - SHEET_TOP_GAP_PX - sheetBottomPx,
  );
  const frostColor = searchFrostScrimColor(isMobileAppDarkThemeId(bundle.id), md.surfaceContainerLow);
  const sheetExpanded = !search.showEmptyState;

  useEffect(() => {
    if (!isOpen) return;
    const focusDelayMs = Math.round(M3_CONTAINER_TRANSFORM_ENTER_MS * FADE_THROUGH_INCOMING_START);
    const id = setTimeout(() => inputRef.current?.focus(), focusDelayMs);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    animateM3SpatialProgress(expandProgress, sheetExpanded ? 1 : 0, sheetExpanded);
  }, [expandProgress, sheetExpanded]);

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
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    height: interpolate(
      expandProgress.value,
      [0, 1],
      [idleSheetHeightPx, expandedSheetHeightPx],
      Extrapolation.CLAMP,
    ),
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

  const pillSurfaceColor = md.surfaceContainerLow;
  const showClear = search.query.length > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          ...StyleSheet.absoluteFill,
          zIndex: 5000,
          elevation: 24,
        },
        scrim: {
          ...StyleSheet.absoluteFill,
          backgroundColor: frostColor,
        },
        sheet: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: sheetBottomPx,
          borderTopLeftRadius: READER_M3_BOTTOM_SHEET_RADIUS_PX,
          borderTopRightRadius: READER_M3_BOTTOM_SHEET_RADIUS_PX,
          backgroundColor: md.surfaceContainerLow,
          overflow: "hidden",
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 8,
        },
        sheetHandle: {
          alignSelf: "center",
          width: READER_M3_BOTTOM_SHEET_HANDLE_WIDTH_PX,
          height: READER_M3_BOTTOM_SHEET_HANDLE_HEIGHT_PX,
          borderRadius: 999,
          backgroundColor: md.outlineVariant,
          marginBottom: 4,
        },
        dock: {
          position: "absolute",
          left: SEARCH_BAR_HORIZONTAL_INSET_PX,
          right: SEARCH_BAR_HORIZONTAL_INSET_PX,
          bottom: pillBottomPx,
          alignItems: "center",
        },
        pill: {
          height: SEARCH_PILL_HEIGHT_PX,
          borderRadius: SEARCH_PILL_RADIUS_PX,
          backgroundColor: pillSurfaceColor,
          overflow: "hidden",
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
        searchIcon: { marginRight: 12 },
        input: {
          flex: 1,
          fontFamily: "Inter_400Regular",
          fontSize: 16,
          color: md.onSurface,
          paddingVertical: 14,
          paddingRight: 6,
          margin: 0,
          minWidth: 0,
        },
        clearButton: {
          justifyContent: "center",
          alignItems: "center",
          width: 40,
          height: 40,
          borderRadius: 20,
        },
      }),
    [frostColor, md, pillBottomPx, pillSurfaceColor, sheetBottomPx],
  );


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

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.sheetHandle} pointerEvents="none" />
        <View style={{ flex: 1 }}>
          <SearchResultsBody
            search={search}
            bundle={bundle}
            onPickBookSuggestion={onPickBookSuggestion}
            onNavigateResult={dismissSearch}
          />
        </View>
      </Animated.View>

      <View pointerEvents="box-none" style={styles.dock}>
        <Animated.View style={[styles.pill, pillStyle]}>
          <Animated.View style={[styles.outgoingIcon, outgoingIconStyle]} pointerEvents="none">
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={md.onSurface}
            />
          </Animated.View>
          <Animated.View style={[styles.incomingPillContent, incomingPillContentStyle]}>
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={md.onSurface}
              style={styles.searchIcon}
            />
            <TextInput
              ref={inputRef}
              value={search.query}
              onChangeText={search.onSearchQueryChange}
              placeholder={voice.listening ? "Listening…" : "Search Bible, references, and journal"}
              placeholderTextColor={md.onSurfaceVariant}
              style={styles.input}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={md.primary}
              onSubmitEditing={search.onSubmitSearch}
            />
            {voice.available ? (
              <TouchableOpacity
                onPress={() => {
                  hapticLightImpact();
                  voice.toggle();
                }}
                activeOpacity={0.65}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearButton}
                accessibilityLabel={voice.listening ? "Stop voice search" : "Start voice search"}
                accessibilityRole="button"
                accessibilityState={{ selected: voice.listening }}
              >
                <MaterialCommunityIcons
                  name={voice.listening ? "microphone" : "microphone-outline"}
                    size={20}
                    color={voice.listening ? md.primary : md.onSurfaceVariant}
                />
              </TouchableOpacity>
            ) : null}
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
                <MaterialCommunityIcons name="close" size={20} color={md.onSurfaceVariant} />
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
                <MaterialCommunityIcons name="close" size={20} color={md.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
