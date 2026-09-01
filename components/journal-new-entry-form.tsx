import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  useWindowDimensions,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import { useRouter } from "expo-router";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ComponentRef,
  type RefObject,
} from "react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "expo-image";
import {
  parsePassageReference,
  formatPassageReference,
  getPassageMisspellingSuggestion,
} from "@sinag-bible/core";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import {
  saveLocalEntry,
  updateLocalEntry,
  reflectionMarkdownToContent,
} from "@/lib/journal-local";
import { resolveReflectionMarkdownForEdit } from "@/lib/journal-reflection-edit";
import {
  applyReflectionToolbarAction,
  continueListOnNewline,
  countReflectionVerseTagTokens,
  deleteAtomicVerseTagOnEdit,
  insertReflectionImageToken,
  insertReflectionVerseTag,
  listReflectionImageIds,
  reflectionMarkdownHasContent,
  type ReflectionMarkdownEditResult,
  type ReflectionTextSelection,
  type ReflectionToolbarFormatAction,
} from "@/lib/journal-reflection-markdown-edit";
import { parseReflectionLiveMarkdown } from "@/lib/journal-reflection-live-markdown-parser";
import {
  createReflectionLiveMarkdownInputStyle,
  createReflectionLiveMarkdownStyle,
} from "@/lib/journal-reflection-live-markdown-style";
import {
  clearDefaultJournalDraft,
  DEFAULT_JOURNAL_DRAFT_ID,
  loadDefaultJournalDraft,
  registerJournalDraft,
} from "@/lib/journal-draft-index";
import { setPendingJournalDetailEntry } from "@/lib/journal-edit-bridge";
import {
  toMobileJournalListItem,
  type MobileJournalListItem,
} from "@/lib/load-journal-entries";
import {
  getJournalChapter,
  getJournalClosestBookSuggestion,
  getJournalVersePreview,
  normalizeJournalTranslationId,
  resolveJournalPassageBookSlug,
} from "@/lib/journal-verse-preview";
import { getTranslationDisplayAbbreviation } from "@/lib/translation-display-label";
import { hapticLightImpact, hapticSelection } from "@/lib/haptics";
import { SCROLL_EVENT_THROTTLE } from "@/lib/high-refresh-scroll";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  ReflectionBoldIcon,
  ReflectionBulletedListIcon,
  ReflectionChecklistIcon,
  ReflectionFullscreenIcon,
  ReflectionHeadingIcon,
  ReflectionImageIcon,
  ReflectionKeyboardHideIcon,
  ReflectionItalicIcon,
  ReflectionLinkIcon,
  ReflectionNumberedListIcon,
} from "@/components/journal-reflection-toolbar-icons";
import { isTabletLayout, TABLET_NEW_ENTRY_MAX_WIDTH_PX } from "@/lib/tablet-layout";
import { M3OutlinedTextField } from "@/src/components/m3/M3OutlinedTextField";
import { JournalM3FilterChip } from "@/src/features/journal/JournalM3FilterChip";
import {
  formatJournalTagLabel,
  JOURNAL_TAG_SUGGESTIONS,
  normalizeJournalTag,
  normalizeJournalTags,
} from "@/lib/journal-tags";
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
import { useVerseTagMention } from "@/src/features/verse-tags/useVerseTagMention";
import { VerseTagComposerOverlay } from "@/src/features/verse-tags/VerseTagComposerOverlay";
import { VerseTagMentionSheet } from "@/src/features/verse-tags/VerseTagMentionSheet";
import type { VerseTagRef } from "@sinag-bible/types";

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
  content_markdown?: string | null;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  bible_translation?: string | null;
  tags?: string[];
};

