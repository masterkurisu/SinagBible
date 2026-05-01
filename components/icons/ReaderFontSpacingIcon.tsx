import { Path, Svg } from "react-native-svg";

/**
 * Text / paragraph line-spacing control (from `spacing-text-paragraph-svgrepo-com.svg`).
 * viewBox 0 0 32 32.
 */
export function ReaderFontSpacingIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 20;
  const color = props.color ?? "#2c2416";

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden>
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5,8.276l0,15.448l-1.329,-1.661c-0.517,-0.647 -1.462,-0.751 -2.108,-0.234c-0.647,0.517 -0.751,1.462 -0.234,2.108l4,5c0.284,0.356 0.715,0.563 1.171,0.563c0.456,-0 0.887,-0.207 1.171,-0.563l4,-5c0.517,-0.646 0.413,-1.591 -0.234,-2.108c-0.646,-0.517 -1.591,-0.413 -2.108,0.234l-1.329,1.661l0,-15.448l1.329,1.661c0.517,0.647 1.462,0.751 2.108,0.234c0.647,-0.517 0.751,-1.462 0.234,-2.108l-4,-5c-0.284,-0.356 -0.715,-0.563 -1.171,-0.563c-0.456,-0 -0.887,0.207 -1.171,0.563l-4,5c-0.517,0.646 -0.413,1.591 0.234,2.108c0.646,0.517 1.591,0.413 2.108,-0.234l1.329,-1.661Z"
      />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28,8.5l-11,0c-0.828,0 -1.5,0.672 -1.5,1.5c0,0.828 0.672,1.5 1.5,1.5l11,0c0.828,0 1.5,-0.672 1.5,-1.5c0,-0.828 -0.672,-1.5 -1.5,-1.5Z"
      />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28,14.5l-11,0c-0.828,-0 -1.5,0.672 -1.5,1.5c-0,0.828 0.672,1.5 1.5,1.5l11,0c0.828,-0 1.5,-0.672 1.5,-1.5c-0,-0.828 -0.672,-1.5 -1.5,-1.5Z"
      />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28,20.5l-11,-0c-0.828,0 -1.5,0.672 -1.5,1.5c0,0.828 0.672,1.5 1.5,1.5l11,-0c0.828,0 1.5,-0.672 1.5,-1.5c0,-0.828 -0.672,-1.5 -1.5,-1.5Z"
      />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28,26.5l-11,0c-0.828,0 -1.5,0.672 -1.5,1.5c0,0.828 0.672,1.5 1.5,1.5l11,0c0.828,0 1.5,-0.672 1.5,-1.5c0,-0.828 -0.672,-1.5 -1.5,-1.5Z"
      />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M28,2.5l-11,0c-0.828,-0 -1.5,0.672 -1.5,1.5c-0,0.828 0.672,1.5 1.5,1.5l11,0c0.828,-0 1.5,-0.672 1.5,-1.5c-0,-0.828 -0.672,-1.5 -1.5,-1.5Z"
      />
    </Svg>
  );
}
