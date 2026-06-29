import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import {
  FlatList as GHFlatList,
  PanGestureHandler,
  TouchableOpacity as GestureHandlerTouchableOpacity,
  State,
} from "react-native-gesture-handler";
import {
  getExternalApiId,
  getInternalIdFromApiId,
  isTranslationId,
} from "@sinag-bible/core/bible-translations";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { FilterListIcon } from "@/components/icons/FilterListIcon";
import {
  compareTranslationPickerAbbreviations,
  getTranslationPickerAbbreviation,
  type TranslationPickerItem,
} from "@/lib/use-translation-picker";
import { getTranslationLanguageFilterOptions } from "@/lib/translation-language-sections";
import { hapticLightImpact } from "@/lib/haptics";
import { READER_MENU_SLIDE_FROM_PX } from "@/src/features/reader/useReaderGestures";

type TranslationPinButtonProps = {
  isPinned: boolean;
  onPress: () => void;
  ui: MobileAppThemeBundle["ui"];
};

function TranslationPinButton({ isPinned, onPress, ui }: TranslationPinButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={isPinned ? "Unpin translation" : "Pin translation"}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isPinned ? `${ui.gold}40` : `${ui.goldMuted}28`,
        borderWidth: 1.5,
        borderColor: isPinned ? ui.gold : `${ui.goldMuted}99`,
      }}
    >
      <Ionicons
        name={isPinned ? "star" : "star-outline"}
        size={20}
        color={isPinned ? ui.gold : ui.goldMuted}
      />
    </TouchableOpacity>
  );
}

export type TranslationPickerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectTranslation: (translationId: string) => void;
  sheetTopPx: number;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  translationPickerItems: TranslationPickerItem[];
  favoriteTranslationIds: string[];
  toggleFavoriteTranslation: (id: string) => void;
  resolvedTranslationId: string;
};

