import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
  READER_M3_APP_BAR_ICON_BUTTON_PX,
} from "@/src/features/reader/readerSettingsPanelChrome";

export type JournalDetailAndroidAppBarProps = {
  topInsetPx: number;
  backgroundColor: string;
  insets: { left: number; right: number };
  leadingAction: ReactNode;
  trailingActions: ReactNode;
};

/** M3 small top app bar — back on the leading edge, export actions on the trailing edge. */
export function JournalDetailAndroidAppBar({
  topInsetPx,
  backgroundColor,
  insets,
  leadingAction,
  trailingActions,
}: JournalDetailAndroidAppBarProps) {
  if (Platform.OS !== "android") return null;

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: topInsetPx, backgroundColor }}>
        <View
          style={[
            styles.barRow,
            {
              height: READER_M3_APP_BAR_CONTENT_HEIGHT_PX,
              paddingLeft: Math.max(insets.left, 4),
              paddingRight: Math.max(insets.right, 4),
            },
          ]}
        >
          <View style={styles.leading}>{leadingAction}</View>
          <View style={styles.trailing}>{trailingActions}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leading: {
    width: READER_M3_APP_BAR_ICON_BUTTON_PX,
    height: READER_M3_APP_BAR_ICON_BUTTON_PX,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
});
