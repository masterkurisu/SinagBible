import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import {
  M3ContainedLoadingIndicator,
  M3_LOADING_LABEL_COLOR,
} from "@/components/m3-contained-loading-indicator";
import { READER_M3_ON_SURFACE } from "@/src/features/reader/readerSettingsPanelChrome";

const DONE_VISIBLE_MS = 520;

export type ReaderTranslationLoadingPhase = "idle" | "loading" | "done";

type ReaderTranslationLoadingOverlayProps = {
  phase: ReaderTranslationLoadingPhase;
  accentColor: string;
  surfaceColor: string;
};

/** Loading overlay only while the active translation is changing — not on chapter navigation. */
export function useReaderTranslationLoadingPhase(isTranslationSwitching: boolean) {
  const [phase, setPhase] = useState<ReaderTranslationLoadingPhase>("idle");

  useEffect(() => {
    if (isTranslationSwitching) {
      setPhase("loading");
      return;
    }

    setPhase((current) => (current === "loading" ? "done" : current));
  }, [isTranslationSwitching]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("idle"), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return phase;
}

export function ReaderTranslationLoadingOverlay({
  phase,
  accentColor,
  surfaceColor,
}: ReaderTranslationLoadingOverlayProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(phase === "idle" ? 0 : 1, {
      duration: phase === "idle" ? 180 : 220,
      easing: Easing.out(Easing.quad),
    });
  }, [opacity, phase]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (phase === "idle") return null;

  const label = phase === "done" ? "Done!" : "Loading new translation";

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: surfaceColor, zIndex: 40 }, animatedStyle]}
    >
      <View style={styles.center}>
        {phase === "loading" ? (
          <M3ContainedLoadingIndicator size={52} color={accentColor} />
        ) : (
          <View style={[styles.doneBadge, { backgroundColor: `${accentColor}22` }]}>
            <Text style={[styles.doneText, { color: accentColor }]}>✓</Text>
          </View>
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    lineHeight: 22,
    color: M3_LOADING_LABEL_COLOR,
    textAlign: "center",
  },
  doneBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 32,
    lineHeight: 36,
  },
});

export const READER_TRANSLATION_LOADING_ON_SURFACE = READER_M3_ON_SURFACE;
