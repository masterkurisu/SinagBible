import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Animated,
  Easing,
  Platform,
  type LayoutRectangle,
  type View,
} from "react-native";
import type { Href } from "expo-router";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { CreditsSheet } from "@/components/credits-sheet";
import { PrivacyPolicySheet } from "@/components/privacy-policy-sheet";
import { TermsOfServiceSheet } from "@/components/terms-of-service-sheet";
import { deleteAllUserData } from "@/lib/delete-my-data";
import { useFavoriteTranslations } from "@/lib/use-favorite-translations";
import { peekReaderLastPosition, saveReaderLastPosition } from "@/lib/reader-last-position";
import { readerChapterHref } from "@/lib/reader-navigation";
import { getReaderTranslationLanguageLabel } from "@/lib/reader-translation-language";
import { useTranslationPicker } from "@/lib/use-translation-picker";
import { ReaderDeleteMyDataDialog } from "@/src/features/reader/ReaderDeleteMyDataDialog";
import { ReaderFontSettingsSheet } from "@/src/features/reader/ReaderFontSettingsSheet";
import { ReaderMoreSettingsSheet } from "@/src/features/reader/ReaderMoreSettingsSheet";
import { ReaderModals, ReaderMobileSettingsPanel, type ReaderToolsDropdown } from "@/src/features/reader/ReaderModals";
import { TranslationPickerSheet } from "@/src/features/reader/TranslationPickerSheet";
import { useReaderChapter } from "@/src/features/reader/useReaderChapter";
import { useReaderPreferences } from "@/src/features/reader/useReaderPreferences";

const STUB_CHAPTER = {
  bookName: "Genesis",
  bookSlug: "genesis",
  chapterNumber: 1,
  verses: [] as string[],
};

type ReaderSettingsFollowUpLayerProps = {
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  windowWidth: number;
  scrollPaddingTop: number;
  toolsMenuOpen: boolean;
  isTabletReaderLayout: boolean;
  rippleColor?: string;
  closeToolsMenu: () => void;
  scheduleAfterMobileReaderMenuClose: (fn: () => void) => void;
  clearMobileSettingsFollowUp: () => void;
  onNavigate: (href: Href) => void;
  hideTranslationAndStudyNotes?: boolean;
  onSelectVerseCarousel?: () => void;
  /** Theme page background for the settings side sheet. */
  panelBackgroundColor: string;
};

