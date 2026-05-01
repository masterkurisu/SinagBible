/** Expo Router / native-stack — when true on route params, StackClient uses `animation: "none"`. */
export const READER_INTERNAL_NO_STACK_ANIMATION = "__internal_expo_router_no_animation" as const;

export const READER_CHAPTER_ROUTE_NAME = "[book]/[chapter]/index" as const;

/** Mirrors `getInternalExpoRouterParams` (top-level or nested `params`). */
export function readerRouteRequestsNoStackAnimation(routeParams: object | undefined): boolean {
  if (!routeParams || typeof routeParams !== "object") return false;
  const p = routeParams as Record<string, unknown>;
  if (p[READER_INTERNAL_NO_STACK_ANIMATION]) return true;
  const inner = p.params;
  if (inner && typeof inner === "object" && (inner as Record<string, unknown>)[READER_INTERNAL_NO_STACK_ANIMATION]) {
    return true;
  }
  return false;
}
