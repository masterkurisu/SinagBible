import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@sinag-bible/ui";
import { TERMS_OF_SERVICE_URL } from "@/lib/legal-urls";

const BODY_FONT = "Inter_400Regular" as const;
const BODY_BOLD_FONT = "Inter_500Medium" as const;
const UI_FONT = "Inter_600SemiBold" as const;

export type TermsOfServiceSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function TermsOfServiceSheet({ visible, onClose }: TermsOfServiceSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const cardMaxH = windowH * 0.9;
  const bottomPad = Math.max(insets.bottom, 12) + 12;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      const h = Dimensions.get("window").height;
      slideAnim.setValue(h);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const h = Dimensions.get("window").height;
    Animated.timing(slideAnim, {
      toValue: h,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      closingRef.current = false;
      slideAnim.setValue(0);
      onClose();
    });
  }, [onClose, slideAnim]);

  const openTermsUrl = useCallback(() => {
    void (async () => {
      try {
        await Linking.openURL(TERMS_OF_SERVICE_URL);
      } catch {
        // ignore blocked URL-open failures
      }
    })();
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityLabel="Dismiss terms of service"
        />
        <View
          pointerEvents="box-none"
          style={[styles.sheetWrap, { paddingBottom: bottomPad, paddingTop: insets.top + 8 }]}
        >
          <Animated.View style={[styles.card, { maxHeight: cardMaxH, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.header}>
              <View style={styles.headerEdge} />
              <Text style={[styles.modalTitle, styles.modalTitleCentered]}>Terms of Use</Text>
              <View style={[styles.headerEdge, styles.headerEdgeEnd]}>
                <Pressable
                  onPress={handleClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close terms of service"
                >
                  <Ionicons name="close" size={24} color={colors.brown800} />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <Text style={styles.body}>
                By using Sinag Bible, you agree to our Terms of Use. Tap the link below to read the
                full terms.
              </Text>
              <Pressable
                onPress={openTermsUrl}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                accessibilityRole="link"
                accessibilityLabel="Open terms of use"
              >
                <Text style={styles.link}>Read full Terms of Use</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(44,36,22,0.52)",
  },
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: colors.parchment,
  },
  headerEdge: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEdgeEnd: {
    alignItems: "flex-end",
  },
  modalTitle: {
    fontFamily: UI_FONT,
    fontSize: 20,
    color: colors.brown800,
  },
  modalTitleCentered: {
    flex: 1,
    textAlign: "center",
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },
  body: {
    fontFamily: BODY_FONT,
    fontSize: 15,
    lineHeight: 24,
    color: colors.brown800,
  },
  link: {
    fontFamily: BODY_BOLD_FONT,
    fontSize: 15,
    color: colors.brown800,
    textDecorationLine: "underline",
  },
});
