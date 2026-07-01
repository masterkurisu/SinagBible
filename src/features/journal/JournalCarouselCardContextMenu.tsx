import { memo, useCallback, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import type { CarouselDisplayVerse } from "@/lib/journal-carousel-verses";
import { hapticLightImpact } from "@/lib/haptics";

const MENU_RADIUS_PX = 16;
const MENU_ITEM_RADIUS_PX = 12;
const MENU_ITEM_HEIGHT_PX = 48;
const MENU_ICON_SIZE_PX = 24;

export type JournalCarouselCardContextMenuProps = {
  visible: boolean;
  item: CarouselDisplayVerse | null;
  busy: boolean;
  bundle: MobileAppThemeBundle;
  onClose: () => void;
  onShare: () => void;
  onSaveImage: () => void;
  onCopyImage: () => void;
  onRemoveFavorite?: () => void;
};

type MenuRowProps = {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  onPress: () => void;
  textColor: string;
  iconColor: string;
  disabled?: boolean;
  destructive?: boolean;
};

function MenuRow({
  icon,
  label,
  onPress,
  textColor,
  iconColor,
  disabled = false,
  destructive = false,
}: MenuRowProps) {
  const tint = destructive ? "#B3261E" : textColor;
  const iconTint = destructive ? "#B3261E" : iconColor;

  return (
    <TouchableOpacity
      onPress={() => {
        if (disabled) return;
        hapticLightImpact();
        onPress();
      }}
      disabled={disabled}
      activeOpacity={0.65}
      style={[styles.menuRow, disabled ? styles.menuRowDisabled : null]}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <MaterialIcons name={icon} size={MENU_ICON_SIZE_PX} color={iconTint} />
      <Text style={[styles.menuRowLabel, { color: tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const JournalCarouselCardContextMenu = memo(function JournalCarouselCardContextMenu({
  visible,
  item,
  busy,
  bundle,
  onClose,
  onShare,
  onSaveImage,
  onCopyImage,
  onRemoveFavorite,
}: JournalCarouselCardContextMenuProps) {
  const { width: screenW } = useWindowDimensions();
  const colors = bundle.ui;
  const j = bundle.journal;

  const menuWidth = Math.min(280, Math.max(220, screenW - 48));
  const onSurface = colors.brown800;
  const onSurfaceVariant = colors.brown600;

  const handleDismiss = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  if (!item) return null;

  const showRemove = item.isUserFavorite && !item.isDailyVerse && onRemoveFavorite;
  const shareIcon = Platform.OS === "ios" ? "ios-share" : "share";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss carousel options"
        />

        <View
          style={[
            styles.menuCard,
            {
              width: menuWidth,
              backgroundColor: j.panelBackground,
              shadowColor: colors.brown800,
            },
          ]}
          accessibilityRole="menu"
          accessibilityLabel={`Options for ${item.reference}`}
        >
          <View style={styles.menuHeader}>
            <Text style={[styles.menuHeaderLabel, { color: onSurfaceVariant }]}>Verse</Text>
            <Text style={[styles.menuHeaderTitle, { color: onSurface }]} numberOfLines={2}>
              {item.reference}
            </Text>
          </View>

          <View style={[styles.menuDivider, { backgroundColor: j.panelBorder }]} />

          <MenuRow
            icon={shareIcon}
            label="Share"
            onPress={onShare}
            disabled={busy}
            textColor={onSurface}
            iconColor={onSurfaceVariant}
          />
          <MenuRow
            icon="download"
            label="Save image"
            onPress={onSaveImage}
            disabled={busy}
            textColor={onSurface}
            iconColor={onSurfaceVariant}
          />
          <MenuRow
            icon="content-copy"
            label="Copy image"
            onPress={onCopyImage}
            disabled={busy}
            textColor={onSurface}
            iconColor={onSurfaceVariant}
          />

          {showRemove ? (
            <>
              <View style={[styles.menuDivider, { backgroundColor: j.panelBorder, marginTop: 4 }]} />
              <MenuRow
                icon="bookmark-remove"
                label="Remove from carousel"
                onPress={onRemoveFavorite}
                disabled={busy}
                destructive
                textColor={onSurface}
                iconColor={onSurfaceVariant}
              />
            </>
          ) : null}

          {busy ? (
            <View style={[styles.busyOverlay, { backgroundColor: `${j.panelBackground}E6` }]}>
              <ActivityIndicator size="small" color={onSurfaceVariant} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(44,36,22,0.38)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  menuCard: {
    borderRadius: MENU_RADIUS_PX,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  menuHeaderLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  menuHeaderTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    marginBottom: 4,
  },
  menuRow: {
    height: MENU_ITEM_HEIGHT_PX,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: MENU_ITEM_RADIUS_PX,
  },
  menuRowDisabled: {
    opacity: 0.38,
  },
  menuRowLabel: {
    marginLeft: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: MENU_RADIUS_PX,
    alignItems: "center",
    justifyContent: "center",
  },
});
