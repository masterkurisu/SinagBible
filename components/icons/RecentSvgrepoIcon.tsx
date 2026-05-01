import Svg, { Path } from "react-native-svg";

/**
 * Recent / history clock (from SVG Repo “Recent”, id 374386;
 * asset: `assets/icons/recent-svgrepo-com.svg`).
 */
export function RecentSvgrepoIcon(props: { size?: number; color?: string }) {
  const size = props.size ?? 20;
  const color = props.color ?? "#000000";

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        fill={color}
        d="M28.1,48C28,48.7,28,49.3,28,50h-6c0-0.7,0-1.3,0.1-2H28.1z"
      />
      <Path
        fill={color}
        d="M51.5,36h-3c-0.8,0-1.5,0.7-1.5,1.5v13.1c0,0.4,0.2,0.8,0.4,1.1l8.4,8.4c0.6,0.6,1.5,0.6,2.1,0l2.1-2.1c0.6-0.6,0.6-1.5,0-2.1L53,48.8V37.5C53,36.7,52.3,36,51.5,36z"
      />
      <Path
        fill={color}
        d="M50,22c-14.8,0-26.9,11.5-27.9,26c0,0.3-0.1,0.7-0.1,1h-4.5c-1.3,0-2,1.5-1.2,2.4l7.5,9.1c0.6,0.7,1.7,0.7,2.3,0l7.5-9.1c0.8-1,0.1-2.4-1.2-2.4H28c0-0.3,0-0.7,0-1c1-11.2,10.5-20,21.9-20c13,0,23.3,11.3,21.9,24.5C70.8,62,61.8,71,52.2,71.9c-7.1,0.7-13.8-1.9-18.5-7c-0.6-0.7-1.4-1.1-2.2-0.1l-2.4,2.9c-0.5,0.6-0.1,1,0.4,1.5c5.4,5.7,12.8,8.9,20.8,8.8c14.4-0.2,26.5-11.6,27.5-26C79.1,35.7,66.1,22,50,22z"
      />
    </Svg>
  );
}
