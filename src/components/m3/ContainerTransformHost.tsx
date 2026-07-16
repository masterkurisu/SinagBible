import { useEffect } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  FADE_THROUGH_INCOMING_START,
  FADE_THROUGH_OUTGOING_END,
  useContainerTransformInternals,
  type ContainerBounds,
} from "@/src/components/m3/ContainerTransform";

function interpolateBounds(
  progress: number,
  start: ContainerBounds,
  end: ContainerBounds,
  skipMorph: boolean,
): ContainerBounds {
  if (skipMorph) {
    return end;
  }
  return {
    x: interpolate(progress, [0, 1], [start.x, end.x], Extrapolation.CLAMP),
    y: interpolate(progress, [0, 1], [start.y, end.y], Extrapolation.CLAMP),
    width: interpolate(progress, [0, 1], [start.width, end.width], Extrapolation.CLAMP),
    height: interpolate(progress, [0, 1], [start.height, end.height], Extrapolation.CLAMP),
    borderRadius: interpolate(
      progress,
      [0, 1],
      [start.borderRadius, end.borderRadius],
      Extrapolation.CLAMP,
    ),
  };
}

/** Renders the morph overlay — mount once as a sibling to navigation content. */
export function ContainerTransformHost() {
  const { isOpen, session, progress, scrimOpacity, close, abortToFadeOut } =
    useContainerTransformInternals();

  useEffect(() => {
    if (!isOpen || !session) return;

    const intervalId = setInterval(() => {
      if (!session.sourceRef.current) {
        abortToFadeOut();
      }
    }, 100);

    return () => clearInterval(intervalId);
  }, [abortToFadeOut, isOpen, session]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close, isOpen]);

  const shellStyle = useAnimatedStyle(() => {
    if (!session) {
      return { opacity: 0 };
    }
    const bounds = interpolateBounds(
      progress.value,
      session.startBounds,
      session.targetBounds,
      session.skipMorph,
    );
    return {
      position: "absolute" as const,
      left: bounds.x,
      top: bounds.y,
      width: bounds.width,
      height: bounds.height,
      borderRadius: bounds.borderRadius,
      overflow: "hidden" as const,
    };
  });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, FADE_THROUGH_OUTGOING_END],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [FADE_THROUGH_INCOMING_START, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  if (!isOpen || !session) {
    return null;
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Reanimated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} />
        </Pressable>

        <Reanimated.View pointerEvents="box-none" style={shellStyle}>
          {session.renderSource ? (
            <Reanimated.View style={[StyleSheet.absoluteFill, outgoingStyle]} pointerEvents="none">
              {session.renderSource}
            </Reanimated.View>
          ) : null}
          <Reanimated.View style={[StyleSheet.absoluteFill, incomingStyle]}>
            {session.renderExpanded}
          </Reanimated.View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },
});
