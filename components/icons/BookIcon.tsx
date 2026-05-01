import { Path, Svg } from "react-native-svg";

/**
 * Book icon (from `book-svgrepo-com.svg`).
 * Rendered via `react-native-svg` so it works on React Native.
 */
export function BookIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 18;
  const color = props.color ?? "#2c2416";

  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M5 0C3.34315 0 2 1.34315 2 3V13C2 14.6569 3.34315 16 5 16H14V14H4V12H14V0H5Z"
        fill={color}
      />
    </Svg>
  );
}

