import { type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle } from "react-native";

export function focusVerseTagElement(
  ref: RefObject<unknown> | null | undefined,
): void {
  const current = ref?.current;
  if (current == null) return;
  const node = findNodeHandle(current as never);
  if (node == null) return;
  AccessibilityInfo.setAccessibilityFocus(node);
}
