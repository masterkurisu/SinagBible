import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  PanGestureHandler,
  State,
  TouchableOpacity,
  type PanGestureHandlerGestureEvent,
  type HandlerStateChangeEvent,
} from "react-native-gesture-handler";
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
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const baseRef = useRef(0);
  const lastVXRef = useRef(0);
  const liveXRef = useRef(0);

  const hardResetPosition = useCallback(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    liveXRef.current = 0;
    baseRef.current = 0;
  }, [translateX]);

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

  const favoriteOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-MAX_DRAG, -36, 0],
        outputRange: [1, 0.45, 0],
        extrapolate: "clamp",
      }),
    [translateX],
  );
  const favoriteScale = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-MAX_DRAG, 0],
        outputRange: [1.14, 0.86],
        extrapolate: "clamp",
      }),
    [translateX],
  );
  const deleteOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, 36, MAX_DRAG],
        outputRange: [0, 0.45, 1],
        extrapolate: "clamp",
      }),
    [translateX],
  );
  const deleteScale = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [0, MAX_DRAG],
        outputRange: [0.86, 1.14],
        extrapolate: "clamp",
      }),
    [translateX],
  );

  const onGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (disabled) return;
      const { translationX, velocityX } = e.nativeEvent;
      lastVXRef.current = velocityX;
      const next = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, baseRef.current + translationX));
      liveXRef.current = next;
      translateX.setValue(next);
    },
    [disabled, translateX],
  );

  const onHandlerStateChange = useCallback(
    (e: HandlerStateChangeEvent) => {
      const { state } = e.nativeEvent;

      if (state === State.BEGAN) {
        translateX.stopAnimation((v) => {
          baseRef.current = v;
          liveXRef.current = v;
        });
        return;
      }

      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        translateX.stopAnimation();
        const x = liveXRef.current;
        const vx = lastVXRef.current;
        const shouldFavorite = x <= -THRESHOLD || (vx < -VELOCITY_TRIGGER && x < -VELOCITY_OFFSET);
        const shouldDelete = x >= THRESHOLD || (vx > VELOCITY_TRIGGER && x > VELOCITY_OFFSET);

        if (shouldFavorite) {
          hapticMediumImpact();
          onSwipeFavorite();
        } else if (shouldDelete) {
          hapticWarning();
          onSwipeDelete();
        }

        baseRef.current = 0;

        Animated.spring(translateX, {
          toValue: 0,
          friction: 8,
          tension: 210,
          useNativeDriver: false,
        }).start(() => {
          translateX.setValue(0);
          liveXRef.current = 0;
          baseRef.current = 0;
        });
      }
    },
    [onSwipeDelete, onSwipeFavorite, translateX],
  );

  return (
    <View style={[styles.shell, shellStyle]}>
      <View style={styles.underlay} pointerEvents="none">
        <View style={styles.laneNeutral}>
          <Animated.View
            style={[
              styles.iconPill,
              styles.iconPillDelete,
              { opacity: deleteOpacity, transform: [{ scale: deleteScale }] },
            ]}
          >
            <JournalSwipeTrashIcon size={30} stroke={SWIPE_TRASH_INK} strokeWidth={1.75} />
          </Animated.View>
        </View>
        <View style={[styles.laneNeutral, styles.laneRight]}>
          <Animated.View
            style={[
              styles.iconPill,
              styles.iconPillFavorite,
              { opacity: favoriteOpacity, transform: [{ scale: favoriteScale }] },
            ]}
          >
            <JournalSwipeHeartIcon size={30} stroke={SWIPE_HEART_INK} strokeWidth={2} />
          </Animated.View>
        </View>
      </View>

      <PanGestureHandler
        enabled={!disabled}
        activeOffsetX={[-12, 12]}
        failOffsetY={[-24, 24]}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          collapsable={false}
          style={[styles.floatingCard, cardStyle, { transform: [{ translateX }] }]}
        >
          <TouchableOpacity
            activeOpacity={0.96}
            disabled={disabled}
            onPress={onPress}
            accessibilityRole="button"
          >
            {children}
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
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
  /** User palette as fill so icons read on the neutral strip */
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
});
