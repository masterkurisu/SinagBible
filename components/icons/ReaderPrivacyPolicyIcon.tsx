import { Path, Svg } from "react-native-svg";

/** Document icon (same paths as home `FeatureIconDoc`). viewBox 0 0 24 24. */
export function ReaderPrivacyPolicyIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 20;
  const color = props.color ?? "#ffffff";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M8 3H14L19 8V21H8C6.9 21 6 20.1 6 19V5C6 3.9 6.9 3 8 3Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M14 3V8H19" stroke={color} strokeWidth={1.5} />
      <Path d="M9 12H16" stroke={color} strokeWidth={1.5} />
      <Path d="M9 16H14" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}