export function useReaderSettingsFollowUpState({
  closeToolsMenu,
  scheduleAfterMobileReaderMenuClose,
  clearMobileSettingsFollowUp,
  windowWidth,
  insets,
}: {
  closeToolsMenu: () => void;
  scheduleAfterMobileReaderMenuClose: (fn: () => void) => void;
  clearMobileSettingsFollowUp: () => void;
  windowWidth: number;
  insets: { top: number };
}) {
  const [readerPrivacyPolicyOpen, setReaderPrivacyPolicyOpen] = useState(false);
  const [readerTermsOpen, setReaderTermsOpen] = useState(false);
  const [readerCreditsOpen, setReaderCreditsOpen] = useState(false);
  const [commentaryPanelOpen, setCommentaryPanelOpen] = useState(false);
  const [fontSettingsSheetOpen, setFontSettingsSheetOpen] = useState(false);
  const [moreSettingsSheetOpen, setMoreSettingsSheetOpen] = useState(false);
  const [deleteMyDataDialogOpen, setDeleteMyDataDialogOpen] = useState(false);
  const [readerDropdown, setReaderDropdown] = useState<ReaderToolsDropdown | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<LayoutRectangle | null>(null);
  const [bookSheetExitAnimationStarted, setBookSheetExitAnimationStarted] = useState(false);

  const dropSlideAnim = useRef(new Animated.Value(0)).current;
  const dropOpacityAnim = useRef(new Animated.Value(0)).current;
  const themesFanRef = useRef<View | null>(null);
  const translationFanRef = useRef<View | null>(null);

  const closeReaderDropdown = useCallback(() => {
    clearMobileSettingsFollowUp();
    setBookSheetExitAnimationStarted(false);
    setReaderDropdown(null);
    setDropdownAnchor(null);
  }, [clearMobileSettingsFollowUp]);

  const closeFontSettingsPopup = useCallback(() => {
    clearMobileSettingsFollowUp();
    setFontSettingsSheetOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const closeMoreSettingsPopup = useCallback(() => {
    clearMobileSettingsFollowUp();
    setMoreSettingsSheetOpen(false);
  }, [clearMobileSettingsFollowUp]);

  const closeDeleteMyDataDialog = useCallback(() => {
    clearMobileSettingsFollowUp();
    setDeleteMyDataDialogOpen(false);
  }, [clearMobileSettingsFollowUp]);

  useEffect(() => {
    if (!readerDropdown) {
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
  }, [dropOpacityAnim, dropSlideAnim, readerDropdown]);

  const openMobileReaderThemesFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setDropdownAnchor({ x: Math.floor(windowWidth / 2), y: insets.top + 52, width: 0, height: 0 });
      setReaderDropdown("theme");
    });
  }, [closeToolsMenu, insets.top, scheduleAfterMobileReaderMenuClose, windowWidth]);

  const openMobileReaderTranslationFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setDropdownAnchor({ x: Math.floor(windowWidth / 2), y: insets.top + 52, width: 0, height: 0 });
      setReaderDropdown("translation");
    });
  }, [closeToolsMenu, insets.top, scheduleAfterMobileReaderMenuClose, windowWidth]);

  const openMobileReaderCommentaryFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setCommentaryPanelOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openMobileReaderMoreFromMenu = useCallback(() => {
    closeToolsMenu();
    scheduleAfterMobileReaderMenuClose(() => {
      setMoreSettingsSheetOpen(true);
    });
  }, [closeToolsMenu, scheduleAfterMobileReaderMenuClose]);

  const openCreditsFromMoreSheet = useCallback(() => {
    closeMoreSettingsPopup();
    setTimeout(() => {
      setReaderCreditsOpen(true);
    }, 0);
  }, [closeMoreSettingsPopup]);

  const openPrivacyPolicyFromCredits = useCallback(() => {
    setReaderCreditsOpen(false);
    setTimeout(() => setReaderPrivacyPolicyOpen(true), 0);
  }, []);

  const openTermsFromCredits = useCallback(() => {
    setReaderCreditsOpen(false);
    setTimeout(() => setReaderTermsOpen(true), 0);
  }, []);

  const openDeleteMyDataConfirmFromMenu = useCallback(
    (_onNavigate: (href: Href) => void) => {
      closeToolsMenu();
      scheduleAfterMobileReaderMenuClose(() => {
        setDeleteMyDataDialogOpen(true);
      });
    },
    [closeToolsMenu, scheduleAfterMobileReaderMenuClose],
  );

  const confirmDeleteMyData = useCallback(
    async (onNavigate: (href: Href) => void) => {
      await deleteAllUserData();
      onNavigate("/" as Href);
    },
    [],
  );

  const dismissFollowUpChrome = useCallback(() => {
    if (fontSettingsSheetOpen) closeFontSettingsPopup();
    else if (moreSettingsSheetOpen) closeMoreSettingsPopup();
    else if (deleteMyDataDialogOpen) closeDeleteMyDataDialog();
    else if (readerPrivacyPolicyOpen) setReaderPrivacyPolicyOpen(false);
    else if (readerCreditsOpen) setReaderCreditsOpen(false);
    else if (commentaryPanelOpen) setCommentaryPanelOpen(false);
    else if (readerDropdown === "translation" || readerDropdown === "theme") closeReaderDropdown();
  }, [
    closeFontSettingsPopup,
    closeMoreSettingsPopup,
    closeDeleteMyDataDialog,
    closeReaderDropdown,
    commentaryPanelOpen,
    deleteMyDataDialogOpen,
    fontSettingsSheetOpen,
    moreSettingsSheetOpen,
    readerCreditsOpen,
    readerDropdown,
    readerPrivacyPolicyOpen,
  ]);

  return {
    readerPrivacyPolicyOpen,
    setReaderPrivacyPolicyOpen,
    readerTermsOpen,
    setReaderTermsOpen,
    readerCreditsOpen,
    setReaderCreditsOpen,
    commentaryPanelOpen,
    setCommentaryPanelOpen,
    fontSettingsSheetOpen,
    moreSettingsSheetOpen,
    deleteMyDataDialogOpen,
    readerDropdown,
    dropdownAnchor,
    bookSheetExitAnimationStarted,
    setBookSheetExitAnimationStarted,
    dropSlideAnim,
    dropOpacityAnim,
    themesFanRef,
    translationFanRef,
    closeReaderDropdown,
    closeFontSettingsPopup,
    closeMoreSettingsPopup,
    closeDeleteMyDataDialog,
    openMobileReaderThemesFromMenu,
    openMobileReaderTranslationFromMenu,
    openMobileReaderCommentaryFromMenu,
    openMobileReaderMoreFromMenu,
    openCreditsFromMoreSheet,
    openPrivacyPolicyFromCredits,
    openTermsFromCredits,
    openDeleteMyDataConfirmFromMenu,
    confirmDeleteMyData,
    dismissFollowUpChrome,
  };
}

