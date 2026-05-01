import { Path, Svg } from "react-native-svg";

/**
 * Bible / book-with-cross icon (from `bible-svgrepo-com.svg`).
 * viewBox matches source SVG.
 */
export function BibleBookIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 18;
  const color = props.color ?? "#2c2416";

  return (
    <Svg width={size} height={size} viewBox="-32 0 512 512" accessibilityElementsHidden>
      <Path fill={color} d="M448 358.4V25.6c0-16-9.6-25.6-25.6-25.6H96C41.6 0 0 41.6 0 96v320c0 54.4 41.6 96 96 96h326.4c12.8 0 25.6-9.6 25.6-25.6v-16c0-6.4-3.2-12.8-9.6-19.2-3.2-16-3.2-60.8 0-73.6 6.4-3.2 9.6-9.6 9.6-19.2zM144 144c0-8.84 7.16-16 16-16h48V80c0-8.84 7.16-16 16-16h32c8.84 0 16 7.16 16 16v48h48c8.84 0 16 7.16 16 16v32c0 8.84-7.16 16-16 16h-48v112c0 8.84-7.16 16-16 16h-32c-8.84 0-16-7.16-16-16V192h-48c-8.84 0-16-7.16-16-16v-32zm236.8 304H96c-19.2 0-32-12.8-32-32s16-32 32-32h284.8v64z" />
    </Svg>
  );
}
