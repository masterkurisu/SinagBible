import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  READER_M3_SEGMENTED_BUTTON_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderM3SegmentedTextOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type ReaderM3SegmentedTextButtonProps<T extends string> = {
  options: readonly ReaderM3SegmentedTextOption<T>[];
  value: T;
  onChange: (value: T) => void;
  bundle: MobileAppThemeBundle;
  scale?: number;
};

/** M3 single-select segmented button row with text labels. */
export function ReaderM3SegmentedTextButton<T extends string>({
  options,
  value,
  onChange,
  bundle,
  scale = 1,
}: ReaderM3SegmentedTextButtonProps<T>) {
  const rippleColor = bundle.chrome.androidRipple;
  const sheetChrome = getReaderSheetChrome(bundle);
  const height = READER_M3_SEGMENTED_BUTTON_HEIGHT_PX * scale;
  const radius = 20 * scale;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          borderRadius: radius,
          borderColor: sheetChrome.outlineVariant,
        },
      ]}
    >
      {options.map((opt, index) => {
        const selected = opt.value === value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected }}
            android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? sheetChrome.secondaryContainer : "transparent",
                borderTopLeftRadius: isFirst ? radius - 1 : 0,
                borderBottomLeftRadius: isFirst ? radius - 1 : 0,
                borderTopRightRadius: isLast ? radius - 1 : 0,
                borderBottomRightRadius: isLast ? radius - 1 : 0,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 14 * scale,
                lineHeight: 20 * scale,
                letterSpacing: 0.1,
                color: selected ? sheetChrome.onSecondaryContainer : sheetChrome.onSurface,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    overflow: "hidden",
  },
});
