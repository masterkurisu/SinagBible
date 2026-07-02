import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  InteractionManager,
  ScrollView,
  useWindowDimensions,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useRouter } from "expo-router";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  parsePassageReference,
  formatPassageReference,
  getPassageMisspellingSuggestion,
} from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { saveLocalEntry, updateLocalEntry } from "@/lib/journal-local";
import {
  getJournalChapter,
  getJournalClosestBookSuggestion,
  getJournalVersePreview,
  normalizeJournalTranslationId,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RichEditor } from "react-native-pell-rich-editor";
import {
  ReflectionBoldIcon,
  ReflectionBulletedListIcon,
  ReflectionFullscreenIcon,
  ReflectionImageIcon,
  ReflectionKeyboardHideIcon,
  ReflectionItalicIcon,
  ReflectionNumberedListIcon,
} from "@/components/journal-reflection-toolbar-icons";
import { isTabletLayout, TABLET_NEW_ENTRY_MAX_WIDTH_PX } from "@/lib/tablet-layout";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import { m3SettingsSheetTitleStyle } from "@/src/components/m3/M3SettingsSheetTitle";
import {
  JOURNAL_M3_ELEVATED_CARD_ELEVATION_PX,
  JOURNAL_M3_ELEVATED_CARD_RADIUS_PX,
} from "@/src/features/journal/journalCardChrome";
import {
  READER_M3_FLOATING_TOOLBAR_CONTAINER,
  readerM3FloatingToolbarPillStyle,
} from "@/src/features/reader/readerActionBarChrome";
import { READER_M3_ON_SURFACE_VARIANT } from "@/src/features/reader/readerSettingsPanelChrome";

const VERSE_PREVIEW_LIMIT = 150;
const TOOLBAR_BTN_SIZE = 40;
const REFLECTION_OVERLAY_BTN_SIZE = 36;
const FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX = 10;

const FORM_HORIZONTAL_PADDING = 10;
/** Pulls the reflection editor’s bottom edge up (journal card, reader sheet, fullscreen). */
const REFLECTION_FIELD_BOTTOM_TRIM_PX = 50;
/** Phone bottom sheets (journal + reader): save row clearance from the screen edge. */
const SHEET_SAVE_BOTTOM_PADDING_PX = 30;
/** Sheet reflection editor minimum height after top fields are measured. */
const SHEET_REFLECTION_MIN_PX = 160;
/** Save row: top pad + button + bottom pad (pinned ~30px from sheet foot). */
const SHEET_SAVE_BLOCK_PX = 14 + 48 + SHEET_SAVE_BOTTOM_PADDING_PX;
/** Rough top-block height before first layout measure (passage + title, no preview). */
const SHEET_TOP_FIELDS_ESTIMATE_PX = 132;
/** Reflection label row + gap above the editor. */
const SHEET_REFLECTION_CHROME_PX = 30;
/**
 * Reader new-entry modal only: matches reader sheet `bottom` lift — save row `paddingBottom` trim.
 */
const READER_NEW_ENTRY_CARD_BOTTOM_LIFT_PX = 50;
/** Title/passage inputs and RichEditor WebView (15px; `!important` CSS beats inline sizes from saved HTML). */
const TITLE_FIELD_FONT_SIZE = 15;

/** Injected into the library’s `.pell-content { … }` rule (see react-native-pell-rich-editor/editor.js). */
const reflectionEditorContentCSSText = `font-family:Lora,serif!important;font-size:${TITLE_FIELD_FONT_SIZE}px!important;line-height:1.55!important;`;

