import { memo, useMemo } from "react";
import { View, type TextLayoutLine } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { UnderlineStyle, AnnotationColorId } from "@sinag-bible/types";
import { buildM3SquiggleSvgPath } from "@/src/features/reader/m3SquigglePath";
import {
  VERSE_ANNOTATION_SQUIGGLE_VERTICAL_OFFSET_PX,
  VERSE_ANNOTATION_UNDERLINE_GAP_PX,
  VERSE_ANNOTATION_UNDERLINE_THICKNESS_PX,
  resolveUnderlineStyle,
  verseAnnotationUnderlineColor,
  verseSquiggleMetricsForFontSize,
} from "@/src/features/reader/verseAnnotationUnderlineMetrics";

type VerseAnnotationUnderlineOverlayProps = {
  lines: readonly TextLayoutLine[];
  color: string;
  colorId?: AnnotationColorId;
  underlineStyle: UnderlineStyle | undefined;
  fontSize: number;
};

function squigglePathCacheKey(width: number, wavelength: number, amplitude: number): string {
  return `${Math.round(width * 10)}:${Math.round(wavelength * 10)}:${Math.round(amplitude * 10)}`;
}

export const VerseAnnotationUnderlineOverlay = memo(function VerseAnnotationUnderlineOverlay({
  lines,
  color,
  colorId,
  underlineStyle,
  fontSize,
}: VerseAnnotationUnderlineOverlayProps) {
  const resolvedStyle = resolveUnderlineStyle(underlineStyle);
  const underlineInk = useMemo(
    () => verseAnnotationUnderlineColor(color, colorId),
    [color, colorId],
  );
  const squiggleMetrics = useMemo(
    () => verseSquiggleMetricsForFontSize(fontSize),
    [fontSize],
  );

  const squigglePaths = useMemo(() => {
    if (resolvedStyle !== "squiggly") return new Map<string, string>();
    const cache = new Map<string, string>();
    for (const line of lines) {
      const width = Math.max(1, Math.round(line.width));
      const key = squigglePathCacheKey(width, squiggleMetrics.wavelength, squiggleMetrics.amplitude);
      if (!cache.has(key)) {
        cache.set(
          key,
          buildM3SquiggleSvgPath(width, squiggleMetrics.wavelength, squiggleMetrics.amplitude),
        );
      }
    }
    return cache;
  }, [lines, resolvedStyle, squiggleMetrics.amplitude, squiggleMetrics.wavelength]);

  if (lines.length === 0) return null;

  return (
    <>
      {lines.map((line, index) => {
        const width = Math.max(1, line.width);
        const top =
          line.y +
          line.height -
          VERSE_ANNOTATION_UNDERLINE_GAP_PX -
          (resolvedStyle === "squiggly"
            ? squiggleMetrics.svgHeight
            : VERSE_ANNOTATION_UNDERLINE_THICKNESS_PX) +
          (resolvedStyle === "squiggly" ? VERSE_ANNOTATION_SQUIGGLE_VERTICAL_OFFSET_PX : 0);

        if (resolvedStyle === "squiggly") {
          const pathKey = squigglePathCacheKey(
            Math.round(width),
            squiggleMetrics.wavelength,
            squiggleMetrics.amplitude,
          );
          const pathD = squigglePaths.get(pathKey);
          if (!pathD) return null;

          return (
            <Svg
              key={`squiggle-${index}`}
              pointerEvents="none"
              width={width}
              height={squiggleMetrics.svgHeight}
              viewBox={`0 0 ${width} ${squiggleMetrics.svgHeight}`}
              style={{
                position: "absolute",
                left: line.x,
                top,
              }}
            >
              <Path
                d={pathD}
                stroke={underlineInk}
                strokeWidth={squiggleMetrics.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                transform={`translate(0 ${squiggleMetrics.svgHeight / 2})`}
              />
            </Svg>
          );
        }

        return (
          <View
            key={`straight-${index}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: line.x,
              top,
              width,
              height: VERSE_ANNOTATION_UNDERLINE_THICKNESS_PX,
              backgroundColor: underlineInk,
              borderRadius: VERSE_ANNOTATION_UNDERLINE_THICKNESS_PX / 2,
            }}
          />
        );
      })}
    </>
  );
});
