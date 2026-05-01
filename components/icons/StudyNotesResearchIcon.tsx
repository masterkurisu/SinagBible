import { Path, Svg } from "react-native-svg";

/** Research icon used for the Study Notes menu entry. viewBox 0 0 24 24. */
export function StudyNotesResearchIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 20;
  const color = props.color ?? "#ffffff";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M7 17V12M11 17V15M21 15L18.17 12.17M13 10A3 3 0 1 0 16 7A3 3 0 0 0 13 10Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 17V20A1 1 0 0 1 16 21H4A1 1 0 0 1 3 20V4A1 1 0 0 1 4 3H16"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