function buildReflectionEditorCssText(parchmentDarkHex: string): string {
  return `
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { margin: 0; padding: 0; background-color: ${parchmentDarkHex} !important; -webkit-text-size-adjust: 100%; }
.content { height: 100% !important; min-height: 0 !important; box-sizing: border-box !important; }
#content, .pell-content {
  font-family: Lora, serif !important;
  font-size: ${TITLE_FIELD_FONT_SIZE}px !important;
  line-height: 1.55 !important;
  color: inherit;
}
.pell-content {
  height: 100% !important;
  max-height: 100% !important;
  box-sizing: border-box !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  touch-action: pan-y !important;
  overscroll-behavior-y: contain !important;
  min-height: 0 !important;
}
#content *, .pell-content * {
  font-family: Lora, serif !important;
  font-size: ${TITLE_FIELD_FONT_SIZE}px !important;
}
#content img, .pell-content img { font-size: initial !important; max-width: 98% !important; height: auto !important; vertical-align: middle; }
#content p, .pell-content p { margin: 0 0 10px 0; }
html, body, #content, .pell-content { -webkit-user-select: text !important; user-select: text !important; -webkit-touch-callout: default !important; }
`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * useContainer={false}: HTML template uses a fixed-height chain; scrolling is .pell-content overflow-y.
 * iOS: scrollEnabled={false} avoids WKWebView owning vertical pans (often blocks scrolling when the
 * keyboard is dismissed). Android: scrollEnabled must be true or touch scroll inside the WebView fails
 * when the keyboard is open. nestedScrollEnabled follows the library (!useContainer → true) on Android.
 */
const REFLECTION_RICH_EDITOR_PROPS = {
  useContainer: false,
  scrollEnabled: Platform.OS === "android",
  bounces: false,
} as const;

/** Scroll the contenteditable caret into view inside .pell-content (Android inner scroll). */
const REFLECTION_SCROLL_CARET_INTO_VIEW_DOM = `
(function () {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var editor = document.querySelector('.pell-content');
  if (!editor) return;
  var rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.height) return;
  var er = editor.getBoundingClientRect();
  var pad = 28;
  if (rect.bottom > er.bottom - pad) {
    editor.scrollTop += rect.bottom - er.bottom + pad;
  } else if (rect.top < er.top + pad) {
    editor.scrollTop -= er.top - rect.top + pad;
  }
})();
true;
`;

/** Light text on save / primary gradient buttons */
const SAVE_BUTTON_LABEL_COLOR = "#f5e9d6";

/** iOS: avoid dismissing the keyboard when scrolling the form or reflection editor. */
const FORM_SCROLL_KEYBOARD_DISMISS_MODE = Platform.OS === "ios" ? "none" : "on-drag";

type JournalFormActiveField = "passage" | "title" | "reflection" | null;

export type JournalNewEntryInitialParams = {
  book?: string;
  chapter?: string;
  verseStart?: string;
  verseEnd?: string;
  translation?: string;
};

/** Values for editing an existing entry (AsyncStorage). */
export type JournalEditDraft = {
  id: string;
  title?: string | null;
  content: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation?: string | null;
};

type Props = {
  initialParams?: JournalNewEntryInitialParams;
  /** When set, the form updates this entry instead of creating a new one. */
  editDraft?: JournalEditDraft | null;
  /** When set, called instead of default stack navigation after a successful save. */
  onAfterSave?: () => void;
  /** Cap scroll area height (e.g. bottom sheet on journal tab). */
  contentScrollMaxHeight?: number;
  /**
   * Bottom sheet only: minimum content height (top fields + reflection min + save) so the parent
   * can grow or shrink the sheet card to fit.
   */
  onSheetPreferredHeightChange?: (contentHeightPx: number) => void;
  /**
   * Bottom sheet only: parent lifts the card above the keyboard; disables redundant inner avoidance.
   */
  sheetKeyboardLiftPx?: number;
  /** Notify parent whether the form currently has unsaved typed content. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Hide the large “New/Edit Entry” heading (e.g. when the stack header already shows the title). */
  hideFormScreenTitle?: boolean;
  /**
   * Horizontal padding inside the scroll + save row. Defaults to {@link FORM_HORIZONTAL_PADDING}.
   * Set to `0` when the parent card already applies the full screen gutter (e.g. reader sheet).
   */
  contentHorizontalPadding?: number;
  /**
   * Reader new-entry sheet only: one ScrollView for the whole form so fields stay reachable when the
   * keyboard is open. Journal keeps the split layout (passage/title scroll + fixed reflection viewport).
   */
  readerNewEntryScrollable?: boolean;
  /**
   * Reader sheet only: must match the modal’s extra `bottom` inset above the tab bar (`readerNewEntrySheetBottomLiftPx`).
   * Lower on tablets so save-row padding is not over-subtracted.
   */
  readerCardBottomLiftPx?: number;
  /** Android: show save confirmation via parent toast instead of a native alert dialog. */
  onSaveToast?: (message: string) => void;
};

export type JournalNewEntryFormHandle = {
  save: () => void;
};

export const JournalNewEntryForm = forwardRef<JournalNewEntryFormHandle, Props>(function JournalNewEntryForm(
  {
    initialParams,
    editDraft,
    onAfterSave,
    contentScrollMaxHeight,
    onSheetPreferredHeightChange,
    sheetKeyboardLiftPx,
    onDirtyChange,
    hideFormScreenTitle = false,
    contentHorizontalPadding,
    readerNewEntryScrollable,
    readerCardBottomLiftPx = READER_NEW_ENTRY_CARD_BOTTOM_LIFT_PX,
    onSaveToast,
  }: Props,
  ref,
) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTabletForm = isTabletLayout(windowWidth, windowHeight);
  const isLandscapeForm = windowWidth > windowHeight;
  /** Journal/reader new-entry bottom sheet on a phone (not tablet / fullscreen route). */
  const isPhoneSheetForm = contentScrollMaxHeight != null && !isTabletForm;
  const { bundle } = useMobileAppTheme();
  const colors = bundle.ui;
  const j = bundle.journal;
  const themeId = bundle.id;
  const modalSurfaceColor = j.newEntrySheetBackground;

  const reflectionEditorCssText = useMemo(
    () => buildReflectionEditorCssText(colors.parchmentDark),
    [colors.parchmentDark],
  );
  const reflectionRichEditorEditorStyle = useMemo(
    () => ({
      backgroundColor: colors.parchmentDark,
      color: colors.brown800,
      caretColor: colors.brown800,
      contentCSSText: reflectionEditorContentCSSText,
      cssText: reflectionEditorCssText,
    }),
    [colors.parchmentDark, colors.brown800, reflectionEditorCssText],
  );

  const baseContentPad =
    contentHorizontalPadding !== undefined ? contentHorizontalPadding : FORM_HORIZONTAL_PADDING;
  const padLeft = Math.max(baseContentPad, insets.left);
  const padRight = Math.max(baseContentPad, insets.right);
  /**
   * Keep passage/title in a bounded scroll region so the reflection editor keeps height.
   * Tablet landscape: use a smaller share so the reflection WebView does not collapse to a sliver.
   */
  const newEntryTopFieldsMaxScrollHeight =
    contentScrollMaxHeight != null
      ? Math.min(
          Math.round(
            contentScrollMaxHeight *
              (isPhoneSheetForm
                ? isLandscapeForm
                  ? 0.28
                  : 0.3
                : isTabletForm && isLandscapeForm
                  ? 0.36
                  : 0.5),
          ),
          isPhoneSheetForm ? 220 : isTabletForm && isLandscapeForm ? 260 : 320,
        )
      : Math.min(
          400,
          Math.round(windowHeight * (isTabletForm && isLandscapeForm ? 0.34 : 0.46)),
        );

  const journalTranslationId = normalizeJournalTranslationId(
    editDraft?.bible_translation ?? initialParams?.translation,
  );

  const defaultPassageNew =
    initialParams?.book && initialParams?.chapter
      ? formatPassageReference({
          book: initialParams.book,
          chapter: parseInt(initialParams.chapter, 10),
          verseStart: initialParams.verseStart ? parseInt(initialParams.verseStart, 10) : null,
          verseEnd: initialParams.verseEnd ? parseInt(initialParams.verseEnd, 10) : null,
        })
      : "";

  const editPassageFormatted = editDraft
    ? formatPassageReference({
        book: editDraft.book,
        chapter: editDraft.chapter,
        verseStart: editDraft.verse_start,
        verseEnd: editDraft.verse_end,
      })
    : "";

  const [passage, setPassage] = useState(() => (editDraft ? editPassageFormatted : defaultPassageNew));
  const [title, setTitle] = useState(() => editDraft?.title?.trim() ?? "");
  const [reflectionHtml, setReflectionHtml] = useState(() => editDraft?.content ?? "");
  const reflectionHtmlRef = useRef(reflectionHtml);
  reflectionHtmlRef.current = reflectionHtml;
  const richEditorRef = useRef<RichEditor>(null);
  const fullscreenRichEditorRef = useRef<RichEditor>(null);
  const [reflectionFullscreenOpen, setReflectionFullscreenOpen] = useState(false);
  const [reflectionFsMountKey, setReflectionFsMountKey] = useState(0);
  /** After closing fullscreen, remount inline WebView so hit-testing works (stacked RN Modal + WebView bug). */
  const [reflectionInlineRemountKey, setReflectionInlineRemountKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [passagePreview, setPassagePreview] = useState<string | null>(null);
  const [passagePreviewRef, setPassagePreviewRef] = useState<string | null>(null);
  const [passageSuggestion, setPassageSuggestion] = useState<string | null>(null);
  const [topFieldsMeasuredH, setTopFieldsMeasuredH] = useState(0);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const saveToastOpacity = useRef(new Animated.Value(0)).current;
  const saveToastAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const pendingSaveAfterToastRef = useRef<(() => void) | null>(null);
  const [journalKeyboardOpen, setJournalKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeFormField, setActiveFormField] = useState<JournalFormActiveField>(null);
  const activeFormFieldRef = useRef<JournalFormActiveField>(null);

  const markActiveFormField = (field: JournalFormActiveField) => {
    activeFormFieldRef.current = field;
    setActiveFormField(field);
  };

  const releaseActiveFormField = (field: Exclude<JournalFormActiveField, null>) => {
    setTimeout(() => {
      if (activeFormFieldRef.current === field) markActiveFormField(null);
    }, 0);
  };

  const floatingToolbarPillStyle = useMemo(
    () =>
      readerM3FloatingToolbarPillStyle(
        READER_M3_FLOATING_TOOLBAR_CONTAINER,
        colors.parchmentMid,
      ),
    [colors.parchmentMid],
  );
  const toolbarIconColor = colors.brown800;

  const versePreviewCardStyle = useMemo(
    () => ({
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: j.versePreviewBackground,
      borderRadius: JOURNAL_M3_ELEVATED_CARD_RADIUS_PX,
      elevation: JOURNAL_M3_ELEVATED_CARD_ELEVATION_PX,
      shadowColor: colors.brown800,
      shadowOffset: { width: 0, height: 1 } as const,
      shadowOpacity: 0.14,
      shadowRadius: 3,
    }),
    [colors.brown800, j.versePreviewBackground],
  );

  const getActiveReflectionEditor = () =>
    reflectionFullscreenOpen ? fullscreenRichEditorRef.current : richEditorRef.current;

  const undoReflection = () => {
    hapticLightImpact();
    getActiveReflectionEditor()?.commandDOM("document.execCommand('undo', false, null);");
  };

  const applyReflectionFormat = (command: string) => {
    hapticLightImpact();
    const ed = getActiveReflectionEditor();
    ed?.focusContentEditor();
    ed?.commandDOM(`document.execCommand('${command}', false, null);`);
  };

  const normalizeReflectionHtml = (html: string): string => {
    const cleaned = html.replace(/\u200B/g, "").trim();
    if (!cleaned || cleaned === "<br>" || cleaned === "<div><br></div>" || cleaned === "<p><br></p>") return "";
    return cleaned;
  };

  const reflectionTypingHapticLastRef = useRef(0);
  const reflectionCaretScrollLastRef = useRef(0);
  const scrollReflectionCaretIntoView = () => {
    if (Platform.OS !== "android") return;
    getActiveReflectionEditor()?.commandDOM(REFLECTION_SCROLL_CARET_INTO_VIEW_DOM);
  };
  const onReflectionHtmlChangedFromEditor = (html: string) => {
    markActiveFormField("reflection");
    const t = Date.now();
    if (t - reflectionTypingHapticLastRef.current >= 48) {
      reflectionTypingHapticLastRef.current = t;
      hapticSelection();
    }
    setReflectionHtml(normalizeReflectionHtml(html));
    if (Platform.OS === "android" && t - reflectionCaretScrollLastRef.current >= 80) {
      reflectionCaretScrollLastRef.current = t;
      scrollReflectionCaretIntoView();
    }
  };

  const reflectionPlainText = (html: string): string =>
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const hasReflectionInput = reflectionPlainText(reflectionHtml).length > 0;
  const hasDraftInput = passage.trim().length > 0 || title.trim().length > 0 || hasReflectionInput;

  useEffect(() => {
    onDirtyChange?.(hasDraftInput);
  }, [hasDraftInput, onDirtyChange]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      setJournalKeyboardOpen(true);
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => {
      setJournalKeyboardOpen(false);
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!saveToastMessage) {
      saveToastOpacity.setValue(0);
      return;
    }
    saveToastOpacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(saveToastOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(1200),
      Animated.timing(saveToastOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    saveToastAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (!finished) return;
      const done = pendingSaveAfterToastRef.current;
      pendingSaveAfterToastRef.current = null;
      setSaveToastMessage(null);
      done?.();
    });
    return () => {
      anim.stop();
    };
  }, [saveToastMessage, saveToastOpacity]);

  const confirmSaveSuccess = (message: string, onConfirmed: () => void) => {
    if (Platform.OS === "android") {
      if (onSaveToast) {
        onSaveToast(message);
        onConfirmed();
        return;
      }
      pendingSaveAfterToastRef.current = onConfirmed;
      setSaveToastMessage(message);
      return;
    }
    Alert.alert(message, "", [{ text: "OK", onPress: onConfirmed }]);
  };

  const dismissJournalKeyboardCore = () => {
    richEditorRef.current?.dismissKeyboard();
    fullscreenRichEditorRef.current?.dismissKeyboard();
    Keyboard.dismiss();
  };

  const dismissJournalKeyboard = () => {
    hapticLightImpact();
    dismissJournalKeyboardCore();
  };

  const onReflectionEditorFocus = () => {
    markActiveFormField("reflection");
    setJournalKeyboardOpen(true);
  };

  const onReflectionEditorBlur = () => {
    releaseActiveFormField("reflection");
    const ed = getActiveReflectionEditor();
    if (ed?.isKeyboardOpen) return;
    setJournalKeyboardOpen(false);
  };

  const showReflectionFloatingToolbar =
    journalKeyboardOpen && activeFormField === "reflection";

  /** Android bottom sheets: anchor above the keyboard using screen-space inset. */
  const reflectionToolbarBottomPx =
    Platform.OS === "android" && keyboardHeight > 0 && isPhoneSheetForm
      ? sheetKeyboardLiftPx !== undefined
        ? FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX
        : keyboardHeight + FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX
      : FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX;

  const openReflectionFullscreen = () => {
    hapticLightImpact();
    richEditorRef.current?.blurContentEditor();
    Keyboard.dismiss();
    setReflectionFsMountKey((k) => k + 1);
    setReflectionFullscreenOpen(true);
  };

  const closeReflectionFullscreen = async () => {
    hapticLightImpact();
    try {
      const ed = fullscreenRichEditorRef.current;
      if (ed) {
        const html = await ed.getContentHtml();
        if (typeof html === "string") {
          const normalized = normalizeReflectionHtml(html);
          setReflectionHtml(normalized);
          richEditorRef.current?.setContentHTML(normalized.length ? normalized : "<br>");
        }
      }
    } catch {
      const normalized = normalizeReflectionHtml(reflectionHtmlRef.current);
      setReflectionHtml(normalized);
    } finally {
      Keyboard.dismiss();
      fullscreenRichEditorRef.current?.dismissKeyboard();
      markActiveFormField(null);
      setReflectionFullscreenOpen(false);
      InteractionManager.runAfterInteractions(() => {
        setReflectionInlineRemountKey((k) => k + 1);
      });
    }
  };

  const getBookInputCandidate = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const tokens = trimmed.split(/\s+/);
    if (tokens.length <= 1) return trimmed;
    const chapterVerseLike = /^(\d+)(?::(\d+)(?:-(\d+))?)?$/;
    const last = tokens[tokens.length - 1] ?? "";
    if (chapterVerseLike.test(last)) {
      return tokens.slice(0, -1).join(" ");
    }
    return trimmed;
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const raw = passage.trim();
        if (!raw) {
          if (!cancelled) {
            setPassagePreview(null);
            setPassagePreviewRef(null);
            setPassageSuggestion(null);
          }
          return;
        }

        const parsed = parsePassageReference(raw);
        const bookInput = getBookInputCandidate(raw);
        const misspelling = getPassageMisspellingSuggestion(
          (bookInput.split(/\s+/)[0] ?? "").trim(),
        );

        if (!parsed) {
          if (!cancelled) {
            setPassagePreview(null);
            setPassagePreviewRef(null);
            setPassageSuggestion(misspelling ? `Did you mean ${misspelling}?` : null);
          }
          return;
        }

        const canonicalBook = await resolveJournalPassageBookSlug(journalTranslationId, parsed.book);
        if (!canonicalBook) {
          const closest = await getJournalClosestBookSuggestion(journalTranslationId, bookInput);
          if (!cancelled) {
            setPassagePreview(null);
            setPassagePreviewRef(null);
            setPassageSuggestion(
              closest ? `Did you mean ${closest.bookName} ${parsed.chapter}?` : "Book name not recognized.",
            );
          }
          return;
        }

        const chapterData = await getJournalChapter(journalTranslationId, canonicalBook, parsed.chapter);

        if (!chapterData) {
          if (!cancelled) {
            setPassagePreview(null);
            setPassagePreviewRef(null);
            setPassageSuggestion(`Chapter ${parsed.chapter} does not exist for this book.`);
          }
          return;
        }

        if (parsed.verseStart != null) {
          const maxVerse = chapterData.verses.length;
          if (parsed.verseStart > maxVerse || (parsed.verseEnd != null && parsed.verseEnd > maxVerse)) {
            if (!cancelled) {
              setPassagePreview(null);
              setPassagePreviewRef(null);
              setPassageSuggestion(`Verse out of range. This chapter has ${maxVerse} verses.`);
            }
            return;
          }
        }

        const preview = await getJournalVersePreview(
          journalTranslationId,
          canonicalBook,
          parsed.chapter,
          parsed.verseStart,
          parsed.verseEnd,
        );
        if (!cancelled) {
          const limitedPreview =
            preview && preview.length > VERSE_PREVIEW_LIMIT
              ? `${preview.slice(0, VERSE_PREVIEW_LIMIT).trimEnd()}...`
              : preview;
          setPassagePreview(limitedPreview);
          setPassagePreviewRef(
            `${chapterData.bookName} ${parsed.chapter}${
              parsed.verseStart != null
                ? `:${parsed.verseStart}${parsed.verseEnd ? `-${parsed.verseEnd}` : ""}`
                : ""
            }`,
          );
          setPassageSuggestion(
            misspelling ? `Did you mean ${misspelling}?` : null,
          );
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [journalTranslationId, passage]);

  const attachReflectionImage = async () => {
    hapticLightImpact();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to attach images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        Alert.alert("Could not read image", "Try another photo.");
        return;
      }
      const dataUrl = `data:image/jpeg;base64,${manipulated.base64}`;
      const ed = getActiveReflectionEditor();
      ed?.focusContentEditor();
      ed?.insertImage(dataUrl, "reflection image");
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Could not attach image", "Try again.");
    }
  };

  const finishSave = (newEntryId?: string) => {
    if (onAfterSave) {
      onAfterSave();
      return;
    }
    if (editDraft) {
      router.replace(`/journal/${editDraft.id}` as never);
      return;
    }
    if (newEntryId) {
      router.replace(`/journal/${newEntryId}` as never);
      return;
    }
    router.back();
  };

  /**
   * RichEditor debounces CONTENT_CHANGE by ~50ms; saving immediately after typing can read stale
   * React state. Always read live HTML from the WebView before validate/persist.
   */
  const flushReflectionHtmlFromEditor = async (): Promise<string> => {
    const ed = getActiveReflectionEditor();
    if (!ed) return normalizeReflectionHtml(reflectionHtmlRef.current);
    try {
      const live = await ed.getContentHtml();
      if (typeof live === "string") {
        const normalized = normalizeReflectionHtml(live);
        setReflectionHtml(normalized);
        return normalized;
      }
    } catch {
      /* bridge timeout / teardown */
    }
    return normalizeReflectionHtml(reflectionHtmlRef.current);
  };

  const isEditMode = editDraft != null;
  /** Bottom sheet / capped-height card (journal FAB sheet, reader sheet, new route). */
  const sheetFormLayout = contentScrollMaxHeight != null;
  /** Reader new entry (not edit). */
  const readerNewEntryFromReader = readerNewEntryScrollable === true && !isEditMode;
  /**
   * Phone-only: one ScrollView for passage + reflection + save (keyboard). Tablets and full-height
   * bottom sheets use split layout so reflection flexes into the extra vertical space.
   */
  const readerMergedScrollMode = readerNewEntryFromReader && !isTabletForm && !isPhoneSheetForm;
  /**
   * Android phones: merged scroll keeps the reflection field reachable when the keyboard is open.
   * Full-height bottom sheets use split layout so reflection can flex into the extra vertical space.
   */
  const androidPhoneMergedScrollMode =
    Platform.OS === "android" && !isTabletForm && !isPhoneSheetForm;
  const mergedFormScrollMode = readerMergedScrollMode || androidPhoneMergedScrollMode;

  const sheetTitleChromePx = hideFormScreenTitle ? 0 : 34;
  const sheetChromeOverheadPx = sheetTitleChromePx + SHEET_REFLECTION_CHROME_PX + 10;

  const onTopFieldsLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    setTopFieldsMeasuredH((prev) => (prev === next ? prev : next));
  }, []);

  const sheetTopFieldsHeightPx =
    topFieldsMeasuredH > 0 ? topFieldsMeasuredH : SHEET_TOP_FIELDS_ESTIMATE_PX;

  const sheetFieldsAreaHeightPx = useMemo(() => {
    if (!sheetFormLayout || contentScrollMaxHeight == null) return 0;
    return contentScrollMaxHeight - SHEET_SAVE_BLOCK_PX;
  }, [sheetFormLayout, contentScrollMaxHeight]);

  const sheetFieldsMinHeightPx = useMemo(
    () => sheetTopFieldsHeightPx + SHEET_REFLECTION_MIN_PX + sheetChromeOverheadPx,
    [sheetTopFieldsHeightPx, sheetChromeOverheadPx],
  );

  useEffect(() => {
    if (!sheetFormLayout || !onSheetPreferredHeightChange) return;
    onSheetPreferredHeightChange(sheetFieldsMinHeightPx + SHEET_SAVE_BLOCK_PX);
  }, [sheetFormLayout, onSheetPreferredHeightChange, sheetFieldsMinHeightPx]);

  const sheetNeedsScroll = useMemo(() => {
    if (!sheetFormLayout || contentScrollMaxHeight == null) return false;
    return sheetFieldsMinHeightPx + SHEET_SAVE_BLOCK_PX > contentScrollMaxHeight + 2;
  }, [sheetFormLayout, contentScrollMaxHeight, sheetFieldsMinHeightPx]);

  const sheetReflectionEditorHeightPx = useMemo(() => {
    if (!sheetFormLayout || contentScrollMaxHeight == null) return SHEET_REFLECTION_MIN_PX;
    const available = sheetFieldsAreaHeightPx - sheetTopFieldsHeightPx - sheetChromeOverheadPx;
    return Math.max(SHEET_REFLECTION_MIN_PX, available);
  }, [
    sheetFormLayout,
    contentScrollMaxHeight,
    sheetFieldsAreaHeightPx,
    sheetChromeOverheadPx,
    sheetTopFieldsHeightPx,
  ]);

  const reflectionBottomTrimPx = isPhoneSheetForm ? 0 : REFLECTION_FIELD_BOTTOM_TRIM_PX;
  const trim = reflectionBottomTrimPx;
  const splitReflectionMinHeight =
    isTabletForm && isLandscapeForm && !mergedFormScrollMode ? 200 : 0;

  const reflectionShellStyle = sheetFormLayout
    ? sheetNeedsScroll
      ? {
          backgroundColor: modalSurfaceColor,
          height: sheetReflectionEditorHeightPx + SHEET_REFLECTION_CHROME_PX,
          flexShrink: 0,
        }
      : {
          backgroundColor: modalSurfaceColor,
          flex: 1,
          minHeight: sheetReflectionEditorHeightPx + SHEET_REFLECTION_CHROME_PX,
        }
    : mergedFormScrollMode
      ? { backgroundColor: modalSurfaceColor }
      : {
          backgroundColor: modalSurfaceColor,
          flex: 1,
          minHeight: splitReflectionMinHeight,
          marginBottom: trim,
        };
  const reflectionParchmentStyle = sheetFormLayout
    ? sheetNeedsScroll
      ? {
          marginTop: 5,
          height: Math.max(SHEET_REFLECTION_MIN_PX, sheetReflectionEditorHeightPx - 36),
        }
      : {
          marginTop: 5,
          flex: 1,
          minHeight: Math.max(SHEET_REFLECTION_MIN_PX, sheetReflectionEditorHeightPx - 36),
        }
    : mergedFormScrollMode
      ? {
          marginTop: 5,
          minHeight: isPhoneSheetForm
            ? Math.max(280, Math.round((contentScrollMaxHeight ?? windowHeight) * 0.42))
            : 240 - trim,
        }
      : { marginTop: 5, flex: 1, minHeight: isPhoneSheetForm ? 200 : 0 };
  const reflectionInnerPadStyle = sheetFormLayout
    ? sheetNeedsScroll
      ? {
          height: Math.max(SHEET_REFLECTION_MIN_PX - 36, sheetReflectionEditorHeightPx - 72),
          paddingHorizontal: 8,
          paddingBottom: 19,
          paddingTop: 36,
        }
      : {
          flex: 1,
          minHeight: Math.max(SHEET_REFLECTION_MIN_PX - 36, sheetReflectionEditorHeightPx - 72),
          paddingHorizontal: 8,
          paddingBottom: 19,
          paddingTop: 36,
        }
    : mergedFormScrollMode
      ? {
          minHeight: isPhoneSheetForm
            ? Math.max(260, Math.round((contentScrollMaxHeight ?? windowHeight) * 0.4))
            : 220 - trim,
          paddingHorizontal: 8,
          paddingBottom: 19,
        }
      : { flex: 1, minHeight: 0, paddingHorizontal: 8, paddingBottom: 19 };
  const reflectionRichEditorLayoutStyle = sheetFormLayout
    ? {
        height: Math.max(SHEET_REFLECTION_MIN_PX - 52, sheetReflectionEditorHeightPx - 88),
        alignSelf: "stretch" as const,
        width: "100%" as const,
        borderRadius: 0,
        backgroundColor: colors.parchmentDark,
      }
    : mergedFormScrollMode
      ? {
          minHeight: isPhoneSheetForm
            ? Math.max(240, Math.round((contentScrollMaxHeight ?? windowHeight) * 0.38))
            : 200 - trim,
          alignSelf: "stretch" as const,
          width: "100%" as const,
          borderRadius: 0,
          backgroundColor: colors.parchmentDark,
        }
      : {
          flex: 1,
          minHeight: isPhoneSheetForm ? 180 : 0,
          alignSelf: "stretch" as const,
          width: "100%" as const,
          borderRadius: 0,
          backgroundColor: colors.parchmentDark,
        };

  const handleSave = async () => {
    hapticLightImpact();
    dismissJournalKeyboard();
    const htmlForSave = await flushReflectionHtmlFromEditor();
    if (!reflectionPlainText(htmlForSave)) {
      Alert.alert("Reflection required", "Please write a reflection before saving.");
      return;
    }

    setSaving(true);
    try {
      const parsed = passage.trim() ? parsePassageReference(passage.trim()) : null;
      const hasPassage = parsed !== null;
      const book = parsed?.book ?? "";
      const chapter = parsed?.chapter ?? 0;
      const verse_start = parsed?.verseStart ?? null;
      const verse_end = parsed?.verseEnd ?? null;
      const content = normalizeReflectionHtml(htmlForSave);
      const titleTrim = title.trim() || null;

      if (editDraft) {
        await updateLocalEntry(editDraft.id, {
          book,
          chapter,
          verse_start,
          verse_end,
          bible_translation: hasPassage ? journalTranslationId : null,
          content,
          title: titleTrim,
        });
        confirmSaveSuccess("Changes saved", () => finishSave());
        return;
      }

      const saved = await saveLocalEntry({
        book,
        chapter,
        verse_start,
        verse_end,
        bible_translation: hasPassage ? journalTranslationId : null,
        content,
        title: titleTrim,
        is_favorite: false,
      });

      confirmSaveSuccess("Reflection saved", () => finishSave(saved.id));
    } catch (e) {
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Could not save", "Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useImperativeHandle(ref, () => ({
    save: () => {
      void handleSaveRef.current();
    },
  }));

  const reflectionOverlayButtonStyle = {
    width: REFLECTION_OVERLAY_BTN_SIZE,
    height: REFLECTION_OVERLAY_BTN_SIZE,
    borderRadius: REFLECTION_OVERLAY_BTN_SIZE / 2,
    backgroundColor: colors.parchmentMid,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const floatingToolbarIconButtonStyle = {
    width: TOOLBAR_BTN_SIZE,
    height: TOOLBAR_BTN_SIZE,
    borderRadius: TOOLBAR_BTN_SIZE / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const renderReflectionFloatingToolbar = () => (
    <View style={floatingToolbarPillStyle}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Undo"
        onPress={undoReflection}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <Ionicons name="arrow-undo" size={20} color={toolbarIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Bold"
        onPress={() => applyReflectionFormat("bold")}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <ReflectionBoldIcon size={18} color={toolbarIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Italic"
        onPress={() => applyReflectionFormat("italic")}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <ReflectionItalicIcon size={18} color={toolbarIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Bulleted list"
        onPress={() => applyReflectionFormat("insertUnorderedList")}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <ReflectionBulletedListIcon size={18} color={toolbarIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Numbered list"
        onPress={() => applyReflectionFormat("insertOrderedList")}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <ReflectionNumberedListIcon size={18} color={toolbarIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Attach image"
        onPress={() => void attachReflectionImage()}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <ReflectionImageIcon size={18} color={toolbarIconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Hide keyboard"
        onPress={dismissJournalKeyboard}
        activeOpacity={0.85}
        style={floatingToolbarIconButtonStyle}
      >
        <ReflectionKeyboardHideIcon size={20} color={toolbarIconColor} />
      </TouchableOpacity>
    </View>
  );

  const formLeadingSections = (
    <>
      {!hideFormScreenTitle ? (
        <View style={{ width: "100%", alignItems: "center", marginBottom: 4 }}>
          <Text
            style={[
              m3SettingsSheetTitleStyle(1, colors.brown800),
              { textAlign: "center", width: "100%" },
            ]}
          >
            {editDraft ? "Edit Entry" : "New Entry"}
          </Text>
        </View>
      ) : null}

      <View
        collapsable={false}
        style={{ paddingTop: 0, backgroundColor: modalSurfaceColor }}
      >
        <M3OutlinedTextField
          label="Passage (optional)"
          placeholder="e.g. John 3:16 or Romans 8"
          value={passage}
          onChangeText={(t) => {
            hapticSelection();
            setPassage(t);
          }}
          surfaceColor={modalSurfaceColor}
          accentColor={colors.brown800}
          roundedEnds
          minHeight={52}
          inputFontFamily="Lora_400Regular"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissJournalKeyboard}
          onFocus={() => markActiveFormField("passage")}
          onBlur={() => releaseActiveFormField("passage")}
        />
        {passagePreview ? (
          <View style={versePreviewCardStyle}>
            {passagePreviewRef ? (
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: READER_M3_ON_SURFACE_VARIANT,
                  marginBottom: 6,
                }}
              >
                {passagePreviewRef}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: "Lora_400Regular",
                fontSize: 13,
                lineHeight: 18,
                color: colors.brown800,
                fontStyle: "italic",
              }}
            >
              {passagePreview}
            </Text>
          </View>
        ) : null}
        {passageSuggestion ? (
          <Text
            style={{
              marginTop: 6,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: READER_M3_ON_SURFACE_VARIANT,
            }}
          >
            {passageSuggestion}
          </Text>
        ) : null}
      </View>

      <View collapsable={false} style={{ backgroundColor: modalSurfaceColor }}>
        <M3OutlinedTextField
          label="Title (optional)"
          value={title}
          onChangeText={(t) => {
            hapticSelection();
            setTitle(t);
          }}
          surfaceColor={modalSurfaceColor}
          accentColor={colors.brown800}
          roundedEnds
          minHeight={52}
          inputFontFamily="Lora_400Regular"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissJournalKeyboard}
          onFocus={() => markActiveFormField("title")}
          onBlur={() => releaseActiveFormField("title")}
        />
      </View>
    </>
  );

  const formReflectionSection = (
    <View style={reflectionShellStyle}>
        <View style={{ marginBottom: 6 }}>
          <Text
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "Inter_400Regular", color: colors.tan200 }}
          >
            Reflection
          </Text>
        </View>
        <View
          style={
            sheetFormLayout
              ? { flex: 1, minHeight: 0, position: "relative" as const }
              : { position: "relative" as const }
          }
        >
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 10,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Write reflection fullscreen"
              onPress={openReflectionFullscreen}
              activeOpacity={0.85}
              style={reflectionOverlayButtonStyle}
            >
              <ReflectionFullscreenIcon size={18} color={toolbarIconColor} />
            </TouchableOpacity>
          </View>
          <View
            className="rounded-2xl overflow-hidden"
            style={[reflectionParchmentStyle, { backgroundColor: colors.parchmentDark }]}
          >
            <View style={[reflectionInnerPadStyle, { paddingTop: 36 }]}>
              <RichEditor
                key={`${editDraft?.id ?? "new-entry-reflection"}-${reflectionInlineRemountKey}-${themeId}`}
                ref={richEditorRef}
                {...REFLECTION_RICH_EDITOR_PROPS}
                style={reflectionRichEditorLayoutStyle}
                editorStyle={reflectionRichEditorEditorStyle}
                placeholder=""
                initialContentHTML={reflectionHtml}
                onChange={onReflectionHtmlChangedFromEditor}
                onFocus={onReflectionEditorFocus}
                onBlur={onReflectionEditorBlur}
              />
            </View>
          </View>
        </View>
    </View>
  );

  const formFields = (
    <>
      {formLeadingSections}
      {formReflectionSection}
    </>
  );

  const saveRowPaddingBottom = sheetFormLayout
    ? SHEET_SAVE_BOTTOM_PADDING_PX
    : readerNewEntryFromReader
      ? Math.max(8, Math.max(insets.bottom, 12) - readerCardBottomLiftPx)
      : Math.max(insets.bottom, 12);

  const saveFooterShellStyle = {
    paddingTop: 14,
    paddingBottom: saveRowPaddingBottom,
    backgroundColor: modalSurfaceColor,
    alignItems: "center" as const,
  };

  const saveGradientButton = (
    <TouchableOpacity
      className="rounded-full overflow-hidden"
      onPress={() => void handleSave()}
      disabled={saving}
    >
      <LinearGradient
        colors={saving ? [...j.saveReflectionGradientSaving] : [...j.saveReflectionGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 18,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 16, color: SAVE_BUTTON_LABEL_COLOR }}>
          {saving ? "Saving..." : editDraft ? "Save changes" : "Save Reflection"}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <>
    <View
      style={[
        { backgroundColor: modalSurfaceColor, width: "100%" },
        isTabletForm ? { alignItems: "center" as const } : null,
        contentScrollMaxHeight != null
          ? {
              flex: 1,
              minHeight: 0,
              ...(sheetKeyboardLiftPx !== undefined ? null : { maxHeight: contentScrollMaxHeight }),
            }
          : { flex: 1 },
      ]}
    >
      <View
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          maxWidth: isTabletForm ? TABLET_NEW_ENTRY_MAX_WIDTH_PX : undefined,
          backgroundColor: modalSurfaceColor,
          position: "relative",
        }}
      >
      {/*
        Keyboard avoidance around the scroll/edit region. Reader on phone + Android phones: one ScrollView
        includes save. iOS journal tablet: passage/title scroll + flex reflection + pinned save.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0, position: "relative" }}
        behavior={sheetFormLayout && sheetKeyboardLiftPx !== undefined ? undefined : "padding"}
        keyboardVerticalOffset={0}
      >
        {mergedFormScrollMode ? (
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{
              paddingTop: 0,
              paddingBottom: 8,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={FORM_SCROLL_KEYBOARD_DISMISS_MODE}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <View style={{ paddingLeft: padLeft, paddingRight: padRight }}>
              <View className="gap-2.5 pb-0">
                {formLeadingSections}
                {formReflectionSection}
              </View>
              <View style={saveFooterShellStyle}>{saveGradientButton}</View>
            </View>
          </ScrollView>
        ) : sheetFormLayout ? (
          <>
            <View
              style={{
                flex: 1,
                minHeight: 0,
                paddingLeft: padLeft,
                paddingRight: padRight,
              }}
            >
              {sheetNeedsScroll ? (
                <ScrollView
                  style={{ flex: 1, minHeight: 0 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={FORM_SCROLL_KEYBOARD_DISMISS_MODE}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  <View
                    className="gap-2.5 pb-0"
                    style={{ flexShrink: 0 }}
                    onLayout={onTopFieldsLayout}
                  >
                    {formLeadingSections}
                  </View>
                  {formReflectionSection}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, minHeight: 0 }}>
                  <View
                    className="gap-2.5 pb-0"
                    style={{ flexShrink: 0 }}
                    onLayout={onTopFieldsLayout}
                  >
                    {formLeadingSections}
                  </View>
                  {formReflectionSection}
                </View>
              )}
            </View>
            <View
              style={{
                paddingLeft: padLeft,
                paddingRight: padRight,
                ...saveFooterShellStyle,
              }}
            >
              {saveGradientButton}
            </View>
          </>
        ) : (
          <View
            style={{
              flex: 1,
              minHeight: 0,
              paddingLeft: padLeft,
              paddingRight: padRight,
              paddingBottom: 4,
            }}
          >
            <ScrollView
              style={{
                flexGrow: 0,
                flexShrink: 1,
                maxHeight: newEntryTopFieldsMaxScrollHeight,
              }}
              contentContainerStyle={{ flexGrow: 0, paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={FORM_SCROLL_KEYBOARD_DISMISS_MODE}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View className="gap-2.5 pb-0">{formLeadingSections}</View>
            </ScrollView>
            <View style={{ flex: 1, minHeight: 0 }}>{formReflectionSection}</View>
          </View>
        )}
        {!mergedFormScrollMode && !sheetFormLayout ? (
          <View
            style={{
              paddingLeft: padLeft,
              paddingRight: padRight,
              ...saveFooterShellStyle,
            }}
          >
            {saveGradientButton}
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {showReflectionFloatingToolbar && !reflectionFullscreenOpen ? (
        <View
          pointerEvents="box-none"
          style={[styles.floatingToolbarAnchorInline, { bottom: reflectionToolbarBottomPx }]}
        >
          {renderReflectionFloatingToolbar()}
        </View>
      ) : null}
      </View>
    </View>

    <Modal
      visible={reflectionFullscreenOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => void closeReflectionFullscreen()}
      accessibilityViewIsModal
    >
      <View style={{ flex: 1, backgroundColor: colors.parchment }} collapsable={false}>
        <KeyboardAvoidingView
          style={{ flex: 1, minHeight: 0, position: "relative" }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <View style={{ flex: 1, minHeight: 0 }}>
        <SafeAreaView
          style={{ flex: 1, minHeight: 0, backgroundColor: colors.parchment }}
          edges={["top", "left", "right", "bottom"]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: 10,
            }}
          >
            <Text
              className="text-xs tracking-widest uppercase"
              style={{ fontFamily: "Inter_400Regular", color: colors.tan200 }}
            >
              Reflection
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Done writing reflection"
              onPress={() => void closeReflectionFullscreen()}
              activeOpacity={0.85}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 16, color: colors.brown800 }}>Done</Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              flex: 1,
              minHeight: 0,
              paddingHorizontal: 12,
              paddingBottom: 12 + REFLECTION_FIELD_BOTTOM_TRIM_PX,
            }}
          >
            <View style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <View
                style={{
                  flex: 1,
                  minHeight: 0,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: colors.parchmentDark,
                }}
              >
                <RichEditor
                  key={`${reflectionFsMountKey}-${themeId}`}
                  ref={fullscreenRichEditorRef}
                  {...REFLECTION_RICH_EDITOR_PROPS}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    alignSelf: "stretch",
                    width: "100%",
                    borderRadius: 0,
                    backgroundColor: colors.parchmentDark,
                  }}
                  initialFocus
                  editorStyle={reflectionRichEditorEditorStyle}
                  placeholder=""
                  initialContentHTML={reflectionHtml}
                  onChange={onReflectionHtmlChangedFromEditor}
                  onFocus={onReflectionEditorFocus}
                  onBlur={onReflectionEditorBlur}
                />
              </View>
            </View>
          </View>
        </SafeAreaView>
          </View>
        {showReflectionFloatingToolbar ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.floatingToolbarAnchorInline,
              {
                bottom:
                  Platform.OS === "android" && keyboardHeight > 0
                    ? keyboardHeight + FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX
                    : FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX,
              },
            ]}
          >
            {renderReflectionFloatingToolbar()}
          </View>
        ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>

    {saveToastMessage ? (
      <Animated.View pointerEvents="none" style={[styles.saveToastWrap, { opacity: saveToastOpacity }]}>
        <View style={styles.saveToastBubble}>
          <Text style={styles.saveToastText}>{saveToastMessage}</Text>
        </View>
      </Animated.View>
    ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  floatingToolbarAnchorInline: {
    position: "absolute",
    bottom: FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 50,
    elevation: 50,
  },
  saveToastWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    elevation: 2000,
  },
  saveToastBubble: {
    maxWidth: 300,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(44, 36, 22, 0.92)",
    elevation: 8,
  },
  saveToastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    color: "#f5f2ec",
    textAlign: "center",
    width: "100%",
  },
});
