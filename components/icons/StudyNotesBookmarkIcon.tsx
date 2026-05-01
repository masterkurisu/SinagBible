import { Circle, Line, Path, Svg } from "react-native-svg";

/**
 * Info icon for Study Notes menu entry
 * (from `info-svgrepo-com.svg`).
 */
export function StudyNotesBookmarkIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 18;
  const color = props.color ?? "#2c2416";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={10}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12}
        y1={17}
        x2={12}
        y2={11}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7L12 7.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
