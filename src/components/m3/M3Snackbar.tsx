import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import {
  READER_M3_INVERSE_ON_SURFACE,
  READER_M3_INVERSE_SURFACE,
} from "@/src/features/reader/readerSettingsPanelChrome";

const DEFAULT_DURATION_MS = 4000;
const ENTER_MS = 200;
const EXIT_MS = 150;

export type M3SnackbarProps = {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
  /** Distance from the bottom of the screen (safe area + margin). */
  bottomInset?: number;
  durationMs?: number;
};

/** M3 floating snackbar — inverse surface, bottom-aligned, auto-dismiss. */
export function M3Snackbar({
  message,
  visible,
  onDismiss,
  bottomInset = 16,
  durationMs = DEFAULT_DURATION_MS,
}: M3SnackbarProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    animRef.current?.stop();
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (!visible) {
      opacity.setValue(0);
      translateY.setValue(12);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(12);
    animRef.current = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animRef.current.start();

    dismissTimerRef.current = setTimeout(() => {
      animRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: EXIT_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: EXIT_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      animRef.current.start(({ finished }) => {
        if (finished) onDismiss?.();
      });
    }, durationMs);

    return () => {
      animRef.current?.stop();
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [visible, message, durationMs, onDismiss, opacity, translateY]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.host, { zIndex: 20 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bar,
          {
            bottom: bottomInset,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.label}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    minHeight: 48,
    borderRadius: 4,
    backgroundColor: READER_M3_INVERSE_SURFACE,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 4,
      },
    }),
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
    color: READER_M3_INVERSE_ON_SURFACE,
  },
});
