import { Image } from "react-native";

const MENU_OPTIONS_ICON = require("../../assets/icons/menu-options-svgrepo-com.png");

/** Filter / view options control (from `menu-options-svgrepo-com.svg`). */
export function MenuOptionsIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 22;
  const color = props.color ?? "#6b5a43";

  return (
    <Image
      source={MENU_OPTIONS_ICON}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