type Props = {
  initialParams?: JournalNewEntryInitialParams;
  /** When set, the form updates this entry instead of creating a new one. */
  editDraft?: JournalEditDraft | null;
  /** When set, called instead of default stack navigation after a successful save. */
  onAfterSave?: (saved?: MobileJournalListItem) => void;
  /** Cap scroll area height (e.g. bottom sheet on journal tab). */
  contentScrollMaxHeight?: number;
  /**
   * Bottom sheet only: minimum content height (top fields + reflection min + save) so the parent
   * can grow or shrink the sheet card to fit.
   */
  onSheetPreferredHeightChange?: (contentHeightPx: number) => void;
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
  const modalSurfaceColor = j.newEntrySheetBackground;

  const initialReflectionState = useMemo(
    () => (editDraft ? resolveReflectionMarkdownForEdit(editDraft) : { markdown: "", images: {} as Record<string, string> }),
    [editDraft],
  );

  const baseContentPad =
    contentHorizontalPadding !== undefined ? contentHorizontalPadding : FORM_HORIZONTAL_PADDING;
  const padLeft = Math.max(baseContentPad, insets.left);
  const padRight = Math.max(baseContentPad, insets.right);
  /**
   * Keep passage/title in a bounded scroll region so the reflection editor keeps height.
   * Tablet landscape: use a smaller share so the reflection field does not collapse to a sliver.
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
  const [tags, setTags] = useState<string[]>(() => normalizeJournalTags(editDraft?.tags));
  const [tagDraft, setTagDraft] = useState("");
  const [reflectionMarkdown, setReflectionMarkdown] = useState(() => initialReflectionState.markdown);
  const [reflectionImages, setReflectionImages] = useState<Record<string, string>>(
    () => initialReflectionState.images,
  );
  const reflectionMarkdownRef = useRef(reflectionMarkdown);
  reflectionMarkdownRef.current = reflectionMarkdown;
  const reflectionImagesRef = useRef(reflectionImages);
  reflectionImagesRef.current = reflectionImages;
  const editReflectionBaselineRef = useRef(initialReflectionState.markdown);
  const reflectionUndoStackRef = useRef<string[]>([]);
  const draftHydrationDoneRef = useRef(editDraft != null);
  const reflectionInputRef = useRef<ComponentRef<typeof MarkdownTextInput>>(null);
  const fullscreenReflectionInputRef = useRef<ComponentRef<typeof MarkdownTextInput>>(null);
  const sheetFormScrollRef = useRef<ScrollView>(null);
  const toolbarAnchorRef = useRef<View>(null);
  const fullscreenToolbarAnchorRef = useRef<View>(null);
  const suppressReflectionBlurRef = useRef(false);
  const [reflectionFullscreenOpen, setReflectionFullscreenOpen] = useState(false);
  const [reflectionSelection, setReflectionSelection] = useState<ReflectionTextSelection>({
    start: 0,
    end: 0,
  });
  const reflectionSelectionRef = useRef(reflectionSelection);
  reflectionSelectionRef.current = reflectionSelection;
  /**
   * One-shot cursor nudge: RN's TextInput isn't given a permanently-controlled `selection` prop
   * (that breaks IME/autocorrect on Android), so after a *programmatic* edit (toolbar action,
   * list auto-continue, undo) we set this to push the native cursor to the right spot, then
   * clear it as soon as the input reports a selection back.
   */
  const [reflectionSelectionOverride, setReflectionSelectionOverride] =
    useState<ReflectionTextSelection | null>(null);
  /**
   * Frozen caret captured on toolbar `onPressIn`. Tapping a control outside
   * `MarkdownTextInput` can fire a blur-driven `onSelectionChange` (often `{0,0}`)
   * before `onPress`, which would otherwise insert markers at the start of the
   * document. Image attach also needs this snapshot because the picker blurs the
   * field before we insert the token.
   */
  const toolbarPressSelectionRef = useRef<ReflectionTextSelection | null>(null);
  const typingUndoBaselineRef = useRef<string | null>(null);
  const typingUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [reflectionToolbarBottomPx, setReflectionToolbarBottomPx] = useState(
    FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX,
  );
  const [activeFormField, setActiveFormField] = useState<JournalFormActiveField>(null);
  const activeFormFieldRef = useRef<JournalFormActiveField>(null);
  const formFollowUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFormFollowUpTimeout = useCallback(() => {
    if (formFollowUpTimeoutRef.current != null) {
      clearTimeout(formFollowUpTimeoutRef.current);
      formFollowUpTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearFormFollowUpTimeout(), [clearFormFollowUpTimeout]);

  const markActiveFormField = (field: JournalFormActiveField) => {
    activeFormFieldRef.current = field;
    setActiveFormField(field);
  };

  const releaseActiveFormField = (field: Exclude<JournalFormActiveField, null>) => {
    clearFormFollowUpTimeout();
    formFollowUpTimeoutRef.current = setTimeout(() => {
      formFollowUpTimeoutRef.current = null;
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

  const getActiveReflectionInput = () =>
    reflectionFullscreenOpen ? fullscreenReflectionInputRef.current : reflectionInputRef.current;

  const pushReflectionUndoValue = useCallback((value: string) => {
    const stack = reflectionUndoStackRef.current;
    if (stack[stack.length - 1] === value) return;
    stack.push(value);
    if (stack.length > 50) stack.shift();
  }, []);

  const pushReflectionUndo = useCallback(() => {
    pushReflectionUndoValue(reflectionMarkdownRef.current);
  }, [pushReflectionUndoValue]);

  /**
   * Typing itself now creates undo checkpoints, not just toolbar/image actions: after ~700ms of
   * no typing, whatever the text was *before* the current burst of keystrokes gets pushed onto
   * the undo stack, so Undo can revert a whole sentence/paragraph you just typed — similar to how
   * Notes/Word batch undo by pause-in-typing rather than by keystroke.
   */
  const flushTypingUndoCheckpoint = useCallback(() => {
    if (typingUndoTimerRef.current != null) {
      clearTimeout(typingUndoTimerRef.current);
      typingUndoTimerRef.current = null;
    }
    const baseline = typingUndoBaselineRef.current;
    typingUndoBaselineRef.current = null;
    if (baseline == null) return;
    pushReflectionUndoValue(baseline);
  }, [pushReflectionUndoValue]);

  const scheduleReflectionUndoCheckpoint = useCallback(
    (prevValue: string) => {
      if (typingUndoBaselineRef.current == null) {
        typingUndoBaselineRef.current = prevValue;
      }
      if (typingUndoTimerRef.current != null) clearTimeout(typingUndoTimerRef.current);
      typingUndoTimerRef.current = setTimeout(() => {
        typingUndoTimerRef.current = null;
        flushTypingUndoCheckpoint();
      }, 700);
    },
    [flushTypingUndoCheckpoint],
  );

  useEffect(
    () => () => {
      if (typingUndoTimerRef.current != null) clearTimeout(typingUndoTimerRef.current);
    },
    [],
  );

  const applyReflectionEdit = useCallback(
    (next: ReflectionMarkdownEditResult) => {
      flushTypingUndoCheckpoint();
      pushReflectionUndo();
      reflectionMarkdownRef.current = next.text;
      setReflectionMarkdown(next.text);
      reflectionSelectionRef.current = next.selection;
      setReflectionSelection(next.selection);
      setReflectionSelectionOverride(next.selection);
    },
    [flushTypingUndoCheckpoint, pushReflectionUndo],
  );

  useEffect(() => {
    const resolved = editDraft ? resolveReflectionMarkdownForEdit(editDraft) : { markdown: "", images: {} };
    editReflectionBaselineRef.current = resolved.markdown;
    reflectionMarkdownRef.current = resolved.markdown;
    setReflectionMarkdown(resolved.markdown);
    reflectionImagesRef.current = resolved.images;
    setReflectionImages(resolved.images);
    reflectionUndoStackRef.current = [];
    const cursor = resolved.markdown.length;
    const sel = { start: cursor, end: cursor };
    reflectionSelectionRef.current = sel;
    setReflectionSelection(sel);
    setReflectionSelectionOverride(null);
    typingUndoBaselineRef.current = null;
    if (typingUndoTimerRef.current != null) {
      clearTimeout(typingUndoTimerRef.current);
      typingUndoTimerRef.current = null;
    }
  }, [editDraft?.id, editDraft?.content, editDraft?.content_markdown]);

  const reflectionInputStyle = useMemo(
    () => createReflectionLiveMarkdownInputStyle(colors.brown800),
    [colors.brown800],
  );
  const reflectionMarkdownStyle = useMemo(
    () =>
      createReflectionLiveMarkdownStyle({
        gold: colors.gold,
        tan100: colors.tan100,
        brown800: colors.brown800,
      }),
    [colors.gold, colors.tan100, colors.brown800],
  );

  const reflectionTypingHapticLastRef = useRef(0);

  const persistReflectionMarkdown = useCallback(
    (text: string, cursorIndex?: number) => {
      markActiveFormField("reflection");
      const t = Date.now();
      if (t - reflectionTypingHapticLastRef.current >= 48) {
        reflectionTypingHapticLastRef.current = t;
        hapticSelection();
      }
      const prev = reflectionMarkdownRef.current;
      if (countReflectionVerseTagTokens(prev) !== countReflectionVerseTagTokens(text)) {
        flushTypingUndoCheckpoint();
        pushReflectionUndoValue(prev);
      } else {
        scheduleReflectionUndoCheckpoint(prev);
      }

      // Enter at the end of a "- "/"1. "/"- [ ] " line continues the list on the new line (or, on
      // an empty item, exits it) instead of leaving the user to type the prefix by hand each time.
      const continued = continueListOnNewline(prev, text);
      if (continued) {
        reflectionMarkdownRef.current = continued.text;
        setReflectionMarkdown(continued.text);
        reflectionSelectionRef.current = continued.selection;
        setReflectionSelection(continued.selection);
        setReflectionSelectionOverride(continued.selection);
        return;
      }

      reflectionMarkdownRef.current = text;
      setReflectionMarkdown(text);
      if (cursorIndex != null) {
        const sel = { start: cursorIndex, end: cursorIndex };
        reflectionSelectionRef.current = sel;
        setReflectionSelection(sel);
        setReflectionSelectionOverride(sel);
      }
    },
    [flushTypingUndoCheckpoint, pushReflectionUndoValue, scheduleReflectionUndoCheckpoint],
  );

  const {
    mentionOpen,
    mentionQuery,
    mentionError,
    suggestions,
    suggestionsPending,
    selectedSuggestionIndex,
    sheetOpen,
    handleChangeText,
    handleCursorChange,
    handleKeyPress,
    handleBlur,
    confirmSuggestion,
    beginSuggestionPick,
    openMentionSheet,
    closeMention,
    closeMentionSheet,
  } = useVerseTagMention({
    text: reflectionMarkdown,
    onChangeText: persistReflectionMarkdown,
    contextTranslation: journalTranslationId,
  });

  const onReflectionMarkdownChange = useCallback(
    (text: string) => {
      const prev = reflectionMarkdownRef.current;
      const atomic = deleteAtomicVerseTagOnEdit(prev, text);
      if (atomic) {
        handleChangeText(atomic.text, atomic.selection.end);
        return;
      }
      handleChangeText(text);
    },
    [handleChangeText],
  );

  const hasReflectionInput = reflectionMarkdownHasContent(reflectionMarkdown);
  const hasDraftInput =
    passage.trim().length > 0 || title.trim().length > 0 || tags.length > 0 || hasReflectionInput;
  const customTags = tags.filter(
    (tag) => !(JOURNAL_TAG_SUGGESTIONS as readonly string[]).includes(tag),
  );

  const toggleTag = (tag: string) => {
    hapticSelection();
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : normalizeJournalTags([...prev, tag]),
    );
  };

  const commitTagDraft = (raw: string) => {
    const tag = normalizeJournalTag(raw);
    if (!tag) return false;
    setTags((prev) => normalizeJournalTags([...prev, tag]));
    return true;
  };

  useEffect(() => {
    if (editDraft) return;
    let cancelled = false;
    void loadDefaultJournalDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        if (draft.passage.trim()) setPassage(draft.passage);
        if (draft.title.trim()) setTitle(draft.title);
        if (draft.tags && draft.tags.length > 0) setTags(draft.tags);
        if (draft.reflectionMarkdown.trim()) {
          reflectionMarkdownRef.current = draft.reflectionMarkdown;
          setReflectionMarkdown(draft.reflectionMarkdown);
        }
      }
      draftHydrationDoneRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [editDraft]);

  useEffect(() => {
    if (editDraft || !draftHydrationDoneRef.current) return;
    if (!hasDraftInput) {
      void clearDefaultJournalDraft();
      return;
    }
    const timer = setTimeout(() => {
      void registerJournalDraft(
        DEFAULT_JOURNAL_DRAFT_ID,
        JSON.stringify({
          passage,
          title,
          tags,
          reflectionMarkdown: reflectionMarkdownRef.current,
          journalTranslationId,
          initialParams,
          updatedAt: new Date().toISOString(),
        }),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [
    editDraft,
    hasDraftInput,
    passage,
    title,
    tags,
    reflectionMarkdown,
    journalTranslationId,
    initialParams,
  ]);

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
    if (contentScrollMaxHeight == null || keyboardHeight <= 0 || activeFormField !== "reflection") return;
    sheetFormScrollRef.current?.scrollToEnd({ animated: false });
  }, [keyboardHeight, activeFormField, contentScrollMaxHeight]);

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
    getActiveReflectionInput()?.blur();
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
    handleBlur();
    flushTypingUndoCheckpoint();
    if (suppressReflectionBlurRef.current || reflectionFullscreenOpen) return;
    if (keyboardHeight > 0) return;
    releaseActiveFormField("reflection");
    setJournalKeyboardOpen(false);
  };

  const showReflectionFloatingToolbar =
    activeFormField === "reflection" &&
    !mentionOpen &&
    (journalKeyboardOpen || reflectionFullscreenOpen);

  const measureReflectionToolbarBottomPx = useCallback(() => {
    if (keyboardHeight <= 0) {
      setReflectionToolbarBottomPx(FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX);
      return;
    }
    const anchorRef = reflectionFullscreenOpen ? fullscreenToolbarAnchorRef : toolbarAnchorRef;
    anchorRef.current?.measureInWindow((_x, y, _w, h) => {
      const anchorBottomY = y + h;
      const targetToolbarBottomY = windowHeight - keyboardHeight - FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX;
      setReflectionToolbarBottomPx(
        Math.max(FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX, anchorBottomY - targetToolbarBottomY),
      );
    });
  }, [keyboardHeight, reflectionFullscreenOpen, windowHeight]);

  const openReflectionFullscreen = () => {
    hapticLightImpact();
    suppressReflectionBlurRef.current = true;
    markActiveFormField("reflection");
    setJournalKeyboardOpen(true);
    setReflectionFullscreenOpen(true);
    reflectionInputRef.current?.blur();
    Keyboard.dismiss();
    clearFormFollowUpTimeout();
    formFollowUpTimeoutRef.current = setTimeout(() => {
      formFollowUpTimeoutRef.current = null;
      suppressReflectionBlurRef.current = false;
      fullscreenReflectionInputRef.current?.focus();
    }, 120);
  };

  const closeReflectionFullscreen = () => {
    hapticLightImpact();
    Keyboard.dismiss();
    fullscreenReflectionInputRef.current?.blur();
    markActiveFormField(null);
    setReflectionFullscreenOpen(false);
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
          const refCore = `${chapterData.bookName} ${parsed.chapter}${
              parsed.verseStart != null
                ? `:${parsed.verseStart}${parsed.verseEnd ? `-${parsed.verseEnd}` : ""}`
                : ""
            }`;
          const translationAbbr = getTranslationDisplayAbbreviation(journalTranslationId);
          setPassagePreview(limitedPreview);
          setPassagePreviewRef(
            translationAbbr ? `${refCore} (${translationAbbr})` : refCore,
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

  const snapshotReflectionSelectionForToolbar = () => {
    toolbarPressSelectionRef.current = reflectionSelectionRef.current;
  };

  const releaseToolbarSelectionSnapshot = () => {
    toolbarPressSelectionRef.current = null;
  };

  const applyToolbarAction = (action: ReflectionToolbarFormatAction) => {
    hapticLightImpact();
    const selection = toolbarPressSelectionRef.current ?? reflectionSelectionRef.current;
    releaseToolbarSelectionSnapshot();
    applyReflectionEdit(
      applyReflectionToolbarAction(reflectionMarkdownRef.current, selection, action),
    );
    // Focus after the edit so a pre-apply focus() cannot clobber the caret we just used.
    requestAnimationFrame(() => getActiveReflectionInput()?.focus());
  };

  const openInsertVerseSheet = () => {
    hapticLightImpact();
    beginSuggestionPick();
    openMentionSheet();
  };

  const insertPickedVerseTag = (ref: VerseTagRef) => {
    const selection = toolbarPressSelectionRef.current ?? reflectionSelectionRef.current;
    releaseToolbarSelectionSnapshot();
    applyReflectionEdit(
      insertReflectionVerseTag(
        reflectionMarkdownRef.current,
        selection,
        ref,
        journalTranslationId,
      ),
    );
    closeMention();
    requestAnimationFrame(() => getActiveReflectionInput()?.focus());
  };

  const attachReflectionImage = async () => {
    hapticLightImpact();
    const selection = toolbarPressSelectionRef.current ?? reflectionSelectionRef.current;
    if (toolbarPressSelectionRef.current == null) {
      toolbarPressSelectionRef.current = selection;
    }
    try {
      // Android: expo-image-picker uses the system Photo Picker (PickVisualMedia).
      // Do not request READ_MEDIA_* — Google Play rejects apps that declare those
      // permissions when a system picker is sufficient.
      if (Platform.OS === "ios") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          releaseToolbarSelectionSnapshot();
          Alert.alert("Permission needed", "Allow photo library access to attach images.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        // Prefer the system picker path; no editing UI that might need extra access.
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        releaseToolbarSelectionSnapshot();
        return;
      }
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        releaseToolbarSelectionSnapshot();
        Alert.alert("Could not read image", "Try another photo.");
        return;
      }
      const dataUrl = `data:image/jpeg;base64,${manipulated.base64}`;
      const imageId = `img-${Date.now()}`;
      const nextImages = { ...reflectionImagesRef.current, [imageId]: dataUrl };
      reflectionImagesRef.current = nextImages;
      setReflectionImages(nextImages);

      const inserted = insertReflectionImageToken(
        reflectionMarkdownRef.current,
        selection,
        imageId,
      );
      releaseToolbarSelectionSnapshot();
      applyReflectionEdit(inserted);
      requestAnimationFrame(() => getActiveReflectionInput()?.focus());
    } catch (e) {
      releaseToolbarSelectionSnapshot();
      if (__DEV__) {
        console.error(e);
      }
      Alert.alert("Could not attach image", "Try again.");
    }
  };

  const undoReflection = () => {
    hapticLightImpact();
    if (typingUndoTimerRef.current != null) {
      clearTimeout(typingUndoTimerRef.current);
      typingUndoTimerRef.current = null;
    }
    typingUndoBaselineRef.current = null;
    const stack = reflectionUndoStackRef.current;
    const previous = stack.pop();
    if (previous == null) return;
    reflectionMarkdownRef.current = previous;
    setReflectionMarkdown(previous);
    const cursor = previous.length;
    const sel = { start: cursor, end: cursor };
    reflectionSelectionRef.current = sel;
    setReflectionSelection(sel);
    setReflectionSelectionOverride(sel);
    requestAnimationFrame(() => getActiveReflectionInput()?.focus());
  };

  const finishSave = (newEntryId?: string, savedEntry?: MobileJournalListItem) => {
    if (onAfterSave) {
      onAfterSave(savedEntry);
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

  const buildReflectionPayloadForSave = () => {
    const markdown = reflectionMarkdownRef.current.trim();
    const content = reflectionMarkdownToContent(markdown, reflectionImagesRef.current);
    return { markdown, content };
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

  /** Full-screen routes (edit): anchor bottom is the screen edge — lift by keyboard inset. Sheets measure against the card. */
  const reflectionFloatingToolbarBottomPx = sheetFormLayout
    ? reflectionToolbarBottomPx
    : keyboardHeight > 0
      ? keyboardHeight + FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX
      : FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX;

  const formKeyboardVerticalOffset =
    !sheetFormLayout && Platform.OS === "ios" && hideFormScreenTitle ? insets.top + 52 : 0;

  useEffect(() => {
    if (!sheetFormLayout) return;
    if (!showReflectionFloatingToolbar || keyboardHeight <= 0) {
      setReflectionToolbarBottomPx(FLOATING_TOOLBAR_ABOVE_KEYBOARD_PX);
      return;
    }
    let cancelled = false;
    const runMeasure = () => {
      if (!cancelled) measureReflectionToolbarBottomPx();
    };
    const raf = requestAnimationFrame(runMeasure);
    const settleTimer = setTimeout(runMeasure, 48);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
    };
  }, [
    sheetFormLayout,
    showReflectionFloatingToolbar,
    keyboardHeight,
    reflectionFullscreenOpen,
    contentScrollMaxHeight,
    measureReflectionToolbarBottomPx,
  ]);

  const sheetTitleChromePx = hideFormScreenTitle ? 0 : 34;
  const sheetChromeOverheadPx = sheetTitleChromePx + SHEET_REFLECTION_CHROME_PX + 10;

  const onTopFieldsLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.height);
    setTopFieldsMeasuredH((prev) => {
      if (prev > 0 && Math.abs(prev - next) < 12) return prev;
      return next;
    });
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
    const next = sheetFieldsMinHeightPx + SHEET_SAVE_BLOCK_PX;
    onSheetPreferredHeightChange(next);
  }, [sheetFormLayout, onSheetPreferredHeightChange, sheetFieldsMinHeightPx, passagePreview]);

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
  const reflectionInputLayoutStyle = sheetFormLayout
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

    const { markdown, content } = buildReflectionPayloadForSave();
    if (!reflectionMarkdownHasContent(markdown)) {
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
      const titleTrim = title.trim() || null;
      const tagsNormalized = normalizeJournalTags(tags);

      if (editDraft) {
        const updated = await updateLocalEntry(editDraft.id, {
          book,
          chapter,
          verse_start,
          verse_end,
          bible_translation: hasPassage ? journalTranslationId : null,
          content,
          content_markdown: markdown,
          title: titleTrim,
          tags: tagsNormalized,
        });
        if (!updated) {
          throw new Error("Journal entry not found");
        }
        const savedEntry: MobileJournalListItem = {
          ...toMobileJournalListItem(updated),
          book,
          chapter,
          verse_start,
          verse_end,
          bible_translation: hasPassage ? journalTranslationId : null,
          content,
          content_markdown: markdown,
          title: titleTrim,
          tags: tagsNormalized,
        };
        setPendingJournalDetailEntry(savedEntry);
        await clearDefaultJournalDraft();
        confirmSaveSuccess("Changes saved", () => finishSave(undefined, savedEntry));
        return;
      }

      const saved = await saveLocalEntry({
        book,
        chapter,
        verse_start,
        verse_end,
        bible_translation: hasPassage ? journalTranslationId : null,
        content,
        content_markdown: markdown,
        title: titleTrim,
        is_favorite: false,
        tags: tagsNormalized,
      });

      await clearDefaultJournalDraft();
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
      >
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
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("bold")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionBoldIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Italic"
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("italic")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionItalicIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Heading"
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("heading")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionHeadingIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Bulleted list"
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("bullet")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionBulletedListIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Numbered list"
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("numbered")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionNumberedListIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Checklist"
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("checklist")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionChecklistIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Link"
          onPressIn={snapshotReflectionSelectionForToolbar}
          onPress={() => applyToolbarAction("link")}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <ReflectionLinkIcon size={18} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Insert verse"
          onPressIn={() => {
            snapshotReflectionSelectionForToolbar();
            beginSuggestionPick();
          }}
          onPress={openInsertVerseSheet}
          activeOpacity={0.85}
          style={floatingToolbarIconButtonStyle}
        >
          <Ionicons name="book-outline" size={20} color={toolbarIconColor} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Attach image"
          onPressIn={snapshotReflectionSelectionForToolbar}
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
      </ScrollView>
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

      <View collapsable={false} style={{ backgroundColor: modalSurfaceColor, marginTop: 12 }}>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            color: READER_M3_ON_SURFACE_VARIANT,
            marginBottom: 8,
          }}
        >
          Tags (optional)
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {JOURNAL_TAG_SUGGESTIONS.map((tag) => (
            <JournalM3FilterChip
              key={tag}
              label={formatJournalTagLabel(tag)}
              selected={tags.includes(tag)}
              onPress={() => toggleTag(tag)}
              bundle={bundle}
            />
          ))}
          {customTags.map((tag) => (
            <JournalM3FilterChip
              key={tag}
              label={formatJournalTagLabel(tag)}
              selected
              onPress={() => toggleTag(tag)}
              bundle={bundle}
              accessibilityLabel={`Remove tag ${formatJournalTagLabel(tag)}`}
            />
          ))}
        </View>
        {tags.length < 8 ? (
          <View style={{ marginTop: 8 }}>
            <M3OutlinedTextField
              label="Add a tag"
              value={tagDraft}
              onChangeText={(text) => {
                if (text.includes(",")) {
                  const [head, ...rest] = text.split(",");
                  if (commitTagDraft(head)) {
                    setTagDraft(rest.join(",").replace(/^\s+/, ""));
                    return;
                  }
                }
                setTagDraft(text);
              }}
              surfaceColor={modalSurfaceColor}
              accentColor={colors.brown800}
              roundedEnds
              minHeight={52}
              inputFontFamily="Inter_400Regular"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => {
                if (commitTagDraft(tagDraft)) setTagDraft("");
              }}
            />
          </View>
        ) : null}
      </View>
    </>
  );

  const renderVerseTagOverlay = () =>
    mentionOpen ? (
      <VerseTagComposerOverlay
        visible
        query={mentionQuery}
        error={mentionError}
        suggestions={suggestions}
        pending={suggestionsPending}
        selectedIndex={selectedSuggestionIndex}
        bundle={bundle}
        insets={insets}
        keyboardHeight={keyboardHeight}
        placement="absolute"
        onSelect={confirmSuggestion}
        onSelectStart={beginSuggestionPick}
        onDismiss={closeMention}
      />
    ) : null;

  /**
   * One live `MarkdownTextInput` for the whole reflection document — natively self-scrolling,
   * no per-block swap. Nested `ScrollView` around this field previously broke scrolling because
   * a multiline input captures drag for text selection.
   */
  const renderReflectionInput = (
    inputRef: RefObject<ComponentRef<typeof MarkdownTextInput> | null>,
    layoutStyle: StyleProp<ViewStyle>,
  ) => {
    const imageIds = listReflectionImageIds(reflectionMarkdown).filter((id) => reflectionImages[id]);
    return (
      <View style={[{ minHeight: sheetFormLayout ? 120 : 200 }, layoutStyle]}>
        <MarkdownTextInput
          ref={inputRef}
          multiline
          value={reflectionMarkdown}
          onChangeText={onReflectionMarkdownChange}
          parser={parseReflectionLiveMarkdown}
          markdownStyle={reflectionMarkdownStyle}
          selection={reflectionSelectionOverride ?? undefined}
          onSelectionChange={(e) => {
            // Ignore blur-driven resets while a toolbar press is in flight.
            if (toolbarPressSelectionRef.current != null) return;
            const next = e.nativeEvent.selection;
            setReflectionSelection(next);
            reflectionSelectionRef.current = next;
            if (reflectionSelectionOverride != null) setReflectionSelectionOverride(null);
            handleCursorChange(next);
          }}
          onFocus={onReflectionEditorFocus}
          onBlur={onReflectionEditorBlur}
          onKeyPress={handleKeyPress}
          style={[reflectionInputStyle, { flex: 1, minHeight: 0 }]}
          placeholder="Write your reflection…"
          placeholderTextColor={colors.tan200}
          scrollEnabled
          autoCorrect
          spellCheck
        />
        {imageIds.length > 0 ? (
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 8 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {imageIds.map((id, index) => (
              <Image
                key={`${id}-${index}`}
                source={{ uri: reflectionImages[id] }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.35)",
                }}
                contentFit="cover"
                accessibilityLabel="Attached reflection image"
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  const formReflectionSection = (
    <View style={[reflectionShellStyle, { marginTop: 5 }]}>
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
            <View style={reflectionInnerPadStyle}>
              {renderReflectionInput(reflectionInputRef, reflectionInputLayoutStyle)}
            </View>
          </View>
        </View>
    </View>
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
          ? { flex: 1, minHeight: 0, maxHeight: contentScrollMaxHeight }
          : { flex: 1 },
      ]}
    >
      <View
        ref={toolbarAnchorRef}
        collapsable={false}
        onLayout={() => {
          if (sheetFormLayout && showReflectionFloatingToolbar && keyboardHeight > 0) {
            requestAnimationFrame(measureReflectionToolbarBottomPx);
          }
        }}
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
        behavior={sheetFormLayout && Platform.OS === "android" ? undefined : "padding"}
        keyboardVerticalOffset={formKeyboardVerticalOffset}
      >
        {mergedFormScrollMode ? (
          <ScrollView
            style={styles.formOuterScroll}
            contentContainerStyle={styles.formOuterScrollContent}
            scrollEventThrottle={SCROLL_EVENT_THROTTLE}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={FORM_SCROLL_KEYBOARD_DISMISS_MODE}
            nestedScrollEnabled={Platform.OS === "android"}
            showsVerticalScrollIndicator
          >
            <View style={{ paddingLeft: padLeft, paddingRight: padRight }}>
              <View style={styles.formLeadingStack}>
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
              {/*
                Always a ScrollView (never swapped for a plain View) so toggling `sheetNeedsScroll`
                — e.g. when the sheet shrinks above the keyboard — never remounts this subtree and
                steals focus from the reflection TextInput mid-typing.
              */}
              <ScrollView
                ref={sheetFormScrollRef}
                style={styles.formOuterScroll}
                contentContainerStyle={
                  sheetNeedsScroll ? styles.sheetScrollContent : styles.sheetScrollContentFill
                }
                scrollEventThrottle={SCROLL_EVENT_THROTTLE}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={FORM_SCROLL_KEYBOARD_DISMISS_MODE}
                nestedScrollEnabled={Platform.OS === "android"}
                showsVerticalScrollIndicator={sheetNeedsScroll}
                scrollEnabled={sheetNeedsScroll}
              >
                <View
                  style={[styles.formLeadingStack, { flexShrink: 0 }]}
                  onLayout={onTopFieldsLayout}
                >
                  {formLeadingSections}
                </View>
                {formReflectionSection}
              </ScrollView>
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
              style={[styles.splitTopScroll, { maxHeight: newEntryTopFieldsMaxScrollHeight }]}
              contentContainerStyle={styles.splitTopScrollContent}
              scrollEventThrottle={SCROLL_EVENT_THROTTLE}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={FORM_SCROLL_KEYBOARD_DISMISS_MODE}
              nestedScrollEnabled={Platform.OS === "android"}
              showsVerticalScrollIndicator
            >
              <View style={styles.formLeadingStack}>{formLeadingSections}</View>
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
          style={[styles.floatingToolbarAnchorInline, { bottom: reflectionFloatingToolbarBottomPx }]}
        >
          {renderReflectionFloatingToolbar()}
        </View>
      ) : null}
      {!reflectionFullscreenOpen ? renderVerseTagOverlay() : null}
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
          <View
            ref={fullscreenToolbarAnchorRef}
            collapsable={false}
            style={{ flex: 1, minHeight: 0, position: "relative" }}
          >
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Done writing reflection"
                onPress={() => void closeReflectionFullscreen()}
                activeOpacity={0.85}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 16, color: colors.brown800 }}>Done</Text>
              </TouchableOpacity>
            </View>
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
                {renderReflectionInput(fullscreenReflectionInputRef, {
                  flex: 1,
                  minHeight: 0,
                  alignSelf: "stretch",
                  width: "100%",
                  borderRadius: 0,
                  backgroundColor: colors.parchmentDark,
                  paddingHorizontal: 8,
                  paddingTop: 16,
                  paddingBottom: 19,
                })}
              </View>
            </View>
          </View>
        </SafeAreaView>
        {showReflectionFloatingToolbar ? (
          <View
            pointerEvents="box-none"
            style={[styles.floatingToolbarAnchorInline, { bottom: reflectionFloatingToolbarBottomPx }]}
          >
            {renderReflectionFloatingToolbar()}
          </View>
        ) : null}
        {renderVerseTagOverlay()}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    <VerseTagMentionSheet
      isOpen={sheetOpen}
      onClose={closeMentionSheet}
      translationId={journalTranslationId}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletForm}
      onPick={insertPickedVerseTag}
    />

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
  formOuterScroll: {
    flex: 1,
    minHeight: 0,
  },
  formOuterScrollContent: {
    paddingTop: 0,
    paddingBottom: 8,
  },
  sheetScrollContent: {
    paddingBottom: 8,
  },
  sheetScrollContentFill: {
    flexGrow: 1,
  },
  formLeadingStack: {
    gap: 10,
    paddingBottom: 0,
  },
  splitTopScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  splitTopScrollContent: {
    flexGrow: 0,
    paddingBottom: 8,
  },
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
