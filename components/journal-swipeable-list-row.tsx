import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, type NativeGesture } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { ReactNode } from "react";
import {
  JournalSwipeHeartIcon,
  JournalSwipeTrashIcon,
  SWIPE_HEART_INK,
  SWIPE_HEART_STROKE,
  SWIPE_TRASH_INK,
  SWIPE_TRASH_STROKE,
} from "@/components/journal-swipe-icons";
import { hapticMediumImpact, hapticWarning } from "@/lib/haptics";

const MAX_DRAG = 110;
const THRESHOLD = 56;
const VELOCITY_TRIGGER = 380;
const VELOCITY_OFFSET = 24;
const PAN_ACTIVATE_PX = 12;
const PAN_FAIL_VERTICAL_PX = 24;
const TAP_SLOP_PX = 10;
const PAN_SPRING = { damping: 12, stiffness: 210 };

type Props = {
  children: ReactNode;
  onPress: () => void;
  onSwipeFavorite: () => void;
  onSwipeDelete: () => void;
  disabled?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  /** Merged onto the outer clip shell (e.g. square left edge for favorite tiles). */
  shellStyle?: StyleProp<ViewStyle>;
  /** When the list re-binds this row to another entry, force translation back to 0 */
  rowKey?: string;
  /** FlatList scroll native gesture — required on Android for bidirectional row pans. */
  listScrollGesture?: NativeGesture;
};

export const JournalSwipeableListRow = memo(function JournalSwipeableListRow({
  children,
  onPress,
  onSwipeFavorite,
  onSwipeDelete,
  disabled,
  cardStyle,
  shellStyle,
  rowKey,
  listScrollGesture,
}: Props) {
  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const panActive = useSharedValue(false);

  const hardResetPosition = useCallback(() => {
    translateX.value = 0;
    dragStartX.value = 0;
    panActive.value = false;
  }, [dragStartX, panActive, translateX]);

  const prevRowKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (rowKey === undefined) return;
    const prev = prevRowKeyRef.current;
    if (prev === rowKey) return;
    prevRowKeyRef.current = rowKey;
    if (prev !== undefined) {
      hardResetPosition();
    }
  }, [rowKey, hardResetPosition]);

  const commitPanEnd = useCallback(
    (x: number, vx: number) => {
      const shouldFavorite = x <= -THRESHOLD || (vx < -VELOCITY_TRIGGER && x < -VELOCITY_OFFSET);
      const shouldDelete = x >= THRESHOLD || (vx > VELOCITY_TRIGGER && x > VELOCITY_OFFSET);

      if (shouldFavorite) {
        hapticMediumImpact();
        onSwipeFavorite();
      } else if (shouldDelete) {
        hapticWarning();
        onSwipeDelete();
      }
    },
    [onSwipeDelete, onSwipeFavorite],
  );

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress();
  }, [disabled, onPress]);

  const gesture = useMemo(() => {
    let pan = Gesture.Pan()
      .enabled(!disabled)
      .manualActivation(true)
      .onTouchesDown((event) => {
        const touch = event.allTouches[0];
        if (!touch) return;
        touchStartX.value = touch.absoluteX;
        touchStartY.value = touch.absoluteY;
        panActive.value = false;
        dragStartX.value = translateX.value;
      })
      .onTouchesMove((event, state) => {
        if (panActive.value) return;
        const touch = event.allTouches[0];
        if (!touch) return;

        const dx = touch.absoluteX - touchStartX.value;
        const dy = touch.absoluteY - touchStartY.value;

        if (Math.abs(dy) > PAN_FAIL_VERTICAL_PX && Math.abs(dy) > Math.abs(dx)) {
          state.fail();
          return;
        }

        if (Math.abs(dx) > PAN_ACTIVATE_PX && Math.abs(dx) >= Math.abs(dy)) {
          panActive.value = true;
          state.activate();
        }
      })
      .onTouchesUp((event) => {
        if (panActive.value) return;
        const touch = event.allTouches[0];
        if (!touch) return;

        const dx = Math.abs(touch.absoluteX - touchStartX.value);
        const dy = Math.abs(touch.absoluteY - touchStartY.value);
        if (dx < TAP_SLOP_PX && dy < TAP_SLOP_PX) {
          runOnJS(handlePress)();
        }
      })
      .onUpdate((event) => {
        const next = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dragStartX.value + event.translationX));
        translateX.value = next;
      })
      .onEnd((event) => {
        const x = translateX.value;
        runOnJS(commitPanEnd)(x, event.velocityX);
        translateX.value = withSpring(0, PAN_SPRING);
        dragStartX.value = 0;
        panActive.value = false;
      })
      .onFinalize(() => {
        panActive.value = false;
      });

    if (listScrollGesture) {
      pan = pan.simultaneousWithExternalGesture(listScrollGesture);
    }

    return pan;
  }, [
    commitPanEnd,
    disabled,
    dragStartX,
    handlePress,
    listScrollGesture,
    panActive,
    touchStartX,
    touchStartY,
    translateX,
  ]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 36, MAX_DRAG], [0, 0.45, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(translateX.value, [0, MAX_DRAG], [0.86, 1.14], Extrapolation.CLAMP),
      },
    ],
  }));

  const favoriteIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-MAX_DRAG, -36, 0], [1, 0.45, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(translateX.value, [-MAX_DRAG, 0], [1.14, 0.86], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View style={[styles.shell, shellStyle]}>
      <View style={styles.underlay} pointerEvents="none">
        <View style={styles.laneNeutral}>
          <Animated.View style={[styles.iconPill, styles.iconPillDelete, deleteIconStyle]}>
            <JournalSwipeTrashIcon size={30} stroke={SWIPE_TRASH_INK} strokeWidth={1.75} />
          </Animated.View>
        </View>
        <View style={[styles.laneNeutral, styles.laneRight]}>
          <Animated.View style={[styles.iconPill, styles.iconPillFavorite, favoriteIconStyle]}>
            <JournalSwipeHeartIcon size={30} stroke={SWIPE_HEART_INK} strokeWidth={2} />
          </Animated.View>
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          collapsable={false}
          style={[styles.floatingCard, cardStyle, cardAnimatedStyle]}
        >
          <View
            style={styles.cardContent}
            accessibilityRole="button"
            importantForAccessibility={Platform.OS === "android" ? "yes" : undefined}
          >
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  underlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
  },
  laneNeutral: {
    flex: 1,
    backgroundColor: "#f2efe8",
    justifyContent: "center",
    paddingLeft: 16,
  },
  laneRight: {
    alignItems: "flex-end",
    paddingLeft: 0,
    paddingRight: 16,
  },
  iconPill: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  iconPillDelete: {
    backgroundColor: SWIPE_TRASH_STROKE,
  },
  iconPillFavorite: {
    backgroundColor: SWIPE_HEART_STROKE,
  },
  floatingCard: {
    backgroundColor: "transparent",
  },
  cardContent: {
    flexGrow: 1,
  },
});