export function TranslationPickerSheet({
  isOpen,
  onClose,
  onSelectTranslation,
  sheetTopPx,
  bundle,
  insets,
  translationPickerItems,
  favoriteTranslationIds,
  toggleFavoriteTranslation,
  resolvedTranslationId,
}: TranslationPickerSheetProps) {
  const colors = bundle.ui;
  const rc = bundle.reader;

  const resolvedTranslationApiId: string = isTranslationId(resolvedTranslationId)
    ? getExternalApiId(resolvedTranslationId)
    : resolvedTranslationId;

  const [searchQuery, setSearchQuery] = useState("");
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [langSheetKeyboardHeight, setLangSheetKeyboardHeight] = useState(0);
  const [langSearch, setLangSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string | null>(null);

  const screenHeight = Dimensions.get("screen").height;
  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  const translationPickerSheetTranslateY = useRef(new Animated.Value(0)).current;
  const translationPickerSheetClosingRef = useRef(false);
  const translationPickerSheetDragStartYRef = useRef(0);
  const langSheetTranslateY = useRef(new Animated.Value(0)).current;
  const langSheetClosingRef = useRef(false);
  const langSheetDragStartYRef = useRef(0);
  const langSearchInputRef = useRef<TextInput>(null);

  const availableLanguages = useMemo(
    () => getTranslationLanguageFilterOptions(translationPickerItems),
    [translationPickerItems],
  );

  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return availableLanguages;
    return availableLanguages.filter((l) => l.toLowerCase().includes(q));
  }, [availableLanguages, langSearch]);

  const filteredTranslations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = translationPickerItems.filter((item) => {
      if (langFilter && item.languageSection !== langFilter) return false;
      if (!query) return true;
      const abbr = getTranslationPickerAbbreviation(item).toLowerCase();
      return item.label.toLowerCase().includes(query) || abbr.includes(query);
    });
    if (langFilter != null) {
      return filtered.slice().sort(compareTranslationPickerAbbreviations);
    }
    return filtered;
  }, [langFilter, searchQuery, translationPickerItems]);

  const showResults = useMemo(
    () => searchQuery.trim().length > 0 || langFilter != null,
    [searchQuery, langFilter],
  );

  const translationSheetViewportMaxH = useMemo(
    () => Math.max(280, screenHeight - sheetTopPx - Math.max(insets.bottom, 12) - 10),
    [screenHeight, sheetTopPx, insets.bottom],
  );

  const translationCompactScrollMaxH = useMemo(
    () => Math.max(160, translationSheetViewportMaxH - 268),
    [translationSheetViewportMaxH],
  );

  const langSheetTopPx = useMemo(() => Math.max(insets.top + 66, 38), [insets.top]);
  const langSheetDefaultMaxH = useMemo(
    () =>
      Math.min(
        screenHeight * 0.82,
        screenHeight - langSheetTopPx - Math.max(insets.bottom, 12) - 8,
      ),
    [screenHeight, langSheetTopPx, insets.bottom],
  );
  const langSheetMaxHeight = useMemo(() => {
    if (langSheetKeyboardHeight <= 0) return langSheetDefaultMaxH;
    return Math.max(
      220,
      Math.min(langSheetDefaultMaxH, screenHeight - langSheetTopPx - langSheetKeyboardHeight - 12),
    );
  }, [langSheetKeyboardHeight, langSheetDefaultMaxH, screenHeight, langSheetTopPx]);
  const langSheetListBodyHeight = useMemo(() => Math.max(120, langSheetMaxHeight - 254), [langSheetMaxHeight]);

  const dismissLangSearchKeyboard = useCallback(() => {
    langSearchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const closeLangSheet = useCallback(() => {
    langSearchInputRef.current?.blur();
    Keyboard.dismiss();
    setLangSheetOpen(false);
    setLangSearch("");
    langSheetTranslateY.setValue(0);
  }, [langSheetTranslateY]);

  const animateCloseTranslationPickerSheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (translationPickerSheetClosingRef.current) return;
      translationPickerSheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      translationPickerSheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) translationPickerSheetTranslateY.setValue(clamped);
      Animated.timing(translationPickerSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        translationPickerSheetClosingRef.current = false;
        translationPickerSheetTranslateY.setValue(0);
        onClose();
      });
    },
    [translationPickerSheetTranslateY, onClose],
  );

  const onTranslationPickerDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (translationPickerSheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      translationPickerSheetTranslateY.setValue(
        Math.max(0, translationPickerSheetDragStartYRef.current + ty),
      );
    },
    [translationPickerSheetTranslateY],
  );

  const onTranslationPickerDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        translationPickerSheetTranslateY.stopAnimation((value: number) => {
          translationPickerSheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (translationPickerSheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, translationPickerSheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > 90 || vyPxPerS > 520) {
          animateCloseTranslationPickerSheet(velForCloseAnim, y);
          return;
        }
        Animated.spring(translationPickerSheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateCloseTranslationPickerSheet, translationPickerSheetTranslateY],
  );

  const animateCloseLangSheetSlide = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (langSheetClosingRef.current) return;
      langSheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      langSheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) langSheetTranslateY.setValue(clamped);
      Animated.timing(langSheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        langSheetClosingRef.current = false;
        langSheetTranslateY.setValue(0);
        closeLangSheet();
      });
    },
    [langSheetTranslateY, closeLangSheet],
  );

  const onLangSheetDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (langSheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      langSheetTranslateY.setValue(Math.max(0, langSheetDragStartYRef.current + ty));
    },
    [langSheetTranslateY],
  );

  const onLangSheetDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        langSheetTranslateY.stopAnimation((value: number) => {
          langSheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (langSheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, langSheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > 90 || vyPxPerS > 520) {
          animateCloseLangSheetSlide(velForCloseAnim, y);
          return;
        }
        Animated.spring(langSheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateCloseLangSheetSlide, langSheetTranslateY],
  );

  const onLangSheetBackdropPress = useCallback(() => {
    dismissLangSearchKeyboard();
    if (langSheetClosingRef.current) return;
    hapticLightImpact();
    animateCloseLangSheetSlide(0, 0);
  }, [animateCloseLangSheetSlide, dismissLangSearchKeyboard]);

  const renderLangSheetItem = useCallback(
    ({ item }: { item: string }) => {
      const selected = item === langFilter;
      const ui = bundle.ui;
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            dismissLangSearchKeyboard();
            setLangFilter(item);
            closeLangSheet();
          }}
          style={{
            minHeight: 44,
            borderBottomWidth: 1,
            borderBottomColor: ui.borderSolid,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            backgroundColor: selected ? `${ui.gold}22` : "transparent",
          }}
        >
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: ui.brown800 }}>{item}</Text>
          {selected ? <Ionicons name="checkmark" size={16} color={ui.gold} /> : null}
        </TouchableOpacity>
      );
    },
    [langFilter, closeLangSheet, bundle.ui, dismissLangSearchKeyboard],
  );

  const onBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    if (translationPickerSheetClosingRef.current) return;
    hapticLightImpact();
    animateCloseTranslationPickerSheet(0, 0);
  }, [animateCloseTranslationPickerSheet]);

  const selectTranslation = useCallback(
    (id: string) => {
      Keyboard.dismiss();
      hapticLightImpact();
      onClose();
      const internalId = getInternalIdFromApiId(id);
      onSelectTranslation(internalId ?? id);
    },
    [onClose, onSelectTranslation],
  );

  useEffect(() => {
    if (!isOpen) {
      translationPickerSheetClosingRef.current = false;
      translationPickerSheetTranslateY.stopAnimation();
      translationPickerSheetTranslateY.setValue(0);
      setLangSheetOpen(false);
      setLangFilter(null);
      setLangSearch("");
      setSearchQuery("");
      dropSlideAnim.setValue(0);
      dropOpacityAnim.setValue(0);
      return;
    }
    dropSlideAnim.setValue(0);
    dropOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(dropSlideAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dropOpacityAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, dropSlideAnim, dropOpacityAnim, translationPickerSheetTranslateY]);

  useEffect(() => {
    if (!langSheetOpen) {
      langSheetClosingRef.current = false;
      langSheetTranslateY.stopAnimation();
      langSheetTranslateY.setValue(0);
    }
  }, [langSheetOpen, langSheetTranslateY]);

  useEffect(() => {
    if (!langSheetOpen) {
      setLangSheetKeyboardHeight(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => setLangSheetKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setLangSheetKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [langSheetOpen]);

  const pinnedTranslations = useMemo(() => {
    const byId = new Map(translationPickerItems.map((item) => [item.id, item]));
    return favoriteTranslationIds
      .map((id) => byId.get(id))
      .filter((item): item is TranslationPickerItem => item != null);
  }, [translationPickerItems, favoriteTranslationIds]);
  const ui = colors;

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={onBackdropPress}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: rc.menuScrim }]}
          onPress={onBackdropPress}
          accessibilityLabel="Dismiss translation picker"
        />
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: sheetTopPx,
            left: insets.left + 5,
            right: insets.right + 5,
            ...(showResults ? { bottom: insets.bottom + 10 } : { maxHeight: translationSheetViewportMaxH }),
            opacity: dropOpacityAnim,
            transform: [
              {
                translateY: dropSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-READER_MENU_SLIDE_FROM_PX, 0],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.borderSolid,
              backgroundColor: rc.popoverSurface,
              overflow: "hidden",
              shadowColor: rc.popoverShadow,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.16,
              shadowRadius: 14,
              elevation: 8,
              ...(showResults ? { flex: 1, minHeight: 0 } : {}),
            }}
          >
            <Animated.View
              style={{
                ...(showResults ? { flex: 1, minHeight: 0 } : {}),
                transform: [{ translateY: translationPickerSheetTranslateY }],
              }}
            >
              <PanGestureHandler
                onGestureEvent={onTranslationPickerDismissGestureEvent}
                onHandlerStateChange={onTranslationPickerDismissGestureStateChange}
                activeOffsetY={8}
                failOffsetX={[-32, 32]}
              >
                <GestureHandlerTouchableOpacity
                  activeOpacity={1}
                  onPress={Keyboard.dismiss}
                  accessibilityLabel="Translation picker sheet"
                  accessibilityHint="Tap to hide keyboard, or swipe down on the handle to close"
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 6,
                    paddingBottom: 8,
                    minHeight: 44,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      width: 40,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: "rgba(0,0,0,0.22)",
                    }}
                  />
                </GestureHandlerTouchableOpacity>
              </PanGestureHandler>
            <View
              style={{
                ...(showResults ? { flex: 1, minHeight: 0 } : {}),
                backgroundColor: ui.parchment,
                paddingHorizontal: 16,
                paddingTop: 6,
                paddingBottom: 14,
              }}
            >
              <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 20,
                    color: ui.brown800,
                    marginBottom: 14,
                  }}
                >
                  Choose a Translation
                </Text>
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <View
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: ui.borderSolid,
                    backgroundColor: rc.popoverRow,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                  }}
                >
                  <TextInput
                    placeholder="Search translation"
                    placeholderTextColor={ui.tan300}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 14,
                      color: ui.brown800,
                    }}
                  />
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    Keyboard.dismiss();
                    requestAnimationFrame(() => {
                      setSearchQuery("");
                      langSheetTranslateY.setValue(0);
                      setLangSheetOpen(true);
                    });
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: ui.borderSolid,
                    backgroundColor: rc.popoverRow,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FilterListIcon size={16} color={ui.brown800} />
                </TouchableOpacity>
              </View>

              <Pressable
                onPress={Keyboard.dismiss}
                accessibilityRole="button"
                accessibilityLabel="Hide keyboard"
                style={{ marginBottom: 12, minHeight: 12, justifyContent: "center" }}
              >
                <View style={{ height: 1, backgroundColor: ui.borderSolid, opacity: 0.9 }} />
              </Pressable>

              <ScrollView
                style={
                  showResults
                    ? { flex: 1, minHeight: 0 }
                    : { maxHeight: translationCompactScrollMaxH }
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
                onScrollBeginDrag={() => Keyboard.dismiss()}
              >
                <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: ui.tan300,
                      opacity: 0.75,
                      marginBottom: 8,
                    }}
                  >
                    Pinned
                  </Text>
                </Pressable>

                <View style={{ gap: 8, marginBottom: 16 }}>
                  {pinnedTranslations.length > 0 ? pinnedTranslations.map((item, index) => {
                    const abbr = getTranslationPickerAbbreviation(item);
                    return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => selectTranslation(item.id)}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: ui.borderSolid,
                        backgroundColor: index === 0 ? `${ui.gold}22` : rc.popoverRow,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Lora_400Regular_Italic",
                          fontSize: 12,
                          color: ui.brown800,
                          width: 48,
                        }}
                      >
                        {abbr}
                      </Text>
                      <View
                        style={{
                          width: 1,
                          alignSelf: "stretch",
                          backgroundColor: index === 0 ? `${ui.gold}73` : ui.borderSolid,
                          opacity: index === 0 ? 1 : 0.9,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: ui.brown800 }} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: ui.tan300 }}>
                          {item.languageSection}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {item.id === resolvedTranslationApiId ? <Ionicons name="checkmark" size={15} color={ui.gold} /> : null}
                        <TranslationPinButton
                          isPinned
                          onPress={() => {
                            Keyboard.dismiss();
                            toggleFavoriteTranslation(item.id);
                          }}
                          ui={ui}
                        />
                      </View>
                    </TouchableOpacity>
                  );}) : (
                    <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="Hide keyboard">
                    <View style={{ gap: 6, paddingVertical: 6 }}>
                      <View style={{ height: 4, width: "72%", borderRadius: 999, backgroundColor: ui.borderSolid }} />
                      <View style={{ height: 4, width: "58%", borderRadius: 999, backgroundColor: ui.borderSolid }} />
                      <View style={{ height: 4, width: "43%", borderRadius: 999, backgroundColor: ui.borderSolid }} />
                      <Text style={{ fontFamily: "Lora_400Regular_Italic", fontSize: 12, color: ui.tan300 }}>
                        Star a translation to pin it here
                      </Text>
                    </View>
                    </Pressable>
                  )}
                </View>

                {showResults ? (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {filteredTranslations.map((item) => {
                      const isPinned = favoriteTranslationIds.includes(item.id);
                      const abbr = getTranslationPickerAbbreviation(item);
                      return (
                        <TouchableOpacity
                          key={`result-${item.id}`}
                          activeOpacity={0.85}
                          onPress={() => selectTranslation(item.id)}
                          style={{
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: ui.borderSolid,
                            backgroundColor: item.id === resolvedTranslationApiId ? `${ui.gold}22` : rc.popoverRow,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Lora_400Regular_Italic",
                              fontSize: 12,
                              color: ui.brown800,
                              width: 48,
                            }}
                          >
                            {abbr}
                          </Text>
                          <View
                            style={{
                              width: 1,
                              alignSelf: "stretch",
                              backgroundColor: item.id === resolvedTranslationApiId ? `${ui.gold}73` : ui.borderSolid,
                              opacity: item.id === resolvedTranslationApiId ? 1 : 0.9,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: ui.brown800 }} numberOfLines={1}>
                              {item.label}
                            </Text>
                            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: ui.tan300 }}>
                              {item.languageSection}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {item.id === resolvedTranslationApiId ? <Ionicons name="checkmark" size={15} color={ui.gold} /> : null}
                            <TranslationPinButton
                              isPinned={isPinned}
                              onPress={() => {
                                Keyboard.dismiss();
                                toggleFavoriteTranslation(item.id);
                              }}
                              ui={ui}
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  Keyboard.dismiss();
                  if (translationPickerSheetClosingRef.current) return;
                  hapticLightImpact();
                  animateCloseTranslationPickerSheet(0, 0);
                }}
                style={{
                  width: "100%",
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: ui.brown800,
                }}
              >
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: ui.parchment }}>Done</Text>
              </TouchableOpacity>
            </View>
            </Animated.View>
          </View>
        </Animated.View>
        {langSheetOpen ? (
      <View
        pointerEvents="box-none"
        style={{
          ...StyleSheet.absoluteFill,
          zIndex: 5,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `${bundle.ui.brown800}66`,
          }}
        />
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={onLangSheetBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Dismiss language filters"
          />
          <Animated.View
            style={{
              position: "absolute",
              left: insets.left + 5,
              right: insets.right + 5,
              top: langSheetTopPx,
              maxHeight: langSheetMaxHeight,
              backgroundColor: bundle.ui.parchment,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: bundle.ui.borderSolid,
              overflow: "hidden",
              transform: [{ translateY: langSheetTranslateY }],
            }}
          >
            <View>
              <PanGestureHandler
                onGestureEvent={onLangSheetDismissGestureEvent}
                onHandlerStateChange={onLangSheetDismissGestureStateChange}
                activeOffsetY={8}
                failOffsetX={[-32, 32]}
              >
                <GestureHandlerTouchableOpacity
                  activeOpacity={1}
                  onPress={dismissLangSearchKeyboard}
                  accessibilityLabel="Language filters sheet"
                  accessibilityHint="Tap to hide keyboard, or swipe down on the handle to close"
                  style={{
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: 8,
                    paddingBottom: 6,
                    minHeight: 44,
                  }}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      width: 40,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: "rgba(0,0,0,0.22)",
                    }}
                  />
                </GestureHandlerTouchableOpacity>
              </PanGestureHandler>
              <View
                style={{ paddingHorizontal: 16, paddingBottom: 10 }}
              >
                <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 10, minHeight: 24 }}>
                  <GestureHandlerTouchableOpacity
                    activeOpacity={1}
                    onPress={dismissLangSearchKeyboard}
                    accessibilityRole="button"
                    accessibilityLabel="Hide keyboard"
                  >
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: bundle.ui.brown800 }}>
                      Language
                    </Text>
                  </GestureHandlerTouchableOpacity>
                  {langFilter != null ? (
                    <TouchableOpacity
                      style={{ position: "absolute", right: 0 }}
                      onPress={() => {
                        dismissLangSearchKeyboard();
                        setLangFilter(null);
                        closeLangSheet();
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: bundle.ui.tan300 }}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View
                  style={{
                    height: 42,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: bundle.ui.borderSolid,
                    backgroundColor: bundle.reader.popoverRow,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <TextInput
                    ref={langSearchInputRef}
                    value={langSearch}
                    onChangeText={setLangSearch}
                    placeholder="Search language"
                    placeholderTextColor={bundle.ui.tan300}
                    style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: bundle.ui.brown800 }}
                  />
                </View>
              </View>
              <GHFlatList
                data={filteredLanguages}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
                onScrollBeginDrag={dismissLangSearchKeyboard}
                style={{ height: langSheetListBodyHeight }}
                showsVerticalScrollIndicator
                persistentScrollbar
                indicatorStyle="black"
                removeClippedSubviews={false}
                initialNumToRender={16}
                windowSize={8}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
                ListFooterComponent={
                  <Pressable
                    style={{ minHeight: 72 }}
                    onPress={dismissLangSearchKeyboard}
                    accessibilityRole="button"
                    accessibilityLabel="Hide keyboard"
                  />
                }
                renderItem={renderLangSheetItem}
              />
              <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    dismissLangSearchKeyboard();
                    if (langSheetClosingRef.current) return;
                    hapticLightImpact();
                    closeLangSheet();
                  }}
                  style={{
                    width: "100%",
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: bundle.ui.brown800,
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: bundle.ui.parchment }}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
        ) : null}
      </View>
    </Modal>
  );
}
