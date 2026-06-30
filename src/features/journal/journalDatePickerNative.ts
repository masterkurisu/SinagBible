import type { ComponentType } from "react";
import { NativeModules, Platform } from "react-native";

export type JournalDateTimePickerEvent = {
  type: string;
  nativeEvent?: {
    timestamp: number;
    utcOffset?: number;
  };
};

export type JournalDateTimePickerProps = {
  value: Date;
  mode: "date";
  display?: "default" | "spinner" | "calendar" | "clock";
  onChange: (event: JournalDateTimePickerEvent, date?: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
};

/** True when the dev client was built with `@react-native-community/datetimepicker`. */
export function isJournalDatePickerNativeAvailable(): boolean {
  if (Platform.OS !== "android") return false;
  return Boolean((NativeModules as Record<string, unknown>).RNCDatePicker);
}

let cachedPicker: ComponentType<JournalDateTimePickerProps> | null | undefined;

/** Lazy-load the picker so Metro reload does not crash when the native module is missing. */
export function getJournalDateTimePicker(): ComponentType<JournalDateTimePickerProps> | null {
  if (!isJournalDatePickerNativeAvailable()) {
    cachedPicker = null;
    return null;
  }
  if (cachedPicker !== undefined) {
    return cachedPicker ?? null;
  }
  try {
    cachedPicker = require("@react-native-community/datetimepicker").default;
  } catch {
    cachedPicker = null;
  }
  return cachedPicker ?? null;
}
