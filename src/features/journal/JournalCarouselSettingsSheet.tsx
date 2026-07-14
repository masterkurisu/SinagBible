import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { M3SettingsSheetTitle } from "@/src/components/m3/M3SettingsSheetTitle";
import { M3Switch } from "@/components/M3Switch";
import { hapticLightImpact, hapticWarning } from "@/lib/haptics";
import {
  CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS,
  CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS,
  CAROUSEL_IMAGE_THEME_OPTIONS,
  CAROUSEL_ROTATION_INTERVAL_OPTIONS,
  getCarouselDefaultCardSizeLabel,
  getCarouselImageThemeLabel,
  JOURNAL_CAROUSEL_MAX_VERSE_COUNT,
  JOURNAL_CAROUSEL_MIN_VERSE_COUNT,
  loadJournalCarouselSettings,
  patchJournalCarouselSettings,
  type CarouselImageTheme,
  type JournalCarouselSettings,
} from "@/lib/journal-carousel-settings";
import { requestCarouselImageRefresh } from "@/lib/pexels-repository";
import {
  formatCarouselPassageLabel,
  JOURNAL_CAROUSEL_MAX_FAVORITES,
  loadCarouselFavorites,
  removeCarouselFavorite,
  subscribeCarouselFavorites,
  type CarouselVerseRecord,
} from "@/lib/journal-carousel-verses";
import { READER_M3_SURFACE_CONTAINER } from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalCarouselSettingsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
};

function SettingsRow({
  label,
  description,
  disabled = false,
  children,
  mutedColor,
  textColor,
}: {
  label: string;
  description?: string;
  disabled?: boolean;
  children: ReactNode;
  mutedColor: string;
  textColor: string;
}) {
  return (
    <View style={[styles.row, disabled ? styles.rowDisabled : null]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: disabled ? mutedColor : textColor }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: mutedColor }]}>{description}</Text>
        ) : null}
      </View>
      <View pointerEvents={disabled ? "none" : "auto"}>{children}</View>
    </View>
  );
}

