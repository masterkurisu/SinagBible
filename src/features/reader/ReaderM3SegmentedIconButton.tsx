import { Fragment, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import {
  READER_M3_SEGMENTED_BUTTON_HEIGHT_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderM3SegmentedIconOption<T extends string> = {
  value: T;
  renderIcon?: (selected: boolean) => ReactNode;
  label?: string;
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
  const sheetChrome = getReaderSheetChrome(bundle);
  const height = READER_M3_SEGMENTED_BUTTON_HEIGHT_PX * scale;
  const radius = 20 * scale;
  const hasTextLabels = options.some((option) => option.label);

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
        const showDivider = index > 0 && hasTextLabels;
        return (
          <Fragment key={opt.value}>
            {showDivider ? (
              <View
                style={{
                  width: StyleSheet.hairlineWidth,
                  alignSelf: "stretch",
                  marginVertical: 8 * scale,
                  backgroundColor: sheetChrome.outlineVariant,
                }}
              />
            ) : null}
            <Pressable
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={opt.accessibilityLabel}
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
              {opt.renderIcon ? (
                <View style={styles.iconWrap}>{opt.renderIcon(selected)}</View>
              ) : null}
              {opt.label ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium",
                    fontSize: 13 * scale,
                    lineHeight: 18 * scale,
                    letterSpacing: 0.1,
                    color: readerM3SegmentedIconColor(selected, bundle),
                    textAlign: "center",
                    paddingHorizontal: 8 * scale,
                  }}
                >
                  {opt.label}
                </Text>
              ) : null}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** Icon tint helper for segmented alignment buttons. */
export function readerM3SegmentedIconColor(
  selected: boolean,
  bundle: MobileAppThemeBundle,
): string {
  const sheetChrome = getReaderSheetChrome(bundle);
  return selected ? sheetChrome.onSecondaryContainer : sheetChrome.onSurface;
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
