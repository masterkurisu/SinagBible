import { type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  READER_M3_ON_SECONDARY_CONTAINER,
  READER_M3_ON_SURFACE,
  READER_M3_OUTLINE_VARIANT,
  READER_M3_SECONDARY_CONTAINER,
  READER_M3_SEGMENTED_BUTTON_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderM3SegmentedIconOption<T extends string> = {
  value: T;
  renderIcon: (selected: boolean) => ReactNode;
  accessibilityLabel: string;
};

type ReaderM3SegmentedIconButtonProps<T extends string> = {
  options: readonly ReaderM3SegmentedIconOption<T>[];
  value: T;
  onChange: (value: T) => void;
  bundle: MobileAppThemeBundle;
  scale?: number;
};

/**
 * M3 single-select segmented button row — connected outline container, tonal selected segment.
 */
export function ReaderM3SegmentedIconButton<T extends string>({
  options,
  value,
  onChange,
  bundle,
  scale = 1,
}: ReaderM3SegmentedIconButtonProps<T>) {
  const rippleColor = bundle.chrome.androidRipple;
  const height = READER_M3_SEGMENTED_BUTTON_HEIGHT_PX * scale;
  const radius = 20 * scale;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          borderRadius: radius,
          borderColor: READER_M3_OUTLINE_VARIANT,
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
            accessibilityLabel={opt.accessibilityLabel}
            accessibilityState={{ selected }}
            android_ripple={Platform.OS === "android" ? { color: rippleColor } : undefined}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? READER_M3_SECONDARY_CONTAINER : "transparent",
                borderTopLeftRadius: isFirst ? radius - 1 : 0,
                borderBottomLeftRadius: isFirst ? radius - 1 : 0,
                borderTopRightRadius: isLast ? radius - 1 : 0,
                borderBottomRightRadius: isLast ? radius - 1 : 0,
              },
            ]}
          >
            <View style={styles.iconWrap}>{opt.renderIcon(selected)}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Icon tint helper for segmented alignment buttons. */
export function readerM3SegmentedIconColor(selected: boolean): string {
  return selected ? READER_M3_ON_SECONDARY_CONTAINER : READER_M3_ON_SURFACE;
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
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
