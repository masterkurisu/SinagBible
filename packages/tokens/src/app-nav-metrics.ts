/**
 * Bottom nav layout math — shared by web (reference) and React Native.
 * Web Tailwind arbitrary values stay literal in `apps/web/lib/app-nav-chrome.ts` for JIT;
 * numbers here are the single source of truth to keep platforms aligned.
 */

const REM = 16;

/** Matches web `APP_NAV_HEIGHT_SCALE` */
export const APP_NAV_HEIGHT_SCALE = 0.8;

/** ~0.7rem — minimum bottom gap above home indicator (web header `bottom-[max(0.7rem,...)]`). */
export const APP_NAV_BOTTOM_GAP_REM = 0.7;

export const APP_NAV_TAB_MIN_CSS = 62;

/** `sm:` breakpoint tab min width in web app-nav */
export const APP_NAV_TAB_MIN_CSS_SM = 74;

export const APP_NAV_BASE_SCALE = 1.15;
export const APP_NAV_SECTION_SCALE = 0.95;

/** Tab min width × 1.15 × 0.95 */
export function appNavTabMinWidthPx(): number {
  return APP_NAV_TAB_MIN_CSS * APP_NAV_BASE_SCALE * APP_NAV_SECTION_SCALE;
}

/**
 * Three-tab pill width — default breakpoint (phone):
 * `(3px×0.95)×2 + (62×1.15×0.95)×3 + 0.25rem + 2px`
 */
export function appNavPillExpandedWidthPx(): number {
  return (
    appNavShellPadHorizontalPx() * 2 +
    appNavTabMinWidthPx() * 3 +
    0.25 * REM +
    2
  );
}

/** Single tab track width inside the pill (three columns + two gaps). */
export function appNavTabCellWidthPx(): number {
  const inner = appNavPillExpandedWidthPx() - 2 * appNavShellPadHorizontalPx();
  const g = appNavTabGapPx();
  return (inner - 2 * g) / 3;
}

/** Area to reserve for floating tab bar (nav chrome + bottom inset). */
export function appNavTabBarSlotHeightPx(safeAreaBottom: number): number {
  return appNavBottomInsetPx(safeAreaBottom) + appNavOuterHeightPx();
}

/** Outer chrome height: (62×1.15+6) × 0.95 × height scale */
export function appNavOuterHeightPx(): number {
  return (APP_NAV_TAB_MIN_CSS * APP_NAV_BASE_SCALE + 6) * APP_NAV_SECTION_SCALE * APP_NAV_HEIGHT_SCALE;
}

/** Shell padding horizontal: 3 × 0.95 */
export function appNavShellPadHorizontalPx(): number {
  return 3 * APP_NAV_SECTION_SCALE;
}

/** Shell padding vertical: 3 × 0.95 × height scale */
export function appNavShellPadVerticalPx(): number {
  return 3 * APP_NAV_SECTION_SCALE * APP_NAV_HEIGHT_SCALE;
}

/** @deprecated Use appNavShellPadHorizontalPx */
export function appNavShellPadPx(): number {
  return appNavShellPadHorizontalPx();
}

/** Tab row / icon–label gap: 0.125rem × height scale */
export function appNavTabGapPx(): number {
  return REM * 0.125 * APP_NAV_HEIGHT_SCALE;
}

/** Nav tab icons: 1.25rem × 1.15 × 0.95 × height scale */
export function appNavTabIconSizePx(): number {
  return 1.25 * REM * APP_NAV_BASE_SCALE * APP_NAV_SECTION_SCALE * APP_NAV_HEIGHT_SCALE;
}

/** Search control icon: 20 × 1.15 × 0.95 × height scale */
export function appNavSearchIconSizePx(): number {
  return 20 * APP_NAV_BASE_SCALE * APP_NAV_SECTION_SCALE * APP_NAV_HEIGHT_SCALE;
}

export function appNavTabPaddingTopPx(): number {
  return 7 * APP_NAV_BASE_SCALE * APP_NAV_SECTION_SCALE * APP_NAV_HEIGHT_SCALE;
}

export function appNavTabPaddingBottomPx(): number {
  return 5 * APP_NAV_BASE_SCALE * APP_NAV_SECTION_SCALE * APP_NAV_HEIGHT_SCALE;
}

/** Web uses `text-[8px]` for tab labels (fixed, not scaled by APP_NAV_HEIGHT_SCALE). */
export function appNavTabLabelFontSizePx(): number {
  return 8;
}

/** Space from screen bottom to nav pill baseline */
export function appNavBottomInsetPx(safeAreaBottom: number): number {
  return Math.max(APP_NAV_BOTTOM_GAP_REM * REM, safeAreaBottom);
}

/** FAB — gap above nav chrome (web `appNavFabBottom`) */
export function appNavFabOffsetPx(safeAreaBottom: number): number {
  return appNavBottomInsetPx(safeAreaBottom) + appNavOuterHeightPx() + 0.75 * REM;
}

/** Scroll/content padding so lists clear the floating tab bar */
export function appNavScreenPaddingBottomPx(safeAreaBottom: number, extraPx = 32): number {
  return appNavBottomInsetPx(safeAreaBottom) + appNavOuterHeightPx() + extraPx;
}

/** Journal index: centered FAB (~60px) + margin — mirrors web shell */
export function appNavJournalScrollPaddingBottomPx(safeAreaBottom: number): number {
  return appNavFabOffsetPx(safeAreaBottom) + 60 + 40;
}

/** Inline search field width when expanded: `160px × 1.15 × 0.95` */
export function appNavSearchInputWidthPx(): number {
  return 160 * APP_NAV_BASE_SCALE * APP_NAV_SECTION_SCALE;
}

/** Dismiss search results sheet when dragged past this offset (web app-nav) */
export const APP_NAV_SEARCH_CARD_DRAG_DISMISS_PX = 92;
