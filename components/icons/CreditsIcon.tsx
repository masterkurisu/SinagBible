import { Circle, Line, Svg } from "react-native-svg";

/** Info-circle icon used for the Credits / About menu entry. viewBox 0 0 24 24. */
export function CreditsIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 20;
  const color = props.color ?? "#ffffff";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.5} fill="none" />
      <Line x1="12" y1="11" x2="12" y2="17" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx="12" cy="7.5" r="0.75" fill={color} stroke={color} strokeWidth={0.5} />
    </Svg>
  );
}
