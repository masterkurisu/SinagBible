import Svg, { Circle, Path, Polygon, Rect } from "react-native-svg";

/** Hide keyboard — from `assets/icons/keyboard-svgrepo-com.svg` */
export function ReflectionKeyboardHideIcon({ size = 20, color = "#ffffff" }: { size?: number; color?: string }) {
  const keyXs = [5.25, 8.25, 11.25, 14.25, 17.25];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="4.5" width="19" height="14" rx="3" stroke={color} strokeWidth={2} />
      {keyXs.map((cx) => (
        <Circle key={`top-${cx}`} cx={cx} cy={9} r={1.1} fill={color} />
      ))}
      {keyXs.map((cx) => (
        <Circle key={`bottom-${cx}`} cx={cx} cy={12} r={1.1} fill={color} />
      ))}
      <Rect x={7} y={14.2} width={10} height={2.2} rx={1.1} fill={color} />
    </Svg>
  );
}

/** Style / format menu — from style-svgrepo-com.svg */
export function ReflectionFormatStyleIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.19 1.09 2.61zm19.5-3.7L17.07 3.98c-.31-.75-1.04-1.21-1.81-1.23-.26 0-.53.04-.79.15L7.1 5.95c-.75.31-1.21 1.03-1.23 1.8-.01.27.04.54.15.8l4.96 11.97c.31.76 1.05 1.22 1.83 1.23.26 0 .52-.05.77-.15l7.36-3.05c1.02-.42 1.51-1.59 1.09-2.6zM7.88 8.75c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2 11c0 1.1.9 2 2 2h1.45l-3.45-8.34v6.34z"
        fill={color}
      />
    </Svg>
  );
}

/** Paths from SVG Repo (bold / italic / list / list-ol / image). */

export function ReflectionBoldIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 7V11H13C14.1046 11 15 10.1046 15 9C15 7.89543 14.1046 7 13 7H9ZM15.9365 11.7161C16.5966 11.0028 17 10.0485 17 9C17 6.79086 15.2091 5 13 5H8.5C7.67157 5 7 5.67157 7 6.5V12V18.5C7 19.3284 7.67157 20 8.5 20H13.5C15.9853 20 18 17.9853 18 15.5C18 13.9126 17.178 12.5171 15.9365 11.7161ZM13 13H9V18H13.5C14.8807 18 16 16.8807 16 15.5C16 14.1193 14.8807 13 13.5 13H13Z"
        fill={color}
      />
    </Svg>
  );
}

export function ReflectionItalicIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Polygon fill={color} points="5.5 2 13 2 12.5 4 10 4 8 12 11 12 10.5 14 3 14 3.5 12 6 12 8 4 5 4" />
    </Svg>
  );
}

export function ReflectionBulletedListIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 6L21 6.00078M8 12L21 12.0008M8 18L21 18.0007M3 6.5H4V5.5H3V6.5ZM3 12.5H4V11.5H3V12.5ZM3 18.5H4V17.5H3V18.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ReflectionNumberedListIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 6L21 6.00066M10 12L21 12.0007M10 18L21 18.0007M3 5L5 4V10M5 10H3M5 10H7M7 20H3L6.41274 17.0139C6.78593 16.6873 7 16.2156 7 15.7197C7 14.7699 6.23008 14 5.28033 14H5C4.06808 14 3.28503 14.6374 3.06301 15.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Expand to fullscreen — from full-screen-svgrepo-com.svg */
export function ReflectionFullscreenIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1920 1920" accessibilityElementsHidden>
      <Path
        fillRule="evenodd"
        d="M1146.616-.012V232.38h376.821L232.391 1523.309v-376.705H0V1920h773.629v-232.39H396.69L1687.737 396.68V773.5h232.275V-.011z"
        fill={color}
      />
    </Svg>
  );
}

export function ReflectionImageIcon({ size = 18, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.205 3h11.59c1.114 0 1.519.116 1.926.334.407.218.727.538.945.945.218.407.334.811.334 1.926v7.51l-4.391-4.053a1.5 1.5 0 0 0-2.265.27l-3.13 4.695-2.303-1.48a1.5 1.5 0 0 0-1.96.298L3.005 18.15A12.98 12.98 0 0 1 3 17.795V6.205c0-1.115.116-1.519.334-1.926.218-.407.538-.727.945-.945C4.686 3.116 5.09 3 6.205 3zm9.477 8.53L21 16.437v1.357c0 1.114-.116 1.519-.334 1.926a2.272 2.272 0 0 1-.945.945c-.407.218-.811.334-1.926.334H6.205c-1.115 0-1.519-.116-1.926-.334a2.305 2.305 0 0 1-.485-.345L8.2 15.067l2.346 1.508a1.5 1.5 0 0 0 2.059-.43l3.077-4.616zM7.988 6C6.878 6 6 6.832 6 7.988 6 9.145 6.879 10 7.988 10 9.121 10 10 9.145 10 7.988 10 6.832 9.121 6 7.988 6z"
        fill={color}
      />
    </Svg>
  );
}
