/**
 * Builds an M3-style wavy path (half-wavelength cubic Bézier segments, alternating amplitude).
 * Coordinates are relative to y = 0 as the wave baseline.
 */
export function buildM3SquiggleSvgPath(
  width: number,
  wavelength: number,
  amplitude: number,
): string {
  if (width <= 0 || wavelength <= 0 || amplitude <= 0) return "";

  const halfWave = wavelength / 2;
  let path = "M 0 0";
  let currentX = 0;
  let waveSign = 1;
  let currentAmp = waveSign * amplitude;

  while (currentX < width - 0.01) {
    waveSign = -waveSign;
    const nextX = Math.min(currentX + halfWave, width);
    const midX = currentX + (nextX - currentX) / 2;
    const nextAmp = waveSign * amplitude;
    path += ` C ${midX} ${currentAmp} ${midX} ${nextAmp} ${nextX} ${nextAmp}`;
    currentAmp = nextAmp;
    currentX = nextX;
  }

  return path;
}

/** Compact squiggle for sheet icon previews (fixed viewBox width). */
export function buildM3SquigglePreviewPath(
  width: number,
  wavelength: number,
  amplitude: number,
): string {
  return buildM3SquiggleSvgPath(width, wavelength, amplitude);
}
