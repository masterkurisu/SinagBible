import Svg, { Line, Path } from "react-native-svg";
import { buildM3SquigglePreviewPath } from "@/src/features/reader/m3SquigglePath";

const PREVIEW_WIDTH = 28;
const PREVIEW_WAVELENGTH = 7;
const PREVIEW_AMPLITUDE = 2.5;
const PREVIEW_STROKE = 2;

const squigglyPreviewPath = buildM3SquigglePreviewPath(
  PREVIEW_WIDTH,
  PREVIEW_WAVELENGTH,
  PREVIEW_AMPLITUDE,
);

export function StraightUnderlineStyleIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 24;
  const color = props.color ?? "#1C1B1F";
  const y = 16;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Line
        x1={4}
        y1={y}
        x2={20}
        y2={y}
        stroke={color}
        strokeWidth={PREVIEW_STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SquigglyUnderlineStyleIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 24;
  const color = props.color ?? "#1C1B1F";

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d={squigglyPreviewPath}
        stroke={color}
        strokeWidth={PREVIEW_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(-2, 16)"
      />
    </Svg>
  );
}
