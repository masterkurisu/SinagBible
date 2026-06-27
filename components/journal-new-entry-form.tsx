import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  InteractionManager,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  parsePassageReference,
  formatPassageReference,
  getPassageMisspellingSuggestion,
} from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import {
  getChapterBySlugForTranslation,
  getClosestBookSuggestionForTranslation,
  getVersePreviewForTranslation,
  isTranslationId,
  resolvePassageBookSlugForTranslation,
  type TranslationId,
} from "@sinag-bible/core/bible-translations";
import { saveLocalEntry, updateLocalEntry } from "@/lib/journal-local";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RichEditor } from "react-native-pell-rich-editor";
import {
  ReflectionBoldIcon,
  ReflectionBulletedListIcon,
  ReflectionFormatStyleIcon,
  ReflectionFullscreenIcon,
  ReflectionImageIcon,
  ReflectionKeyboardHideIcon,
  ReflectionItalicIcon,
  ReflectionNumberedListIcon,
} from "@/components/journal-reflection-toolbar-icons";
import { isTabletLayout, TABLET_NEW_ENTRY_MAX_WIDTH_PX } from "@/lib/tablet-layout";
import { JournalOnboardingLayer } from "@/src/features/journal/JournalOnboardingLayer";
import { useJournalEditorOnboarding } from "@/src/features/journal/useJournalEditorOnboarding";
import type { JournalEditorOnboardingStepId } from "@/src/features/journal/journalEditorOnboardingSteps";

const VERSE_PREVIEW_LIMIT = 150;
const TOOLBAR_BTN_SIZE = 40;
const TOOLBAR_FAN_GAP = 10;
const FORMAT_POPOVER_ANCHOR_GAP = 10;
const FORMAT_ACTION_COUNT = 4;

