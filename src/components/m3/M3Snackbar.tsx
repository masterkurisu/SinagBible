import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  READER_M3_INVERSE_ON_SURFACE,
  READER_M3_INVERSE_PRIMARY,
  READER_M3_INVERSE_SURFACE,
} from "@/src/features/reader/readerSettingsPanelChrome";

const DEFAULT_DURATION_MS = 4000;
const ENTER_MS = 200;
const EXIT_MS = 150;
const SNACKBAR_ICON_SIZE_PX = 24;
const SNACKBAR_MAX_WIDTH_PX = 560;

export type M3SnackbarProps = {
  message: string;
  visible: boolean;
  onDismiss?: () => void;
  /** Distance from the bottom of the screen (safe area + margin). */
  bottomInset?: number;
  durationMs?: number;
  /** Optional leading icon — M3 snackbars may show a 24dp icon before the message. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Optional text action (e.g. Dismiss). Auto-dismiss timer still runs unless tapped. */
  actionLabel?: string;
  onAction?: () => void;
};

/** M3 floating snackbar — inverse surface, optional icon + action, bottom-aligned, auto-dismiss. */
export function M3Snackbar({
  message,
  visible,
  onDismiss,
  bottomInset = 16,
  durationMs = DEFAULT_DURATION_MS,
  icon,
  actionLabel,
  onAction,
}: M3SnackbarProps) {
  const { width: screenW } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const barMaxWidth = Math.min(screenW - 32, SNACKBAR_MAX_WIDTH_PX);

  const runExit = (finishedCallback?: () => void) => {
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
      if (finished) finishedCallback?.();
    });
  };

  const handleActionPress = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    runExit(() => {
      onAction?.();
      onDismiss?.();
    });
  };

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
      runExit(() => onDismiss?.());
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
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.host]}>
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.bar,
            {
              bottom: bottomInset,
              maxWidth: barMaxWidth,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          {icon ? (
            <MaterialIcons
              name={icon}
              size={SNACKBAR_ICON_SIZE_PX}
              color={READER_M3_INVERSE_ON_SURFACE}
              style={styles.leadingIcon}
            />
          ) : null}
          <Text style={[styles.label, icon ? styles.labelWithIcon : null]} numberOfLines={3}>
            {message}
          </Text>
          {actionLabel ? (
            <Pressable
              onPress={handleActionPress}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              hitSlop={8}
              style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null]}
            >
              <Text style={styles.actionLabel}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
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
    alignSelf: "center",
    width: "100%",
    minHeight: 48,
    borderRadius: 4,
    backgroundColor: READER_M3_INVERSE_SURFACE,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
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
  leadingIcon: {
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
    color: READER_M3_INVERSE_ON_SURFACE,
  },
  labelWithIcon: {
    paddingRight: 8,
  },
  actionButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    marginLeft: 4,
  },
  actionButtonPressed: {
    opacity: 0.72,
  },
  actionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: READER_M3_INVERSE_PRIMARY,
  },
});
