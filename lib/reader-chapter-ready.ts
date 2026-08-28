/**
 * One-shot signal for "the reader's first chapter open this session has settled"
 * (content loaded, or a definitive load failure) — used to defer non-critical
 * background startup work (currently: search-cache warm-up) until it can no longer
 * compete with the reader's own initial network/JS work for the same resources.
 *
 * The reader tab isn't guaranteed to open every session (the app can land on Home or
 * Journal instead), so callers must race this against a timeout rather than await it
 * unconditionally — see {@link waitForReaderFirstChapterSettled}.
 *
 * See reader-open-stall-findings.md Phase 6.
 */
let settled = false;
const listeners = new Set<() => void>();

/** Idempotent — safe to call on every chapter load/settle; only the first call matters. */
export function markReaderFirstChapterSettled(): void {
  if (settled) return;
  settled = true;
  const toNotify = [...listeners];
  listeners.clear();
  for (const listener of toNotify) listener();
}

export function hasReaderFirstChapterSettled(): boolean {
  return settled;
}

/** Resets for tests / a fresh session (e.g. after delete-my-data). */
export function resetReaderFirstChapterSettledForTesting(): void {
  settled = false;
  listeners.clear();
}

/**
 * Resolves once the reader's first chapter has settled, or after `timeoutMs` —
 * whichever comes first.
 */
export function waitForReaderFirstChapterSettled(timeoutMs: number): Promise<void> {
  if (settled) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      listeners.delete(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = () => finish();
    listeners.add(listener);
    const timer = setTimeout(finish, timeoutMs);
  });
}
