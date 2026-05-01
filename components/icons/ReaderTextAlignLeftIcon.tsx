/**
 * text-align-left-svgrepo-com — viewBox 0 0 24 24
 */
import Svg, { Path } from "react-native-svg";

type Props = { size?: number; color: string };

export function ReaderTextAlignLeftIcon({ size = 20, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M3 6H21M3 12H13M3 18H18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