export function ReaderSettingsFollowUpLayer({
  bundle,
  insets,
  windowWidth,
  scrollPaddingTop,
  toolsMenuOpen,
  isTabletReaderLayout,
  rippleColor,
  closeToolsMenu,
  scheduleAfterMobileReaderMenuClose,
  clearMobileSettingsFollowUp,
  onNavigate,
  hideTranslationAndStudyNotes = false,
  onSelectVerseCarousel,
  panelBackgroundColor,
  followUp,
  onSettingsPanelLayout,
}: ReaderSettingsFollowUpLayerProps & {
  followUp: ReturnType<typeof useReaderSettingsFollowUpState>;
  onSettingsPanelLayout?: () => void;
}) {
  const colors = bundle.ui;
  const rc = bundle.reader;
  const {
    prefs,
    setFontFamily: setReaderVerseBodyFontIdPersisted,
    setFontScale: setFontSizeScalePersisted,
    setLineSpacingScale: setLineSpacingScalePersisted,
    setVerseTextAlign: setVerseTextAlignPersisted,
    setThemeId,
  } = useReaderPreferences();
  const { fontScale: fontSizeScale, fontFamilyId: readerVerseBodyFontId, lineSpacingScale, verseTextAlign, themeId } =
    prefs;
  const { items: translationPickerItems } = useTranslationPicker();
  const { favoriteTranslationIds, toggleFavoriteTranslation } = useFavoriteTranslations();

  const lastPos = peekReaderLastPosition();
  const settingsBookSlug = lastPos?.bookSlug ?? "genesis";
  const settingsChapterNumber = lastPos?.chapter ?? 1;
  const settingsTranslationId = lastPos?.translationId ?? "KJV";
  const { chapter, books, resolvedTranslationId } = useReaderChapter(
    settingsBookSlug,
    settingsChapterNumber,
    settingsTranslationId,
  );

  const chapterForModals = chapter ?? STUB_CHAPTER;
  const booksForModals = books ?? [];
  const resolvedTranslationForModals = resolvedTranslationId ?? settingsTranslationId;
  const settingsMutedTextColor = themeId === "spectrum" ? colors.brown600 : colors.tan200;
  const readerDropdownMaxW = Math.min(340, Math.max(200, windowWidth - 24));
  const readerDropdownTop =
    followUp.dropdownAnchor != null ? followUp.dropdownAnchor.y + followUp.dropdownAnchor.height + 8 : 0;
  const readerDropdownLeft = Math.max(12, (windowWidth - readerDropdownMaxW) / 2);
  const translationLanguageLabel = getReaderTranslationLanguageLabel(
    resolvedTranslationForModals,
    translationPickerItems,
  );

  const goToReaderChapter = useCallback(
    (nextBookSlug: string, nextChapter: number, translationId: string) => {
      onNavigate(readerChapterHref(nextBookSlug, nextChapter, translationId) as Href);
    },
    [onNavigate],
  );

  const handleSelectTranslation = useCallback(
    (translationId: string) => {
      const pos = peekReaderLastPosition();
      if (pos) {
        void saveReaderLastPosition({ ...pos, translationId });
      }
      followUp.closeReaderDropdown();
    },
    [followUp],
  );

  const settingsPanelProps = useMemo(
    () => ({
      insets,
      scrollPaddingTop,
      padH: 16,
      isTabletReaderLayout,
      screenWidth: windowWidth,
      toolsMenuOpen,
      onCloseToolsMenu: closeToolsMenu,
      headerTools: null,
      hideFontSettings: Platform.OS === "android",
      hideTranslationAndStudyNotes,
      onSelectFontSettings: undefined,
      onSelectThemes: followUp.openMobileReaderThemesFromMenu,
      onSelectMore: followUp.openMobileReaderMoreFromMenu,
      onSelectTranslation: followUp.openMobileReaderTranslationFromMenu,
      onSelectCommentary: followUp.openMobileReaderCommentaryFromMenu,
      onSelectDeleteMyData: () => followUp.openDeleteMyDataConfirmFromMenu(onNavigate),
      onSelectVerseCarousel,
      panelBackgroundColor,
      rippleColor,
      onSettingsPanelLayout,
    }),
    [
      followUp,
      hideTranslationAndStudyNotes,
      onSelectVerseCarousel,
      closeToolsMenu,
      insets,
      isTabletReaderLayout,
      onNavigate,
      onSettingsPanelLayout,
      panelBackgroundColor,
      rippleColor,
      scrollPaddingTop,
      toolsMenuOpen,
      windowWidth,
    ],
  );

  const noopMeasureAndSetDropdown = useCallback(
    (_ref: RefObject<View | null>, _kind: ReaderToolsDropdown) => {},
    [],
  );

  return (
    <>
      <ReaderMobileSettingsPanel {...settingsPanelProps} />
      <ReaderModals
        bundle={bundle}
        chapter={chapterForModals}
        commentaryPanelOpen={followUp.commentaryPanelOpen}
        closeCommentaryPanel={() => followUp.setCommentaryPanelOpen(false)}
        closeReaderDropdown={followUp.closeReaderDropdown}
        colors={colors}
        dropOpacityAnim={followUp.dropOpacityAnim}
        dropSlideAnim={followUp.dropSlideAnim}
        dropdownAnchor={followUp.dropdownAnchor}
        goToReaderChapter={goToReaderChapter}
        books={booksForModals}
        setBookSheetExitAnimationStarted={followUp.setBookSheetExitAnimationStarted}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        measureAndSetDropdown={noopMeasureAndSetDropdown}
        noteDraft=""
        noteModalVisible={false}
        noteTargetVerse={null}
        rc={rc}
        readerBookGridCellW={100}
        readerBookGridGap={8}
        readerBookSheetBottomPx={insets.bottom + 20}
        readerBookSheetPad={16}
        readerBookSheetScreenEdgePad={5}
        readerChapterCols={5}
        readerChapterGridCellW={56}
        readerDropdown={followUp.readerDropdown}
        readerDropdownLeft={readerDropdownLeft}
        readerDropdownMaxW={readerDropdownMaxW}
        readerDropdownTop={readerDropdownTop}
        resolvedTranslationId={resolvedTranslationForModals}
        translationLanguageLabel={translationLanguageLabel}
        saveNoteFromModal={() => {}}
        selectedVerses={[]}
        setNoteDraft={() => {}}
        setNoteModalVisible={() => {}}
        setNoteTargetVerse={() => {}}
        setThemeId={setThemeId}
        settingsMutedTextColor={settingsMutedTextColor}
        themesFanRef={followUp.themesFanRef}
        themeId={themeId}
        translationFanRef={followUp.translationFanRef}
      />
      <TranslationPickerSheet
        isOpen={followUp.readerDropdown === "translation"}
        onClose={followUp.closeReaderDropdown}
        onSelectTranslation={handleSelectTranslation}
        sheetTopPx={readerDropdownTop}
        bundle={bundle}
        insets={insets}
        translationPickerItems={translationPickerItems}
        favoriteTranslationIds={favoriteTranslationIds}
        toggleFavoriteTranslation={toggleFavoriteTranslation}
        resolvedTranslationId={resolvedTranslationForModals}
        readerBookSlug={settingsBookSlug}
        readerChapterNumber={settingsChapterNumber}
        readerBooks={booksForModals}
      />
      <ReaderFontSettingsSheet
        isOpen={followUp.fontSettingsSheetOpen}
        onClose={followUp.closeFontSettingsPopup}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        fontSizeScale={fontSizeScale}
        setFontSizeScalePersisted={setFontSizeScalePersisted}
        lineSpacingScale={lineSpacingScale}
        setLineSpacingScalePersisted={setLineSpacingScalePersisted}
        verseTextAlign={verseTextAlign}
        setVerseTextAlignPersisted={setVerseTextAlignPersisted}
        readerVerseBodyFontId={readerVerseBodyFontId}
        setReaderVerseBodyFontIdPersisted={setReaderVerseBodyFontIdPersisted}
        settingsMutedTextColor={settingsMutedTextColor}
      />
      <ReaderMoreSettingsSheet
        isOpen={followUp.moreSettingsSheetOpen}
        onClose={followUp.closeMoreSettingsPopup}
        onSelectCredits={followUp.openCreditsFromMoreSheet}
        bundle={bundle}
        insets={insets}
        isTabletReaderLayout={isTabletReaderLayout}
        settingsMutedTextColor={settingsMutedTextColor}
      />
      <CreditsSheet
        visible={followUp.readerCreditsOpen}
        onClose={() => followUp.setReaderCreditsOpen(false)}
        onOpenPrivacyPolicy={followUp.openPrivacyPolicyFromCredits}
        onOpenTermsOfService={followUp.openTermsFromCredits}
      />
      <PrivacyPolicySheet
        visible={followUp.readerPrivacyPolicyOpen}
        onClose={() => followUp.setReaderPrivacyPolicyOpen(false)}
      />
      <TermsOfServiceSheet visible={followUp.readerTermsOpen} onClose={() => followUp.setReaderTermsOpen(false)} />
      <ReaderDeleteMyDataDialog
        isOpen={followUp.deleteMyDataDialogOpen}
        onClose={followUp.closeDeleteMyDataDialog}
        onConfirmDelete={() => followUp.confirmDeleteMyData(onNavigate)}
        bundle={bundle}
        isTabletReaderLayout={isTabletReaderLayout}
      />
    </>
  );
}
