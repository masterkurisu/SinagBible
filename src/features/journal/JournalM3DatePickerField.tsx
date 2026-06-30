import { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticLightImpact } from "@/lib/haptics";
import {
  getJournalDateTimePicker,
  type JournalDateTimePickerEvent,
} from "@/src/features/journal/journalDatePickerNative";
import {
  READER_M3_ON_SURFACE,
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalM3DatePickerFieldProps = {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  bundle: MobileAppThemeBundle;
  placeholder?: string;
  /** Latest selectable date (defaults to today). */
  maximumDate?: Date;
  /** Earliest selectable date. */
  minimumDate?: Date;
};

function formatPickerDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** M3 pill-shaped date field — opens the platform date picker on press. */
export function JournalM3DatePickerField({
  label,
  value,
  onChange,
  bundle,
  placeholder = "Select date",
  maximumDate = new Date(),
  minimumDate,
}: JournalM3DatePickerFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const j = bundle.journal;
  const colors = bundle.ui;
  const rippleColor = bundle.chrome.androidRipple;
  const displayValue = value ? formatPickerDate(value) : placeholder;
  const displayIsPlaceholder = value == null;

  const pickerValue = useMemo(() => value ?? maximumDate, [maximumDate, value]);
  const DateTimePicker = pickerOpen ? getJournalDateTimePicker() : null;

  const openPicker = useCallback(() => {
    hapticLightImpact();
    const Picker = getJournalDateTimePicker();
    if (!Picker) {
      Alert.alert(
        "Date picker unavailable",
        "Rebuild the Android dev client to enable date filtering:\nnpx expo run:android",
      );
      return;
    }
    setPickerOpen(true);
  }, []);

  const handlePickerChange = useCallback(
    (event: JournalDateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === "android") {
        setPickerOpen(false);
      }
      if (event.type === "dismissed") {
        setPickerOpen(false);
        return;
      }
      if (selected) {
        onChange(selected);
      }
    },
    [onChange],
  );

  const clearDate = useCallback(() => {
    hapticLightImpact();
    onChange(null);
  }, [onChange]);

  if (Platform.OS !== "android") {
    return null;
  }

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: j.dateHeading }]}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayIsPlaceholder ? placeholder : displayValue}`}
        android_ripple={{ color: rippleColor }}
        style={[
          styles.field,
          {
            backgroundColor: j.chipInactiveBackground,
            borderColor: value ? colors.brown800 : j.chipInactiveBorder,
          },
        ]}
      >
        <Text
          style={[
            styles.fieldValue,
            { color: displayIsPlaceholder ? READER_M3_ON_SURFACE_VARIANT : READER_M3_ON_SURFACE },
          ]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
        <View style={styles.trailingIcons}>
          {value ? (
            <Pressable
              onPress={clearDate}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label.toLowerCase()}`}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={18} color={READER_M3_ON_SURFACE_VARIANT} />
            </Pressable>
          ) : null}
          <MaterialIcons name="calendar-today" size={20} color={colors.brown800} />
        </View>
      </Pressable>

      {DateTimePicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="calendar"
          onChange={handlePickerChange}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  field: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  fieldValue: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  trailingIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },
  clearButton: {
    padding: 2,
  },
});