export function JournalCarouselSettingsSheet({
  isOpen,
  onClose,
  bundle,
}: JournalCarouselSettingsSheetProps) {
  const colors = bundle.ui;
  const j = bundle.journal;
  const { width: screenW } = useWindowDimensions();
  const [settings, setSettings] = useState<JournalCarouselSettings | null>(null);
  const [favorites, setFavorites] = useState<CarouselVerseRecord[]>([]);
  const [imageThemeOpen, setImageThemeOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(isOpen);
  const isClosingRef = useRef(false);
  const scale = useSharedValue(0.94);
  const opacity = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);

  const sheetMaxW = Math.min(360, screenW - 48);

  const finishDismissAnimation = useCallback(() => {
    isClosingRef.current = false;
    setSheetMounted(false);
  }, []);

  const playCloseAnimation = useCallback(
    (done: () => void) => {
      scale.value = withSpring(0.94, { damping: 20, stiffness: 300 });
      opacity.value = withTiming(0, { duration: 140 });
      scrimOpacity.value = withTiming(0, { duration: 140 }, (finished) => {
        if (finished) runOnJS(done)();
      });
    },
    [opacity, scale, scrimOpacity],
  );

  const dismissSheet = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    hapticLightImpact();
    onClose();
    playCloseAnimation(finishDismissAnimation);
  }, [finishDismissAnimation, onClose, playCloseAnimation]);

  useEffect(() => {
    if (!isOpen) {
      setImageThemeOpen(false);
      return;
    }
    void loadJournalCarouselSettings().then(setSettings);
    void loadCarouselFavorites().then(setFavorites);
    return subscribeCarouselFavorites(() => {
      void loadCarouselFavorites().then(setFavorites);
    });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isClosingRef.current) {
      setSheetMounted(true);
      scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 180 });
      scrimOpacity.value = withTiming(1, { duration: 180 });
      return;
    }

    if (!isOpen && sheetMounted && !isClosingRef.current) {
      playCloseAnimation(() => {
        setSheetMounted(false);
      });
    }
  }, [isOpen, opacity, playCloseAnimation, scale, scrimOpacity, sheetMounted]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const patch = useCallback(async (patchValue: Partial<JournalCarouselSettings>) => {
    const next = await patchJournalCarouselSettings(patchValue);
    setSettings(next);
  }, []);

  const cycleInterval = useCallback(() => {
    if (!settings || settings.randomize) return;
    hapticLightImpact();
    const currentIndex = CAROUSEL_ROTATION_INTERVAL_OPTIONS.findIndex(
      (option) => option.value === settings.rotationInterval,
    );
    const nextIndex = (currentIndex + 1) % CAROUSEL_ROTATION_INTERVAL_OPTIONS.length;
    void patch({ rotationInterval: CAROUSEL_ROTATION_INTERVAL_OPTIONS[nextIndex]!.value });
  }, [patch, settings]);

  const cycleImageRefreshInterval = useCallback(() => {
    if (!settings) return;
    hapticLightImpact();
    const currentIndex = CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS.findIndex(
      (option) => option.value === settings.imageRefreshInterval,
    );
    const nextIndex = (currentIndex + 1) % CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS.length;
    void patch({
      imageRefreshInterval: CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS[nextIndex]!.value,
    });
  }, [patch, settings]);

  const cycleDefaultCardSize = useCallback(() => {
    if (!settings) return;
    hapticLightImpact();
    const currentIndex = CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS.findIndex(
      (option) => option.value === settings.defaultCardSize,
    );
    const nextIndex = (currentIndex + 1) % CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS.length;
    void patch({
      defaultCardSize: CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS[nextIndex]!.value,
    });
  }, [patch, settings]);

  const refreshImages = useCallback(() => {
    hapticLightImpact();
    void requestCarouselImageRefresh(settings?.imageTheme);
  }, [settings?.imageTheme]);

  const selectImageTheme = useCallback(
    (theme: CarouselImageTheme) => {
      if (!settings || settings.imageTheme === theme) {
        setImageThemeOpen(false);
        return;
      }
      hapticLightImpact();
      void patch({ imageTheme: theme }).then(() => {
        void requestCarouselImageRefresh(theme);
      });
      setImageThemeOpen(false);
    },
    [patch, settings],
  );

  const adjustVerseCount = useCallback(
    (delta: number) => {
      if (!settings || settings.randomize) return;
      hapticLightImpact();
      void patch({
        verseCount: Math.min(
          JOURNAL_CAROUSEL_MAX_VERSE_COUNT,
          Math.max(JOURNAL_CAROUSEL_MIN_VERSE_COUNT, settings.verseCount + delta),
        ),
      });
    },
    [patch, settings],
  );

  const sortedFavorites = useMemo(
    () =>
      [...favorites].sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      ),
    [favorites],
  );

  const confirmRemoveFavorite = useCallback((record: CarouselVerseRecord) => {
    const label = formatCarouselPassageLabel(record);
    hapticWarning();
    Alert.alert(
      "Remove from carousel?",
      `${label} will be removed from your journal carousel favorites.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            hapticLightImpact();
            void removeCarouselFavorite(record.id).then(setFavorites);
          },
        },
      ],
    );
  }, []);

  if (!settings) return null;

  const intervalLabel =
    CAROUSEL_ROTATION_INTERVAL_OPTIONS.find((option) => option.value === settings.rotationInterval)
      ?.label ?? "Daily";

  const imageRefreshIntervalLabel =
    CAROUSEL_IMAGE_REFRESH_INTERVAL_OPTIONS.find(
      (option) => option.value === settings.imageRefreshInterval,
    )?.label ?? "Manual only";

  const imageThemeLabel = getCarouselImageThemeLabel(settings.imageTheme);

  const defaultCardSizeLabel = getCarouselDefaultCardSizeLabel(settings.defaultCardSize);

  return (
    <Modal
      visible={sheetMounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissSheet}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissSheet}
          accessibilityRole="button"
          accessibilityLabel="Dismiss verse carousel settings"
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(44, 36, 22, 0.35)" },
              scrimAnimatedStyle,
            ]}
          />
        </Pressable>
        <View pointerEvents="box-none" style={styles.centerWrap}>
          <Animated.View style={[{ width: sheetMaxW }, animatedStyle]}>
            <View
              style={[
                styles.sheet,
                {
                  borderColor: j.panelBorder,
                  backgroundColor: j.panelBackground,
                  shadowColor: colors.brown800,
                },
              ]}
            >
              <M3SettingsSheetTitle title="Verse Carousel" style={{ marginBottom: 8 }} titleColor={colors.brown800} />

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
              >
                <SettingsRow
                  label="Randomize"
                  description="Shuffle verses automatically instead of cycling in order."
                  textColor={colors.brown800}
                  mutedColor={j.subtitleQuote}
                >
                  <M3Switch
                    value={settings.randomize}
                    onValueChange={() => {
                      hapticLightImpact();
                      void patch({ randomize: !settings.randomize });
                    }}
                    accessibilityLabel="Randomize carousel verses"
                    trackColorOn={colors.brown800}
                    trackColorOff={READER_M3_SURFACE_CONTAINER}
                    trackBorderOff={colors.brown800}
                    handleColorOn="#FFFFFF"
                    handleColorOff={colors.brown800}
                  />
                </SettingsRow>

                <SettingsRow
                  label="Randomize favorited verses"
                  description="Include verses you saved from the reader in the shuffle."
                  disabled={!settings.randomize}
                  textColor={colors.brown800}
                  mutedColor={j.subtitleQuote}
                >
                  <M3Switch
                    value={settings.randomizeFavorites}
                    onValueChange={() => {
                      if (!settings.randomize) return;
                      hapticLightImpact();
                      void patch({ randomizeFavorites: !settings.randomizeFavorites });
                    }}
                    accessibilityLabel="Randomize favorited verses"
                    trackColorOn={colors.brown800}
                    trackColorOff={READER_M3_SURFACE_CONTAINER}
                    trackBorderOff={colors.brown800}
                    handleColorOn="#FFFFFF"
                    handleColorOff={colors.brown800}
                  />
                </SettingsRow>

                <SettingsRow
                  label="Shuffle defaults daily"
                  description="Refresh the built-in fallback verses once per day."
                  disabled={!settings.randomize}
                  textColor={colors.brown800}
                  mutedColor={j.subtitleQuote}
                >
                  <M3Switch
                    value={settings.shuffleDefaultsDaily}
                    onValueChange={() => {
                      if (!settings.randomize) return;
                      hapticLightImpact();
                      void patch({ shuffleDefaultsDaily: !settings.shuffleDefaultsDaily });
                    }}
                    accessibilityLabel="Shuffle default verses daily"
                    trackColorOn={colors.brown800}
                    trackColorOff={READER_M3_SURFACE_CONTAINER}
                    trackBorderOff={colors.brown800}
                    handleColorOn="#FFFFFF"
                    handleColorOff={colors.brown800}
                  />
                </SettingsRow>

                <View style={[styles.sectionDivider, { backgroundColor: j.panelBorder }]} />

                <SettingsRow
                  label="Verses to show"
                  description={`Show ${settings.verseCount} card${settings.verseCount === 1 ? "" : "s"} at a time.`}
                  disabled={settings.randomize}
                  textColor={colors.brown800}
                  mutedColor={j.subtitleQuote}
                >
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => adjustVerseCount(-1)}
                      disabled={settings.randomize || settings.verseCount <= JOURNAL_CAROUSEL_MIN_VERSE_COUNT}
                      style={[
                        styles.stepperButton,
                        {
                          borderColor: j.panelBorder,
                          backgroundColor: j.filterOpenerBackground,
                          opacity:
                            settings.randomize || settings.verseCount <= JOURNAL_CAROUSEL_MIN_VERSE_COUNT
                              ? 0.45
                              : 1,
                        },
                      ]}
                      accessibilityLabel="Show fewer verses"
                    >
                      <Text style={[styles.stepperGlyph, { color: colors.brown800 }]}>−</Text>
                    </Pressable>
                    <Text style={[styles.stepperValue, { color: colors.brown800 }]}>
                      {settings.verseCount}
                    </Text>
                    <Pressable
                      onPress={() => adjustVerseCount(1)}
                      disabled={settings.randomize || settings.verseCount >= JOURNAL_CAROUSEL_MAX_VERSE_COUNT}
                      style={[
                        styles.stepperButton,
                        {
                          borderColor: j.panelBorder,
                          backgroundColor: j.filterOpenerBackground,
                          opacity:
                            settings.randomize || settings.verseCount >= JOURNAL_CAROUSEL_MAX_VERSE_COUNT
                              ? 0.45
                              : 1,
                        },
                      ]}
                      accessibilityLabel="Show more verses"
                    >
                      <Text style={[styles.stepperGlyph, { color: colors.brown800 }]}>+</Text>
                    </Pressable>
                  </View>
                </SettingsRow>

                <Pressable
                  onPress={cycleInterval}
                  disabled={settings.randomize}
                  style={[
                    styles.intervalRow,
                    {
                      borderColor: j.panelBorder,
                      backgroundColor: j.filterOpenerBackground,
                      opacity: settings.randomize ? 0.45 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change favorite rotation frequency"
                  accessibilityState={{ disabled: settings.randomize }}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.brown800 }]}>Change frequency</Text>
                    <Text style={[styles.rowDescription, { color: j.subtitleQuote }]}>
                      How often favorites rotate when randomize is off.
                    </Text>
                  </View>
                  <Text style={[styles.intervalValue, { color: j.filterOpenerText }]}>{intervalLabel}</Text>
                </Pressable>

                <View style={[styles.sectionDivider, { backgroundColor: j.panelBorder }]} />

                <View>
                  <Text style={[styles.sectionTitle, { color: colors.brown800 }]}>Card layout</Text>
                  <Text style={[styles.sectionDescription, { color: j.subtitleQuote }]}>
                    Default width for carousel cards. Long-press a card to resize individually.
                  </Text>

                  <Pressable
                    onPress={cycleDefaultCardSize}
                    style={[
                      styles.intervalRow,
                      {
                        borderColor: j.panelBorder,
                        backgroundColor: j.filterOpenerBackground,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Change default card size"
                  >
                    <View style={styles.rowText}>
                      <Text style={[styles.rowLabel, { color: colors.brown800 }]}>Default card size</Text>
                      <Text style={[styles.rowDescription, { color: j.subtitleQuote }]}>
                        Applies to all cards unless you set a size per card.
                      </Text>
                    </View>
                    <Text style={[styles.intervalValue, { color: j.filterOpenerText }]}>
                      {defaultCardSizeLabel}
                    </Text>
                  </Pressable>
                </View>

                <View style={[styles.sectionDivider, { backgroundColor: j.panelBorder }]} />

                <View>
                  <Text style={[styles.sectionTitle, { color: colors.brown800 }]}>Background images</Text>
                  <Text style={[styles.sectionDescription, { color: j.subtitleQuote }]}>
                    Photos behind each carousel card.
                  </Text>

                  <View
                    style={[
                      styles.imageSectionGroup,
                      {
                        borderColor: j.panelBorder,
                        backgroundColor: j.filterOpenerBackground,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        hapticLightImpact();
                        setImageThemeOpen((open) => !open);
                      }}
                      style={styles.imageThemeField}
                      accessibilityRole="button"
                      accessibilityLabel="Choose image search theme"
                      accessibilityState={{ expanded: imageThemeOpen }}
                    >
                      <View style={styles.imageThemeFieldHeader}>
                        <Text style={[styles.imageSectionCaption, { color: j.subtitleQuote }]}>
                          Image theme
                        </Text>
                        <MaterialIcons
                          name={imageThemeOpen ? "expand-less" : "expand-more"}
                          size={18}
                          color={j.filterOpenerText}
                        />
                      </View>
                      <Text style={[styles.imageThemeFieldValue, { color: colors.brown800 }]}>
                        {imageThemeLabel}
                      </Text>
                    </Pressable>

                    {imageThemeOpen ? (
                      <View
                        style={[
                          styles.imageThemeDropdown,
                          { borderTopColor: j.panelBorder },
                        ]}
                      >
                        {CAROUSEL_IMAGE_THEME_OPTIONS.map((option, index) => {
                          const selected = settings.imageTheme === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() => selectImageTheme(option.value)}
                              style={[
                                styles.imageThemeOption,
                                index > 0
                                  ? {
                                      borderTopWidth: StyleSheet.hairlineWidth,
                                      borderTopColor: j.panelBorder,
                                    }
                                  : null,
                                selected ? { backgroundColor: j.panelBackground } : null,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={`Use ${option.label} image theme`}
                              accessibilityState={{ selected }}
                            >
                              <Text
                                style={[
                                  styles.imageThemeOptionLabel,
                                  { color: selected ? colors.brown800 : j.filterOpenerText },
                                ]}
                              >
                                {option.label}
                              </Text>
                              {selected ? (
                                <MaterialIcons name="check" size={16} color={colors.brown800} />
                              ) : (
                                <View style={styles.imageThemeOptionSpacer} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={[styles.imageSectionDivider, { backgroundColor: j.panelBorder }]} />

                    <Pressable
                      onPress={refreshImages}
                      style={styles.imageSectionRow}
                      accessibilityRole="button"
                      accessibilityLabel="Refresh carousel background images"
                    >
                      <Text style={[styles.imageSectionRowLabel, { color: colors.brown800 }]}>
                        Refresh images
                      </Text>
                      <MaterialIcons name="refresh" size={18} color={j.filterOpenerText} />
                    </Pressable>

                    <View style={[styles.imageSectionDivider, { backgroundColor: j.panelBorder }]} />

                    <Pressable
                      onPress={cycleImageRefreshInterval}
                      style={styles.imageSectionRow}
                      accessibilityRole="button"
                      accessibilityLabel="Change background image refresh frequency"
                    >
                      <Text style={[styles.imageSectionRowLabel, { color: colors.brown800 }]}>
                        Auto-refresh
                      </Text>
                      <Text style={[styles.imageSectionRowValue, { color: j.filterOpenerText }]}>
                        {imageRefreshIntervalLabel}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={[styles.sectionDivider, { backgroundColor: j.panelBorder }]} />

                <View>
                  <Text style={[styles.sectionTitle, { color: colors.brown800 }]}>Saved verses</Text>
                  <Text style={[styles.sectionDescription, { color: j.subtitleQuote }]}>
                    {sortedFavorites.length} of {JOURNAL_CAROUSEL_MAX_FAVORITES} saved from the reader.
                  </Text>
                  {sortedFavorites.length === 0 ? (
                    <Text style={[styles.emptyFavorites, { color: j.subtitleQuote }]}>
                      No saved verses yet. Select a verse in the reader and tap the heart to save it
                      here.
                    </Text>
                  ) : (
                    <View style={styles.favoritesList}>
                      {sortedFavorites.map((record) => {
                        const label = formatCarouselPassageLabel(record);
                        return (
                          <View
                            key={record.id}
                            style={[
                              styles.favoriteRow,
                              {
                                borderColor: j.panelBorder,
                                backgroundColor: j.filterOpenerBackground,
                              },
                            ]}
                          >
                            <View style={styles.favoriteRowText}>
                              <Text
                                style={[styles.favoriteReference, { color: colors.brown800 }]}
                                numberOfLines={1}
                              >
                                {label}
                              </Text>
                              <Text
                                style={[styles.favoriteSnippet, { color: j.subtitleQuote }]}
                                numberOfLines={2}
                              >
                                {record.text}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => confirmRemoveFavorite(record)}
                              style={styles.favoriteRemoveButton}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${label} from carousel`}
                            >
                              <MaterialIcons name="bookmark-remove" size={22} color="#B3261E" />
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    maxHeight: "82%",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  rowDescription: {
    marginTop: 2,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperGlyph: {
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    lineHeight: 20,
  },
  stepperValue: {
    minWidth: 28,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  intervalRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  intervalValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  imageSectionGroup: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  imageThemeField: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imageThemeFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  imageSectionCaption: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 14,
  },
  imageThemeFieldValue: {
    marginTop: 2,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  imageThemeDropdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  imageThemeOption: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  imageThemeOptionLabel: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  imageThemeOptionSpacer: {
    width: 16,
    height: 16,
  },
  imageSectionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  imageSectionRow: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  imageSectionRowLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  imageSectionRowValue: {
    flexShrink: 0,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
  sectionTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionDescription: {
    marginTop: 2,
    marginBottom: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  emptyFavorites: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  favoritesList: {
    gap: 8,
  },
  favoriteRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoriteRowText: {
    flex: 1,
    minWidth: 0,
  },
  favoriteReference: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  favoriteSnippet: {
    marginTop: 2,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  favoriteRemoveButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
});