const FORM_HORIZONTAL_PADDING = 10;
/** Pulls the reflection editor’s bottom edge up (journal card, reader sheet, fullscreen). */
const REFLECTION_FIELD_BOTTOM_TRIM_PX = 50;
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
          Math.round(contentScrollMaxHeight * (isTabletForm && isLandscapeForm ? 0.36 : 0.5)),
          isTabletForm && isLandscapeForm ? 260 : 320,
        )
      : Math.min(
          400,
          Math.round(windowHeight * (isTabletForm && isLandscapeForm ? 0.34 : 0.46)),
        );

  const requestedTranslationRaw =
    editDraft?.bible_translation?.trim().toUpperCase() ??
    initialParams?.translation?.trim().toUpperCase();
  const defaultTranslation: TranslationId = isTranslationId(requestedTranslationRaw)
    ? requestedTranslationRaw
    : "KJV";

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
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);
  const saveToastOpacity = useRef(new Animated.Value(0)).current;
  const saveToastAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const pendingSaveAfterToastRef = useRef<(() => void) | null>(null);
  const [journalKeyboardOpen, setJournalKeyboardOpen] = useState(false);

  const formatAnchorRef = useRef<View>(null);
  const formatAnchorFullscreenRef = useRef<View>(null);
  const passageAnchorRef = useRef<View>(null);
  const titleAnchorRef = useRef<View>(null);
  const photoAnchorRef = useRef<View>(null);
  const fullscreenAnchorRef = useRef<View>(null);

  const editorOnboardingTargetRefs = useMemo(
    (): Record<JournalEditorOnboardingStepId, React.RefObject<View | null>> => ({
      "passage-anchoring": passageAnchorRef,
      "optional-title": titleAnchorRef,
      "rich-text-toolbar": formatAnchorRef,
      "photo-attachment": photoAnchorRef,
      "fullscreen-mode": fullscreenAnchorRef,
    }),
    [],
  );

  const editorOnboarding = useJournalEditorOnboarding({
    enabled: !editDraft,
    targetRefs: editorOnboardingTargetRefs,
    screenW: windowWidth,
    screenH: windowHeight,
  });
  const popoverAnim = useRef(new Animated.Value(0)).current;
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<{ top: number; left: number } | null>(null);

  const getActiveReflectionEditor = () =>
    reflectionFullscreenOpen ? fullscreenRichEditorRef.current : richEditorRef.current;

  const undoReflection = () => {
    hapticLightImpact();
    getActiveReflectionEditor()?.commandDOM("document.execCommand('undo', false, null);");
  };

  const runEditorCommand = (command: string) => {
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
    const showSub = Keyboard.addListener(showEvent, () => setJournalKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setJournalKeyboardOpen(false));
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

  const closeFormatMenu = () => {
    setFormatMenuOpen(false);
    setPopoverPlacement(null);
  };

  const formatToolbarRowWidth =
    FORMAT_ACTION_COUNT * TOOLBAR_BTN_SIZE + (FORMAT_ACTION_COUNT - 1) * TOOLBAR_FAN_GAP;

  const openFormatPopover = (anchorRef: RefObject<View | null>) => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      const winW = Dimensions.get("window").width;
      const winH = Dimensions.get("window").height;
      const pad = 14;
      const fanWidth = formatToolbarRowWidth;
      let left = x + width - fanWidth;
      left = Math.max(pad, Math.min(left, winW - fanWidth - pad));
      const gap = FORMAT_POPOVER_ANCHOR_GAP;
      const rowH = TOOLBAR_BTN_SIZE;
      const minTop = insets.top + 8;
      const bottomPad = Math.max(insets.bottom, 20);
      const km = Keyboard.metrics();
      const keyboardTop =
        typeof km?.screenY === "number" && km.screenY > 0 && km.screenY <= winH ? km.screenY : winH;
      const maxTop = Math.max(
        minTop,
        Math.min(winH - rowH - bottomPad, keyboardTop - rowH - 8),
      );

      let top: number;
      if (reflectionFullscreenOpen) {
        /** Fan opens below the format control (toolbar is flush to the top). */
        top = y + height + gap;
        if (top > maxTop) top = maxTop;
      } else {
        const topAbove = y - rowH - gap;
        top = topAbove >= minTop ? topAbove : y + height + gap;
        if (top > maxTop) top = maxTop;
      }

      setPopoverPlacement({ top, left });
      setFormatMenuOpen(true);
    });
  };

  const toggleFormatMenu = (anchorRef: RefObject<View | null>) => {
    hapticLightImpact();
    if (formatMenuOpen) {
      closeFormatMenu();
    } else {
      openFormatPopover(anchorRef);
    }
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

  const toggleJournalKeyboard = () => {
    hapticLightImpact();
    closeFormatMenu();
    if (journalKeyboardOpen) {
      dismissJournalKeyboardCore();
      return;
    }
    getActiveReflectionEditor()?.focusContentEditor();
  };

  const onReflectionEditorFocus = () => setJournalKeyboardOpen(true);

  const onReflectionEditorBlur = () => {
    const ed = getActiveReflectionEditor();
    if (ed?.isKeyboardOpen) return;
    setJournalKeyboardOpen(false);
  };

  const openReflectionFullscreen = () => {
    hapticLightImpact();
    richEditorRef.current?.blurContentEditor();
    Keyboard.dismiss();
    closeFormatMenu();
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
      closeFormatMenu();
      Keyboard.dismiss();
      fullscreenRichEditorRef.current?.dismissKeyboard();
      setReflectionFullscreenOpen(false);
      InteractionManager.runAfterInteractions(() => {
        setReflectionInlineRemountKey((k) => k + 1);
      });
    }
  };

  useLayoutEffect(() => {
    if (!formatMenuOpen || !popoverPlacement) return;
    popoverAnim.setValue(0);
    const anim = Animated.spring(popoverAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    });
    anim.start();
    return () => anim.stop();
  }, [formatMenuOpen, popoverPlacement]);

  const formatActions = [
    {
      key: "bold",
      label: "Bold",
      icon: <ReflectionBoldIcon size={16} />,
      onPress: () => {
        hapticLightImpact();
        runEditorCommand("bold");
        closeFormatMenu();
      },
    },
    {
      key: "italic",
      label: "Italic",
      icon: <ReflectionItalicIcon size={16} />,
      onPress: () => {
        hapticLightImpact();
        runEditorCommand("italic");
        closeFormatMenu();
      },
    },
    {
      key: "bulleted-list",
      label: "Bulleted list",
      icon: <ReflectionBulletedListIcon size={16} />,
      onPress: () => {
        hapticLightImpact();
        runEditorCommand("insertUnorderedList");
        closeFormatMenu();
      },
    },
    {
      key: "numbered-list",
      label: "Numbered list",
      icon: <ReflectionNumberedListIcon size={16} />,
      onPress: () => {
        hapticLightImpact();
        runEditorCommand("insertOrderedList");
        closeFormatMenu();
      },
    },
  ] as const;

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

        const canonicalBook = await resolvePassageBookSlugForTranslation(defaultTranslation, parsed.book);
        if (!canonicalBook) {
          const closest = await getClosestBookSuggestionForTranslation(defaultTranslation, bookInput);
          if (!cancelled) {
            setPassagePreview(null);
            setPassagePreviewRef(null);
            setPassageSuggestion(
              closest ? `Did you mean ${closest.bookName} ${parsed.chapter}?` : "Book name not recognized.",
            );
          }
          return;
        }

        const chapterData = await getChapterBySlugForTranslation(
          defaultTranslation,
          canonicalBook,
          parsed.chapter,
        );

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

        const preview = await getVersePreviewForTranslation(
          defaultTranslation,
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
  }, [defaultTranslation, passage]);

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
  /** Reader new entry (not edit). */
  const readerNewEntryFromReader = readerNewEntryScrollable === true && !isEditMode;
  /**
   * Phone-only: one ScrollView for passage + reflection + save (keyboard). Tablets use the same
   * split layout as the journal tab so reflection gets flex height and the sheet is not half empty.
   */
  const readerMergedScrollMode = readerNewEntryFromReader && !isTabletForm;
  /**
   * Android phones: merged scroll keeps the reflection field reachable when the keyboard is open.
   * iOS journal keeps the split layout (passage/title scroll + flex reflection viewport).
   */
  const androidPhoneMergedScrollMode = Platform.OS === "android" && !isTabletForm;
  const mergedFormScrollMode = readerMergedScrollMode || androidPhoneMergedScrollMode;

  const trim = REFLECTION_FIELD_BOTTOM_TRIM_PX;
  const splitReflectionMinHeight =
    isTabletForm && isLandscapeForm && !mergedFormScrollMode ? 200 : 0;

  const reflectionShellStyle = mergedFormScrollMode
    ? { backgroundColor: modalSurfaceColor }
    : {
        backgroundColor: modalSurfaceColor,
        flex: 1,
        minHeight: splitReflectionMinHeight,
        marginBottom: trim,
      };
  const reflectionParchmentStyle = mergedFormScrollMode
    ? { marginTop: 5, minHeight: 240 - trim }
    : { marginTop: 5, flex: 1, minHeight: 0 };
  const reflectionInnerPadStyle = mergedFormScrollMode
    ? { minHeight: 220 - trim, paddingHorizontal: 8, paddingBottom: 19 }
    : { flex: 1, minHeight: 0, paddingHorizontal: 8, paddingBottom: 19 };
  const reflectionRichEditorLayoutStyle = mergedFormScrollMode
    ? {
        minHeight: 200 - trim,
        alignSelf: "stretch" as const,
        width: "100%" as const,
        borderRadius: 0,
        backgroundColor: colors.parchmentDark,
      }
    : {
        flex: 1,
        minHeight: 0,
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
          bible_translation: hasPassage ? defaultTranslation : null,
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
        bible_translation: hasPassage ? defaultTranslation : null,
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

  const formLeadingSections = (
    <>
      {!hideFormScreenTitle ? (
        <View
          style={{
            borderBottomWidth: 0,
            backgroundColor: modalSurfaceColor,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 22,
              lineHeight: 28,
              textAlign: "center",
              width: "100%",
              color: colors.brown800,
            }}
          >
            {editDraft ? "Edit Entry" : "New Entry"}
          </Text>
        </View>
      ) : null}

      <View
        ref={passageAnchorRef}
        collapsable={false}
        className="gap-1.5"
        style={{ paddingTop: 0, backgroundColor: modalSurfaceColor }}
      >
        <Text
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "Inter_400Regular", color: colors.tan200 }}
        >
          Passage (optional)
        </Text>
        <TextInput
          className="rounded-full px-4 py-3"
          style={{
            fontFamily: "Lora_400Regular",
            fontSize: TITLE_FIELD_FONT_SIZE,
            backgroundColor: colors.parchmentDark,
            color: colors.brown800,
          }}
          placeholder="e.g. John 3:16 or Romans 8"
          placeholderTextColor={colors.tan100}
          value={passage}
          onChangeText={(t) => {
            hapticSelection();
            setPassage(t);
          }}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissJournalKeyboard}
        />
        {passagePreview ? (
          <View
            style={{
              marginTop: 0,
              backgroundColor: j.versePreviewBackground,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            {passagePreviewRef ? (
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 10,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: colors.tan300,
                  marginBottom: 4,
                }}
              >
                {passagePreviewRef}
              </Text>
            ) : null}
            <Text
              style={{
                fontFamily: "Lora_400Regular",
                fontSize: 12,
                lineHeight: 17,
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
              marginTop: 0,
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: colors.tan300,
            }}
          >
            {passageSuggestion}
          </Text>
        ) : null}
      </View>

      <View ref={titleAnchorRef} collapsable={false} className="gap-1.5" style={{ backgroundColor: modalSurfaceColor }}>
        <Text
          className="text-xs tracking-widest uppercase"
          style={{ fontFamily: "Inter_400Regular", color: colors.tan200 }}
        >
          Title (optional)
        </Text>
        <TextInput
          className="rounded-full px-4 py-3"
          style={{
            fontFamily: "Lora_400Regular",
            fontSize: TITLE_FIELD_FONT_SIZE,
            backgroundColor: colors.parchmentDark,
            color: colors.brown800,
          }}
          value={title}
          onChangeText={(t) => {
            hapticSelection();
            setTitle(t);
          }}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={dismissJournalKeyboard}
        />
      </View>
    </>
  );

  const reflectionToolbarButtonStyle = {
    width: TOOLBAR_BTN_SIZE,
    height: TOOLBAR_BTN_SIZE,
    borderRadius: 999,
    backgroundColor: j.reflectionToolbarBackground,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

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
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 4,
            minHeight: TOOLBAR_BTN_SIZE,
          }}
        >
          <View ref={fullscreenAnchorRef} collapsable={false}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Write reflection fullscreen"
              onPress={openReflectionFullscreen}
              activeOpacity={0.85}
              style={reflectionToolbarButtonStyle}
            >
              <ReflectionFullscreenIcon size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={journalKeyboardOpen ? "Hide keyboard" : "Show keyboard"}
              accessibilityState={{ expanded: journalKeyboardOpen }}
              onPress={toggleJournalKeyboard}
              activeOpacity={0.85}
              style={[reflectionToolbarButtonStyle, { marginRight: TOOLBAR_FAN_GAP }]}
            >
              <ReflectionKeyboardHideIcon size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Undo"
              onPress={undoReflection}
              activeOpacity={0.85}
              style={[reflectionToolbarButtonStyle, { marginRight: TOOLBAR_FAN_GAP }]}
            >
              <Ionicons name="arrow-undo" size={18} color="#ffffff" />
            </TouchableOpacity>
            <View ref={formatAnchorRef} collapsable={false}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Formatting options"
                accessibilityState={{ expanded: formatMenuOpen }}
                onPress={() => toggleFormatMenu(formatAnchorRef)}
                activeOpacity={0.85}
                style={{
                  ...reflectionToolbarButtonStyle,
                  backgroundColor: formatMenuOpen
                    ? j.reflectionFormatMenuOpenBackground
                    : j.reflectionToolbarBackground,
                  opacity: formatMenuOpen ? 0.8 : 1,
                }}
              >
                <ReflectionFormatStyleIcon
                  size={18}
                  color={formatMenuOpen ? j.reflectionToolbarBackground : "#ffffff"}
                />
              </TouchableOpacity>
            </View>
            <View ref={photoAnchorRef} collapsable={false}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Attach image"
                onPress={() => void attachReflectionImage()}
                activeOpacity={0.85}
                style={[reflectionToolbarButtonStyle, { marginLeft: TOOLBAR_FAN_GAP }]}
              >
                <ReflectionImageIcon size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View
          className="rounded-2xl overflow-hidden"
          style={[reflectionParchmentStyle, { backgroundColor: colors.parchmentDark }]}
        >
          <View style={reflectionInnerPadStyle}>
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
  );

  const formFields = (
    <>
      {formLeadingSections}
      {formReflectionSection}
    </>
  );

  const saveRowPaddingBottom = readerNewEntryFromReader
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
          ? { flex: 1, minHeight: 0, maxHeight: contentScrollMaxHeight }
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
        }}
      >
      {/*
        Keyboard avoidance around the scroll/edit region. Reader on phone + Android phones: one ScrollView
        includes save. iOS journal tablet: passage/title scroll + flex reflection + pinned save.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior="padding"
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
        ) : isEditMode ? (
          <View
            style={{
              flex: 1,
              minHeight: 0,
              paddingLeft: padLeft,
              paddingRight: padRight,
              paddingBottom: 4,
            }}
          >
            <View className="gap-2.5 pb-0" style={{ flex: 1, minHeight: 0 }}>
              {formFields}
            </View>
          </View>
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
        {!mergedFormScrollMode ? (
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
          style={{ flex: 1, minHeight: 0 }}
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
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingHorizontal: 12,
              paddingBottom: 10,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={journalKeyboardOpen ? "Hide keyboard" : "Show keyboard"}
              accessibilityState={{ expanded: journalKeyboardOpen }}
              onPress={toggleJournalKeyboard}
              activeOpacity={0.85}
              style={[reflectionToolbarButtonStyle, { marginRight: TOOLBAR_FAN_GAP }]}
            >
              <ReflectionKeyboardHideIcon size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Undo"
              onPress={undoReflection}
              activeOpacity={0.85}
              style={[reflectionToolbarButtonStyle, { marginRight: TOOLBAR_FAN_GAP }]}
            >
              <Ionicons name="arrow-undo" size={18} color="#ffffff" />
            </TouchableOpacity>
            <View ref={formatAnchorFullscreenRef} collapsable={false}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Formatting options"
                accessibilityState={{ expanded: formatMenuOpen }}
                onPress={() => toggleFormatMenu(formatAnchorFullscreenRef)}
                activeOpacity={0.85}
                style={{
                  ...reflectionToolbarButtonStyle,
                  backgroundColor: formatMenuOpen
                    ? j.reflectionFormatMenuOpenBackground
                    : j.reflectionToolbarBackground,
                  opacity: formatMenuOpen ? 0.8 : 1,
                }}
              >
                <ReflectionFormatStyleIcon
                  size={18}
                  color={formatMenuOpen ? j.reflectionToolbarBackground : "#ffffff"}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Attach image"
              onPress={() => void attachReflectionImage()}
              activeOpacity={0.85}
              style={[reflectionToolbarButtonStyle, { marginLeft: TOOLBAR_FAN_GAP }]}
            >
              <ReflectionImageIcon size={18} color="#ffffff" />
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
        </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
        {formatMenuOpen && popoverPlacement !== null ? (
          <View style={styles.fsFormatOverlay} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss formatting options"
              style={StyleSheet.absoluteFill}
              onPress={closeFormatMenu}
            />
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.formatFanContainer,
                {
                  top: popoverPlacement.top,
                  left: popoverPlacement.left,
                  width: formatToolbarRowWidth,
                },
              ]}
            >
              {formatActions.map((action, index) => {
                const translateX = popoverAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -index * (TOOLBAR_BTN_SIZE + TOOLBAR_FAN_GAP)],
                });
                const scale = popoverAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.84, 1],
                });
                return (
                  <Animated.View
                    key={action.key}
                    style={{
                      position: "absolute",
                      left: formatToolbarRowWidth - TOOLBAR_BTN_SIZE,
                      top: 0,
                      opacity: popoverAnim,
                      transform: [{ translateX }, { scale }],
                    }}
                  >
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                      onPress={action.onPress}
                      activeOpacity={0.85}
                      style={[styles.formatActionButton, { backgroundColor: j.reflectionToolbarBackground }]}
                    >
                      {action.icon}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </View>
        ) : null}
      </View>
    </Modal>

    <Modal
      visible={formatMenuOpen && popoverPlacement !== null && !reflectionFullscreenOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeFormatMenu}
      accessibilityViewIsModal
    >
      <View style={styles.formatPopoverRoot} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss formatting options"
          style={StyleSheet.absoluteFill}
          onPress={closeFormatMenu}
        />
        {popoverPlacement ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.formatPopoverRowWrap,
              {
                top: popoverPlacement.top,
                left: popoverPlacement.left,
                width: formatToolbarRowWidth,
                opacity: popoverAnim,
                transform: [
                  {
                    scale: popoverAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.formatPopoverRow}>
              {formatActions.map((action, index) => (
                <TouchableOpacity
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={action.onPress}
                  activeOpacity={0.85}
                  style={[
                    styles.formatActionButton,
                    { backgroundColor: j.reflectionToolbarBackground },
                    index < formatActions.length - 1 ? { marginRight: TOOLBAR_FAN_GAP } : null,
                  ]}
                >
                  {action.icon}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>

    {saveToastMessage ? (
      <Animated.View pointerEvents="none" style={[styles.saveToastWrap, { opacity: saveToastOpacity }]}>
        <View style={styles.saveToastBubble}>
          <Text style={styles.saveToastText}>{saveToastMessage}</Text>
        </View>
      </Animated.View>
    ) : null}

    <JournalOnboardingLayer
      visible={editorOnboarding.showLayer}
      step={editorOnboarding.currentStep}
      stepAnchor={editorOnboarding.stepAnchor}
      colors={{
        tooltipBackground: colors.brown800,
        tooltipText: "#f5f2ec",
        arrow: "#FFFFFF",
      }}
    />
    </>
  );
});

const styles = StyleSheet.create({
  formatPopoverRoot: {
    flex: 1,
    backgroundColor: "transparent",
  },
  /** In-tree overlay: a second Modal does not reliably stack above this fullscreen Modal. */
  fsFormatOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  formatFanContainer: {
    position: "absolute",
    height: TOOLBAR_BTN_SIZE,
    zIndex: 2,
    elevation: 12,
  },
  formatPopoverRowWrap: {
    position: "absolute",
    height: TOOLBAR_BTN_SIZE,
    zIndex: 2,
    elevation: 8,
  },
  formatPopoverRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  formatActionButton: {
    width: TOOLBAR_BTN_SIZE,
    height: TOOLBAR_BTN_SIZE,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a140d",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  saveToastWrap: {
    ...StyleSheet.absoluteFillObject,
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
