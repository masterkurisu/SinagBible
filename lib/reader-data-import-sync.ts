import { InteractionManager } from "react-native";

type ReloadHandler = () => void | Promise<void>;
type PhaseListener = () => void;

const reloadHandlers = new Set<ReloadHandler>();
const beginListeners = new Set<PhaseListener>();
const endListeners = new Set<PhaseListener>();
const abortListeners = new Set<PhaseListener>();

/** Registers a handler that reloads in-memory reader state after a backup import. */
export function registerReaderDataImportReload(handler: ReloadHandler): () => void {
  reloadHandlers.add(handler);
  return () => {
    reloadHandlers.delete(handler);
  };
}

/** Fires before imported data is applied to in-memory reader state (fade-out / loading UI). */
export function subscribeReaderDataImportBegin(listener: PhaseListener): () => void {
  beginListeners.add(listener);
  return () => {
    beginListeners.delete(listener);
  };
}

/** Fires after imported data has been reloaded into in-memory reader state. */
export function subscribeReaderDataImportEnd(listener: PhaseListener): () => void {
  endListeners.add(listener);
  return () => {
    endListeners.delete(listener);
  };
}

/** Fires when import fails after the loading UI has started (reset overlay without "Done!"). */
export function subscribeReaderDataImportAbort(listener: PhaseListener): () => void {
  abortListeners.add(listener);
  return () => {
    abortListeners.delete(listener);
  };
}

/** Minimum time the import reload overlay stays visible before the done state. */
export const READER_DATA_IMPORT_RELOAD_MIN_MS = 300;

function notifyBegin(): void {
  for (const listener of beginListeners) {
    listener();
  }
}

function notifyEnd(): void {
  for (const listener of endListeners) {
    listener();
  }
}

/** Stops the import loading UI without playing the success "Done!" phase. */
export function abortReaderDataImport(): void {
  for (const listener of abortListeners) {
    listener();
  }
  notifyEnd();
}

async function waitForMinLoadingDuration(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, READER_DATA_IMPORT_RELOAD_MIN_MS - elapsed);
  if (remaining > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, remaining);
    });
  }
}

/** Lets React paint the loading overlay before heavy import work starts. */
export async function yieldForReaderDataImportPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

/**
 * Shows the chapter reload animation, runs import work in the background,
 * then reloads reader state and finishes the transition.
 */
export async function runReaderDataImportWithAnimation(importWork: () => Promise<void>): Promise<void> {
  notifyBegin();
  await yieldForReaderDataImportPaint();

  const startedAt = Date.now();

  try {
    await importWork();
    await Promise.all([...reloadHandlers].map((handler) => Promise.resolve(handler())));
    await waitForMinLoadingDuration(startedAt);
    notifyEnd();
  } catch (error) {
    abortReaderDataImport();
    throw error;
  }
}

/** Notifies the reader to reload annotations and play the chapter transition animation. */
export async function notifyReaderDataImported(): Promise<void> {
  await runReaderDataImportWithAnimation(async () => {});
}
