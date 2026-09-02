import { type RefObject } from "react";
import { TouchableOpacity } from "react-native";
import type { EnrichedTextInputInstance, OnChangeStateEvent } from "react-native-enriched-html";
import {
  ReflectionBoldIcon,
  ReflectionBulletedListIcon,
  ReflectionChecklistIcon,
  ReflectionHeadingIcon,
  ReflectionImageIcon,
  ReflectionItalicIcon,
  ReflectionKeyboardHideIcon,
  ReflectionNumberedListIcon,
} from "@/components/journal-reflection-toolbar-icons";
import { ReflectionFormatRibbon } from "@/src/features/journal/ReflectionFormatRibbon";
import { Ionicons } from "@expo/vector-icons";
import { hapticLightImpact } from "@/lib/haptics";

const TOOLBAR_BTN_SIZE = 40;

type Props = {
  editorRef: RefObject<EnrichedTextInputInstance | null>;
  styleState: OnChangeStateEvent | null;
  iconColor: string;
  activeColor: string;
  borderColor: string;
  backgroundColor: string;
  onHideKeyboard: () => void;
  onInsertVerse: () => void;
  onAttachImage: () => void;
};

/**
 * Native Enriched format ribbon. No undo (0b). Mentions, images, and checklists
 * use the Phase 3 mappings that survived 0b. Legacy markdown helpers stay on
 * the MarkdownTextInput path.
 */
export function ReflectionEnrichedRibbon({
  editorRef,
  styleState,
  iconColor,
  activeColor,
  borderColor,
  backgroundColor,
  onHideKeyboard,
  onInsertVerse,
  onAttachImage,
}: Props) {
  const btnStyle = {
    width: TOOLBAR_BTN_SIZE,
    height: TOOLBAR_BTN_SIZE,
    borderRadius: TOOLBAR_BTN_SIZE / 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  const colorFor = (active: boolean | undefined) => (active ? activeColor : iconColor);

  const run = (action: () => void) => {
    hapticLightImpact();
    action();
  };

  return (
    <ReflectionFormatRibbon
      variant="docked"
      borderColor={borderColor}
      backgroundColor={backgroundColor}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Bold"
        onPress={() => {
          const editor = editorRef.current;
          if (editor) run(() => editor.toggleBold());
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionBoldIcon size={18} color={colorFor(styleState?.bold.isActive)} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Italic"
        onPress={() => {
          const editor = editorRef.current;
          if (editor) run(() => editor.toggleItalic());
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionItalicIcon size={18} color={colorFor(styleState?.italic.isActive)} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Heading"
        onPress={() => {
          const editor = editorRef.current;
          if (editor) run(() => editor.toggleH1());
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionHeadingIcon size={18} color={colorFor(styleState?.h1.isActive)} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Bulleted list"
        onPress={() => {
          const editor = editorRef.current;
          if (editor) run(() => editor.toggleUnorderedList());
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionBulletedListIcon size={18} color={colorFor(styleState?.unorderedList.isActive)} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Numbered list"
        onPress={() => {
          const editor = editorRef.current;
          if (editor) run(() => editor.toggleOrderedList());
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionNumberedListIcon size={18} color={colorFor(styleState?.orderedList.isActive)} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Checklist"
        onPress={() => {
          const editor = editorRef.current;
          if (editor) run(() => editor.toggleCheckboxList(false));
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionChecklistIcon size={18} color={colorFor(styleState?.checkboxList?.isActive)} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Insert verse"
        onPress={() => {
          hapticLightImpact();
          onInsertVerse();
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <Ionicons name="book-outline" size={20} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Attach image"
        onPress={() => {
          hapticLightImpact();
          onAttachImage();
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionImageIcon size={18} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Hide keyboard"
        onPress={() => {
          hapticLightImpact();
          onHideKeyboard();
        }}
        activeOpacity={0.85}
        style={btnStyle}
      >
        <ReflectionKeyboardHideIcon size={20} color={iconColor} />
      </TouchableOpacity>
    </ReflectionFormatRibbon>
  );
}
