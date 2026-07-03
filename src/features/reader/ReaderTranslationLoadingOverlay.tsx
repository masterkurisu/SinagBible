import { useEffect, useState, type RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import {
  M3ContainedLoadingIndicator,
  M3_LOADING_LABEL_COLOR,
} from "@/components/m3-contained-loading-indicator";
import { READER_M3_ON_SURFACE } from "@/src/features/reader/readerSettingsPanelChrome";

export const READER_CHAPTER_TRANSITION_DONE_VISIBLE_MS = 520;

export type ReaderTranslationLoadingPhase = "idle" | "loading" | "done";

type ReaderTranslationLoadingOverlayProps = {
  phase: ReaderTranslationLoadingPhase;
  accentColor: string;
  surfaceColor: string;
  loadingLabel?: string;
  doneLabel?: string;
  /** When false, the loading phase shows only the spinner (no caption). */
  showLoadingLabel?: boolean;
};

type ReaderChapterTransitionPhaseOptions = {
  /** When true on transition end, skip the success "Done!" phase and return to idle. */
  skipDoneRef?: RefObject<boolean>;
};

/** Loading overlay while chapter content is transitioning (translation switch or data import). */
export function useReaderChapterTransitionPhase(
  isTransitioning: boolean,
  options?: ReaderChapterTransitionPhaseOptions,
) {
  const [phase, setPhase] = useState<ReaderTranslationLoadingPhase>("idle");
  const skipDoneRef = options?.skipDoneRef;

  useEffect(() => {
    if (isTransitioning) {
      if (skipDoneRef) {
        skipDoneRef.current = false;
      }
      setPhase("loading");
      return;
    }

    setPhase((current) => {
      if (current !== "loading") {
        return current;
      }
      if (skipDoneRef?.current) {
        skipDoneRef.current = false;
        return "idle";
      }
      return "done";
    });
  }, [isTransitioning, skipDoneRef]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("idle"), READER_CHAPTER_TRANSITION_DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return phase;
}

/** @deprecated Use {@link useReaderChapterTransitionPhase}. */
export const useReaderTranslationLoadingPhase = useReaderChapterTransitionPhase;

export function ReaderTranslationLoadingOverlay({
  phase,
  accentColor,
  surfaceColor,
  loadingLabel = "Loading new translation",
  doneLabel = "Done!",
  showLoadingLabel = true,
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

  const label = phase === "done" ? doneLabel : loadingLabel;
  const showLabel = phase === "done" || showLoadingLabel;

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
        {showLabel && label ? <Text style={styles.label}>{label}</Text> : null}
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
