import { Path, Svg } from "react-native-svg";

/** From `font-svgrepo-com.svg` — “Aa” style font control. viewBox 0 0 24 24. */
export function ReaderFontSettingsIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 20;
  const color = props.color ?? "#2c2416";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M13 18L8 6L3 18M11 14H5M21 18V15M21 15V12M21 15C21 16.6569 19.6569 18 18 18C16.3431 18 15 16.6569 15 15C15 13.3431 16.3431 12 18 12C19.6569 12 21 13.3431 21 15Z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
