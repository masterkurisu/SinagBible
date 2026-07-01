import { useRef, useState } from "react";
import { View, PanResponder, type LayoutChangeEvent } from "react-native";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import { hapticSelection } from "@/lib/haptics";
import {
  READER_M3_OUTLINE_VARIANT,
  READER_M3_SURFACE_CONTAINER_HIGH,
} from "@/src/features/reader/readerSettingsPanelChrome";

type M3SliderProps = {
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
  accessibilityLabel?: string;
  bundle: MobileAppThemeBundle;
  scale?: number;
};

const THUMB_SIZE_PX = 20;
const TRACK_HEIGHT_PX = 4;
const HIT_PADDING_V_PX = 14;

/**
 * M3 slider — 4dp track, 20dp thumb, primary active fill.
 * Touch target meets the 48dp minimum via vertical hit padding.
 */
export function M3Slider({
  value,
  min,
  max,
  onValueChange,
  accessibilityLabel,
  bundle,
  scale = 1,
}: M3SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackW = useRef(0);
  const propsRef = useRef({ min, max, onValueChange });
  propsRef.current = { min, max, onValueChange };

  const thumb = THUMB_SIZE_PX * scale;
  const trackHeight = TRACK_HEIGHT_PX * scale;
  const hitPaddingV = HIT_PADDING_V_PX * scale;
  const rowHeight = thumb + hitPaddingV;

  const primary = bundle.chrome.tabTint;
  const inactiveTrack = READER_M3_OUTLINE_VARIANT;
  const thumbColor = bundle.ui.parchment;
  const thumbBorder = READER_M3_SURFACE_CONTAINER_HIGH;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        hapticSelection();
        applyTouch(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => {
        applyTouch(e.nativeEvent.locationX);
      },
    }),
  ).current;

  function applyTouch(locationX: number) {
    const w = trackW.current;
    if (w <= 0) return;
    const { min: lo, max: hi, onValueChange: onChange } = propsRef.current;
    const ratio = Math.min(1, Math.max(0, locationX / w));
    const raw = lo + ratio * (hi - lo);
    const stepped = Math.round(raw * 100) / 100;
    onChange(Math.min(hi, Math.max(lo, stepped)));
  }

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackW.current = w;
    setTrackWidth(w);
  };

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const usable = Math.max(0, trackWidth - thumb);
  const thumbLeft = ratio * usable;
  const trackTop = (thumb - trackHeight) / 2;

  const a11yPct = (n: number) => Math.round(n * 100);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: a11yPct(min),
        max: a11yPct(max),
        now: a11yPct(value),
        text: `${a11yPct(value)}%`,
      }}
    >
      <View
        onLayout={onTrackLayout}
        {...pan.panHandlers}
        style={{
          minHeight: rowHeight,
          justifyContent: "center",
        }}
      >
        <View style={{ height: thumb, width: "100%" }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: trackTop,
              height: trackHeight,
              borderRadius: trackHeight / 2,
              backgroundColor: inactiveTrack,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${ratio * 100}%`,
                height: "100%",
                borderRadius: trackHeight / 2,
                backgroundColor: primary,
              }}
            />
          </View>

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: thumbLeft,
              top: 0,
              width: thumb,
              height: thumb,
              borderRadius: thumb / 2,
              backgroundColor: thumbColor,
              borderWidth: 1,
              borderColor: thumbBorder,
              shadowColor: bundle.ui.brown900,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.18,
              shadowRadius: 3,
              elevation: 2,
            }}
          />
        </View>
      </View>
    </View>
  );
}
