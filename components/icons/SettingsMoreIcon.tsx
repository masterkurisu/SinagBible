import { Image } from "react-native";

const SETTINGS_MORE_ICON = require("../../assets/icons/more-alt.png");

/** Vertical ellipsis used for the reader settings More menu. */
export function SettingsMoreIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 26;
  const color = props.color ?? "#ffffff";

  return (
    <Image
      source={SETTINGS_MORE_ICON}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
