import { useEffect, useLayoutEffect } from "react";
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  FADE_THROUGH_INCOMING_START,
  FADE_THROUGH_OUTGOING_END,
  useContainerTransformInternals,
} from "@/src/components/m3/ContainerTransform";

/** Renders the morph overlay — mount once as a sibling to navigation content. */
export function ContainerTransformHost() {
  const { isOpen, session, progress, scrimOpacity, close } = useContainerTransformInternals();

  const morphActive = useSharedValue(0);
  const morphSkip = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);
  const startR = useSharedValue(0);
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const targetW = useSharedValue(0);
  const targetH = useSharedValue(0);
  const targetR = useSharedValue(0);

  useLayoutEffect(() => {
    if (!session) {
      morphActive.value = 0;
      return;
    }
    morphActive.value = 1;
    morphSkip.value = session.skipMorph ? 1 : 0;
    startX.value = session.startBounds.x;
    startY.value = session.startBounds.y;
    startW.value = session.startBounds.width;
    startH.value = session.startBounds.height;
    startR.value = session.startBounds.borderRadius;
    targetX.value = session.targetBounds.x;
    targetY.value = session.targetBounds.y;
    targetW.value = session.targetBounds.width;
    targetH.value = session.targetBounds.height;
    targetR.value = session.targetBounds.borderRadius;
  }, [
    morphActive,
    morphSkip,
    session,
    startH,
    startR,
    startW,
    startX,
    startY,
    targetH,
    targetR,
    targetW,
    targetX,
    targetY,
  ]);

  useEffect(() => {
    if (!isOpen || !session?.scrimEnabled) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close, isOpen, session?.scrimEnabled]);

  const shellStyle = useAnimatedStyle(() => {
    "worklet";
    if (morphActive.value === 0) {
      return { opacity: 0 };
    }
    const p = progress.value;
    if (morphSkip.value === 1) {
      return {
        position: "absolute" as const,
        left: targetX.value,
        top: targetY.value,
        width: targetW.value,
        height: targetH.value,
        borderRadius: targetR.value,
        overflow: "hidden" as const,
      };
    }
    return {
      position: "absolute" as const,
      left: interpolate(p, [0, 1], [startX.value, targetX.value], Extrapolation.CLAMP),
      top: interpolate(p, [0, 1], [startY.value, targetY.value], Extrapolation.CLAMP),
      width: interpolate(p, [0, 1], [startW.value, targetW.value], Extrapolation.CLAMP),
      height: interpolate(p, [0, 1], [startH.value, targetH.value], Extrapolation.CLAMP),
      borderRadius: interpolate(p, [0, 1], [startR.value, targetR.value], Extrapolation.CLAMP),
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

  const passThroughTouches = !session.scrimEnabled;
  const morphShell = (
    <Reanimated.View pointerEvents="none" style={shellStyle}>
      {session.renderSource ? (
        <Reanimated.View style={[StyleSheet.absoluteFill, outgoingStyle]} pointerEvents="none">
          {session.renderSource}
        </Reanimated.View>
      ) : null}
      <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, incomingStyle]}>
        {session.renderExpanded}
      </Reanimated.View>
    </Reanimated.View>
  );

  if (passThroughTouches) {
    return (
      <View style={styles.passThroughHost} pointerEvents="none">
        {morphShell}
      </View>
    );
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
        {morphShell}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  passThroughHost: {
    ...StyleSheet.absoluteFillObject,
    ...Platform.select({
      android: { elevation: 9999 },
      default: { zIndex: 9999 },
    }),
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },
});
