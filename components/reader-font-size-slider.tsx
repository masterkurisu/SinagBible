import { useRef, useState } from "react";
import { View, Text, PanResponder, type LayoutChangeEvent } from "react-native";
import { colors } from "@sinag-bible/ui";
import { hapticSelection } from "@/lib/haptics";

type Props = {
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
  accessibilityLabel?: string;
  /** Default `font`: A / A hints. `lineSpacing`: Tight / Loose. `sheet`: track only (title lives outside). */
  variant?: "font" | "lineSpacing" | "sheet";
};

const THUMB = 24;
const TRACK_HEIGHT = 6;
const HIT_PADDING_V = 12;

/**
 * Pure RN slider — capsule track, soft thumb, typographic A/A hints (no native addon).
 */
export function ReaderFontSizeSlider({
  value,
  min,
  max,
  onValueChange,
  accessibilityLabel,
  variant = "font",
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackW = useRef(0);
  const propsRef = useRef({ min, max, onValueChange });
  propsRef.current = { min, max, onValueChange };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        hapticSelection();
        const w = trackW.current;
        if (w <= 0) return;
        const { min: lo, max: hi, onValueChange: onChange } = propsRef.current;
        const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
        const raw = lo + ratio * (hi - lo);
        const stepped = Math.round(raw * 100) / 100;
        onChange(Math.min(hi, Math.max(lo, stepped)));
      },
      onPanResponderMove: (e) => {
        const w = trackW.current;
        if (w <= 0) return;
        const { min: lo, max: hi, onValueChange: onChange } = propsRef.current;
        const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
        const raw = lo + ratio * (hi - lo);
        const stepped = Math.round(raw * 100) / 100;
        onChange(Math.min(hi, Math.max(lo, stepped)));
      },
    }),
  ).current;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackW.current = w;
    setTrackWidth(w);
  };

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const usable = Math.max(0, trackWidth - THUMB);
  const thumbLeft = ratio * usable;
  const rowHeight = THUMB + HIT_PADDING_V;
  /** Shared vertical center of track + thumb inside the `THUMB`-tall strip. */
  const trackTop = (THUMB - TRACK_HEIGHT) / 2;

  /** RN iOS bridge expects integer min/max/now on accessibilityValue. */
  const a11yPct = (n: number) => Math.round(n * 100);

  const trackRail = "rgba(44, 36, 22, 0.1)";
  const fillActive = colors.brown600;

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
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: variant === "sheet" ? 0 : 12,
          minHeight: rowHeight,
        }}
      >
        {variant === "font" ? (
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: colors.tan300,
              opacity: 0.85,
              marginTop: 1,
            }}
            accessibilityElementsHidden
          >
            A
          </Text>
        ) : variant === "lineSpacing" ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              color: colors.tan300,
              opacity: 0.9,
              marginTop: 1,
              width: 34,
            }}
            accessibilityElementsHidden
            numberOfLines={1}
          >
            Tight
          </Text>
        ) : null}

        <View
          onLayout={onTrackLayout}
          {...pan.panHandlers}
          style={{
            flex: 1,
            minHeight: rowHeight,
            justifyContent: "center",
          }}
        >
          <View style={{ height: THUMB, width: "100%" }}>
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: trackTop,
                height: TRACK_HEIGHT,
                borderRadius: 999,
                backgroundColor: trackRail,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${ratio * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: fillActive,
                }}
              />
            </View>

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: thumbLeft,
                top: 0,
                width: THUMB,
                height: THUMB,
                borderRadius: THUMB / 2,
                backgroundColor: colors.parchment,
                borderWidth: 1.5,
                borderColor: "#ffffff",
                shadowColor: "#1a160f",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
              }}
            />
          </View>
        </View>

        {variant === "font" ? (
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 22,
              color: colors.tan300,
              lineHeight: 26,
              opacity: 0.9,
            }}
            accessibilityElementsHidden
          >
            A
          </Text>
        ) : variant === "lineSpacing" ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              color: colors.tan300,
              lineHeight: 13,
              opacity: 0.9,
              width: 34,
              textAlign: "right",
            }}
            accessibilityElementsHidden
            numberOfLines={1}
          >
            Loose
          </Text>
        ) : null}
      </View>

      {variant !== "sheet" ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
            paddingHorizontal: 2,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              letterSpacing: 0.4,
              color: colors.tan200,
              opacity: 0.85,
            }}
          >
            {a11yPct(min)}%
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 10,
              letterSpacing: 0.4,
              color: colors.tan200,
              opacity: 0.85,
            }}
          >
            {a11yPct(max)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}
