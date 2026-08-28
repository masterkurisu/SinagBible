import { useCallback, useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  mobileAppThemePickerOptions,
  type MobileAppThemeBundle,
  type MobileAppThemeId,
} from "@sinag-bible/tokens";
import { M3Button } from "@/src/components/m3/M3Button";
import { ReaderM3BottomSheet } from "@/src/components/m3/ReaderM3BottomSheet";
import { hapticLightImpact } from "@/lib/haptics";
import { getReaderSheetChrome } from "@/lib/reader-sheet-chrome";
import { readerThemeTileOnSwatchLabel } from "@/src/features/reader/readerThemeTileChrome";
import {
  READER_M3_BODY_FONT_PX,
  READER_M3_BODY_LINE_HEIGHT_PX,
  READER_OVERLAY_CONTENT_SCALE,
  readerM3SheetMaxWidthPx,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type ReaderThemePickerSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  bundle: MobileAppThemeBundle;
  insets: { top: number; bottom: number; left: number; right: number };
  isTabletReaderLayout: boolean;
  themeId: MobileAppThemeId;
  setThemeId: (id: MobileAppThemeId) => void;
};

export function ReaderThemePickerSheet({
  isOpen,
  onClose,
  bundle,
  insets,
  isTabletReaderLayout,
  themeId,
  setThemeId,
}: ReaderThemePickerSheetProps) {
  const sheetChrome = useMemo(() => getReaderSheetChrome(bundle), [bundle]);
  const rippleColor = bundle.chrome.androidRipple;
  const primary = bundle.chrome.tabTint;
  const { width: screenW } = useWindowDimensions();

  const scale = READER_OVERLAY_CONTENT_SCALE;
  const useBottomSheet = !isTabletReaderLayout;
  const sheetMaxW = readerM3SheetMaxWidthPx(screenW, isTabletReaderLayout, "compact");
  const padH = 24 * scale;
  const rowGap = 24 * scale;
  const colGap = 16 * scale;

  /**
   * Measure the grid's actual rendered width instead of trusting the sheet's
   * computed width alone: unusual aspect ratios (foldables, split-screen,
   * rotation) can make the assumed screen-width-minus-padding math diverge
   * from what the row container really gets, which is what broke the layout
   * on wide/narrow devices. The column count and cell sizing are then derived
   * from that measured width so the grid stays consistent on any shape.
   */
  const [measuredW, setMeasuredW] = useState(0);
  const fallbackContentW = sheetMaxW - padH * 2;
  const contentW = measuredW > 0 ? measuredW : fallbackContentW;
  const minCellW = 84 * scale;
  const maxColumns = Math.min(4, mobileAppThemePickerOptions.length);
  const columns = Math.max(
    2,
    Math.min(maxColumns, Math.floor((contentW + colGap) / (minCellW + colGap)) || 2),
  );
  const cellW = (contentW - colGap * (columns - 1)) / columns;
  const circleSize = Math.min(64 * scale, cellW - 8 * scale);
  const ringSize = circleSize + 8 * scale;

  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setMeasuredW((prev) => (Math.abs(prev - nextWidth) > 0.5 ? nextWidth : prev));
  }, []);

  const handleSelectTheme = useCallback(
    (id: MobileAppThemeId) => {
      hapticLightImpact();
      setThemeId(id);
      onClose();
    },
    [onClose, setThemeId],
  );

  return (
    <ReaderM3BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      bundle={bundle}
      insets={insets}
      isTabletReaderLayout={isTabletReaderLayout}
      title="Theme"
      subtitle="Choose a color palette for home, reader, journal, and navigation."
      accessibilityDismissLabel="Dismiss theme picker"
      contentPaddingBottom={
        useBottomSheet ? Math.max(insets.bottom, 16) * scale : 16 * scale
      }
      blurBackdrop
    >
      <View style={[styles.grid, { marginBottom: 8 * scale }]} onLayout={handleGridLayout}>
        {mobileAppThemePickerOptions.map((opt, index) => {
          const selected = opt.id === themeId;
          const col = index % columns;
          const row = Math.floor(index / columns);
          const totalRows = Math.ceil(mobileAppThemePickerOptions.length / columns);
          const isLastCol = col === columns - 1;
          const isLastRow = row === totalRows - 1;
          const onSwatchLabel = readerThemeTileOnSwatchLabel(opt.swatchColor);
          return (
            <View
              key={opt.id}
              style={{
                width: cellW,
                marginRight: isLastCol ? 0 : colGap,
                marginBottom: isLastRow ? 0 : rowGap,
                alignItems: "center",
              }}
            >
              <Pressable
                onPress={() => handleSelectTheme(opt.id)}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected }}
                android_ripple={
                  Platform.OS === "android" ? { color: rippleColor, borderless: true } : undefined
                }
                style={({ pressed }) => ({
                  alignItems: "center",
                  justifyContent: "center",
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderWidth: selected ? 2.5 : 1,
                  borderColor: selected ? primary : sheetChrome.outlineVariant,
                  backgroundColor: pressed
                    ? sheetChrome.surfaceContainer
                    : selected
                      ? sheetChrome.surfaceContainerHigh
                      : "transparent",
                  overflow: "hidden",
                })}
              >
                <View
                  style={{
                    width: circleSize,
                    height: circleSize,
                    borderRadius: circleSize / 2,
                    backgroundColor: opt.swatchColor,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#000000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.12,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  {selected ? (
                    <View
                      style={{
                        width: 26 * scale,
                        height: 26 * scale,
                        borderRadius: 13 * scale,
                        backgroundColor: "rgba(255,255,255,0.94)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="check" size={16 * scale} color={primary} />
                    </View>
                  ) : (
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 13 * scale,
                        color: onSwatchLabel,
                        opacity: 0.9,
                      }}
                    >
                      Aa
                    </Text>
                  )}
                </View>
              </Pressable>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 10 * scale,
                  fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium",
                  fontSize: READER_M3_BODY_FONT_PX * scale * 0.8125,
                  lineHeight: READER_M3_BODY_LINE_HEIGHT_PX * scale * 0.8125,
                  color: selected ? sheetChrome.onSurface : sheetChrome.onSurfaceVariant,
                  textAlign: "center",
                  maxWidth: cellW,
                }}
              >
                {opt.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 24 * scale }}>
        <M3Button
          label="Close"
          variant="text"
          onPress={() => {
            hapticLightImpact();
            onClose();
          }}
          bundle={bundle}
          scale={scale}
          fullWidth
        />
      </View>
    </ReaderM3BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
