import Svg, { Path } from "react-native-svg";

/** Favorite action (swipe left); from heart-alt-svgrepo-com, user-requested tint */
export const SWIPE_HEART_STROKE = "#fbe0e0";

/** Delete action (swipe right); from trash-svgrepo-com, user-requested tint */
export const SWIPE_TRASH_STROKE = "#d6e6ff";

/** Readable heart line on SWIPE_HEART_STROKE pill (muted for a softer outline) */
export const SWIPE_HEART_INK = "#a57575";

/** Readable trash line on SWIPE_TRASH_STROKE pill (muted for a softer outline) */
export const SWIPE_TRASH_INK = "#5f7fa3";

export function JournalSwipeHeartIcon({
  size = 26,
  stroke = SWIPE_HEART_STROKE,
  strokeWidth = 2,
}: {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M15.7 4C18.87 4 21 6.98 21 9.76C21 15.39 12.16 20 12 20C11.84 20 3 15.39 3 9.76C3 6.98 5.13 4 8.3 4C10.12 4 11.31 4.91 12 5.71C12.69 4.91 13.88 4 15.7 4Z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function JournalSwipeTrashIcon({
  size = 26,
  stroke,
  strokeWidth = 1.5,
}: {
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  const c = stroke ?? SWIPE_TRASH_STROKE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.7628 9H7.63719C7.18864 9 6.82501 9.37295 6.82501 9.833V16.5C6.82501 17.8807 7.91632 19 9.26251 19H14.1375C14.784 19 15.404 18.7366 15.8611 18.2678C16.3182 17.7989 16.575 17.163 16.575 16.5V9.833C16.575 9.37295 16.2114 9 15.7628 9Z"
        stroke={c}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.625 7L13.9191 5.553C13.7541 5.21427 13.4167 5.0002 13.0475 5H10.3526C9.98338 5.0002 9.64596 5.21427 9.48092 5.553L8.77502 7H14.625Z"
        stroke={c}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.32469 12.333V15.666M12.5753 12.333V15.666M14.625 7.75H16.575M8.77501 7.75H6.82501"
        stroke={c}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
