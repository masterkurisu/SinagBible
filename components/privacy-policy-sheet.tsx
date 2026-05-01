import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import { readAsStringAsync, EncodingType } from "expo-file-system/legacy";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  TouchableOpacity as GestureHandlerTouchableOpacity,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import Markdown from "react-native-markdown-display";
import { colors } from "@sinag-bible/ui";

/**
 * Bundled from repo root `privacy_policy.md` (see `metro.config.js` `.md` asset handling).
 *
 * Wire up later, for example:
 * `const [open, setOpen] = useState(false);`
 * `<PrivacyPolicySheet visible={open} onClose={() => setOpen(false)} />`
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset module
const privacyPolicyMdModule = require("../../../privacy_policy.md") as number;

const UI_EMPHASIS_FONT = "Inter_500Medium" as const;

const markdownStyles = {
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.brown800,
    lineHeight: 22,
  },
  paragraph: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.brown800,
    lineHeight: 22,
    marginTop: 0,
    marginBottom: 12,
  },
  heading1: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: colors.brown800,
    marginBottom: 8,
  },
  heading2: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.brown800,
    marginTop: 20,
    marginBottom: 6,
  },
  heading3: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.brown800,
    marginTop: 16,
    marginBottom: 6,
  },
  strong: {
    fontFamily: "Inter_600SemiBold",
  },
  hr: {
    backgroundColor: colors.tan100,
    height: 1,
    marginVertical: 16,
  },
  bullet_list: {
    marginBottom: 8,
  },
  ordered_list: {
    marginBottom: 8,
  },
} as const;

async function readBundledPrivacyPolicy(): Promise<string> {
  const asset = Asset.fromModule(privacyPolicyMdModule);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error("Privacy policy asset missing");
  // Dev: Metro may still expose an http(s) asset URL; legacy read only supports file:// etc.
  if (/^https?:\/\//i.test(uri)) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Privacy policy fetch failed (${res.status})`);
    return await res.text();
  }
  return readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
}

export type PrivacyPolicySheetProps = {
  visible: boolean;
  onClose: () => void;
};

const DISMISS_DISTANCE_THRESHOLD_PX = 90;
const DISMISS_VELOCITY_THRESHOLD = 520;

export function PrivacyPolicySheet({ visible, onClose }: PrivacyPolicySheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetClosingRef = useRef(false);
  const sheetDragStartYRef = useRef(0);

  const animateCloseSheet = useCallback(
    (velocityY = 0, draggedY = 0) => {
      if (sheetClosingRef.current) return;
      sheetClosingRef.current = true;
      const h = Dimensions.get("window").height;
      const targetY = h + 56;
      const vel = Math.max(0, velocityY);
      const duration = Math.max(170, Math.min(340, Math.round(300 - Math.min(1.85, vel) * 88)));
      sheetTranslateY.stopAnimation();
      const clamped = Math.max(0, draggedY);
      if (clamped > 0) {
        sheetTranslateY.setValue(clamped);
      }
      Animated.timing(sheetTranslateY, {
        toValue: targetY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        sheetClosingRef.current = false;
        sheetTranslateY.setValue(0);
        onClose();
      });
    },
    [onClose, sheetTranslateY],
  );

  const onSheetDismissGestureEvent = useCallback(
    (e: PanGestureHandlerGestureEvent) => {
      if (sheetClosingRef.current) return;
      const ty = e.nativeEvent.translationY;
      sheetTranslateY.setValue(Math.max(0, sheetDragStartYRef.current + ty));
    },
    [sheetTranslateY],
  );

  const onSheetDismissGestureStateChange = useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      const { state, oldState, velocityY, translationY } = e.nativeEvent;
      if (state === State.ACTIVE && oldState !== State.ACTIVE) {
        sheetTranslateY.stopAnimation((value: number) => {
          sheetDragStartYRef.current = value;
        });
      }
      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        if (sheetClosingRef.current) return;
        const ty = translationY ?? 0;
        const y = Math.max(0, sheetDragStartYRef.current + ty);
        const vyPxPerS = Math.abs(velocityY ?? 0);
        const velForCloseAnim = Math.min(1.85, vyPxPerS / 520);
        if (y > DISMISS_DISTANCE_THRESHOLD_PX || vyPxPerS > DISMISS_VELOCITY_THRESHOLD) {
          animateCloseSheet(velForCloseAnim, y);
          return;
        }
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          velocity: Math.max(0, (velocityY ?? 0) / 1000),
          friction: 9,
          tension: 75,
          useNativeDriver: true,
        }).start();
      }
    },
    [animateCloseSheet, sheetTranslateY],
  );

  useEffect(() => {
    if (!visible) return;
    sheetClosingRef.current = false;
    sheetTranslateY.stopAnimation();
    sheetTranslateY.setValue(0);
  }, [visible, sheetTranslateY]);

  useEffect(() => {
    if (!visible || markdown !== null) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const text = await readBundledPrivacyPolicy();
        if (!cancelled) setMarkdown(text);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, markdown]);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setLoading(true);
    void (async () => {
      try {
        const text = await readBundledPrivacyPolicy();
        setMarkdown(text);
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cardMaxH = windowH * 0.9;
  const bottomPad = Math.max(insets.bottom, 12) + 12;

  const onBackdropPress = useCallback(() => {
    if (sheetClosingRef.current) return;
    animateCloseSheet(0, 0);
  }, [animateCloseSheet]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onBackdropPress}
      accessibilityViewIsModal
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onBackdropPress}
          accessibilityLabel="Dismiss privacy policy"
        />
        <View
          pointerEvents="box-none"
          style={[styles.sheetWrap, { paddingBottom: bottomPad, paddingTop: insets.top + 8 }]}
        >
          <Animated.View style={[styles.card, { maxHeight: cardMaxH }, { transform: [{ translateY: sheetTranslateY }] }]}>
            <PanGestureHandler
              onGestureEvent={onSheetDismissGestureEvent}
              onHandlerStateChange={onSheetDismissGestureStateChange}
              activeOffsetY={8}
              failOffsetX={[-32, 32]}
            >
              <GestureHandlerTouchableOpacity
                activeOpacity={1}
                accessibilityRole="button"
                accessibilityLabel="Drag down to close privacy policy"
                accessibilityHint="Swipe down on the handle to dismiss"
                style={styles.handleRow}
              >
                <View pointerEvents="none" style={styles.handlePill} />
              </GestureHandlerTouchableOpacity>
            </PanGestureHandler>
            {loading && markdown === null ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.tan200} />
              </View>
            ) : loadError ? (
              <View style={styles.centerBox}>
                <Text style={styles.errorText}>Could not load the privacy policy.</Text>
                <Pressable onPress={retryLoad} style={styles.retryBtn}>
                  <Text style={styles.retryLabel}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <Markdown style={markdownStyles}>{markdown ?? ""}</Markdown>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,36,22,0.52)" },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    backgroundColor: colors.parchment,
    overflow: "hidden",
    shadowColor: "#2c2416",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  handleRow: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: colors.parchment,
  },
  handlePill: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  centerBox: {
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: colors.brown800,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.parchmentDeep,
    borderWidth: 1,
    borderColor: colors.borderSolid,
  },
  retryLabel: {
    fontFamily: UI_EMPHASIS_FONT,
    fontSize: 14,
    color: colors.brown800,
  },
});
