/**
 * TEMPORARY instrumentation for the reader-open-stall investigation
 * (see `reader-open-stall-findings.md`, Phase 1). Off by default — chapter
 * prefetch logs flooded Metro. Flip {@link ENABLED} and reload to recapture
 * timings. Delete this file and its call sites once the investigation is done.
 */
const ENABLED = false;
const TAG = "[reader-perf]";

/** Starts a named timer; call {@link readerPerfEnd} with the returned handle to log elapsed ms. */
export function readerPerfStart(label: string): { label: string; startedAt: number } | null {
  if (!__DEV__ || !ENABLED) return null;
  console.log(`${TAG} \u25b6 ${label}`);
  return { label, startedAt: performance.now() };
}

export function readerPerfEnd(handle: { label: string; startedAt: number } | null): void {
  if (!__DEV__ || !ENABLED || !handle) return;
  const elapsed = performance.now() - handle.startedAt;
  console.log(`${TAG} \u25a0 ${handle.label}: ${elapsed.toFixed(1)}ms`);
}
