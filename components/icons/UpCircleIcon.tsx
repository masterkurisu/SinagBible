import { Path, Svg } from "react-native-svg";

/**
 * Up-circle icon (from `up-circle-svgrepo-com.svg`).
 * Rendered via `react-native-svg` so it works on React Native.
 */
export function UpCircleIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 14;
  const color = props.color ?? "#f5e9d6";

  return (
    <Svg width={size} height={size} viewBox="-0.5 0 25 25" fill="none">
      <Path
        d="M12 22.4199C17.5228 22.4199 22 17.9428 22 12.4199C22 6.89707 17.5228 2.41992 12 2.41992C6.47715 2.41992 2 6.89707 2 12.4199C2 17.9428 6.47715 22.4199 12 22.4199Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M8 13.8599L10.87 10.8C11.0125 10.6416 11.1868 10.5149 11.3815 10.4282C11.5761 10.3415 11.7869 10.2966 12 10.2966C12.2131 10.2966 12.4239 10.3415 12.6185 10.4282C12.8132 10.5149 12.9875 10.6416 13.13 10.8L16 13.8599"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

