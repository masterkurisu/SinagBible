import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { YvpFootnoteBody } from "@sinag-bible/types";

export type ReaderYvpFootnoteSheetProps = {
  visible: boolean;
  footnote: YvpFootnoteBody | null;
  onClose: () => void;
  backgroundColor: string;
  textColor: string;
};

export function ReaderYvpFootnoteSheet({
  visible,
  footnote,
  onClose,
  backgroundColor,
  textColor,
}: ReaderYvpFootnoteSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor }]} onPress={() => {}}>
          {footnote ? (
            <>
              <Text style={[styles.label, { color: textColor }]}>{footnote.label}</Text>
              <Text style={[styles.body, { color: textColor }]} selectable>
                {footnote.body}
              </Text>
            </>
          ) : null}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeLabel, { color: textColor }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 10,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  closeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
