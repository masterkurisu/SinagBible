import { InteractionManager, unstable_batchedUpdates } from "react-native";

type ReloadHandler = () => void | Promise<void>;
type PhaseListener = () => void;

const reloadHandlers = new Set<ReloadHandler>();
const beginListeners = new Set<PhaseListener>();
const endListeners = new Set<PhaseListener>();
const abortListeners = new Set<PhaseListener>();
const pickingBeginListeners = new Set<PhaseListener>();
const pickingEndListeners = new Set<PhaseListener>();

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

/** Fires while the file picker is open or dismissing (spinner bridges the return gap). */
export function subscribeReaderDataImportPickingBegin(listener: PhaseListener): () => void {
  pickingBeginListeners.add(listener);
  return () => {
    pickingBeginListeners.delete(listener);
  };
}

/** Fires when the file picker phase ends. */
export function subscribeReaderDataImportPickingEnd(listener: PhaseListener): () => void {
  pickingEndListeners.add(listener);
  return () => {
    pickingEndListeners.delete(listener);
  };
}

/** Minimum time the import reload overlay stays visible before the done state. */
export const READER_DATA_IMPORT_RELOAD_MIN_MS = 400;

/** Wait for the done badge and verse fade-in to finish before showing transient UI. */
export const READER_DATA_IMPORT_UI_SETTLE_MS = 520 + 320 + 48;

export async function waitForReaderDataImportUiSettled(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, READER_DATA_IMPORT_UI_SETTLE_MS);
  });
}

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

function notifyPickingBegin(): void {
  for (const listener of pickingBeginListeners) {
    listener();
  }
}

function notifyPickingEnd(): void {
  for (const listener of pickingEndListeners) {
    listener();
  }
}

/** Shows a spinner on the reader while the system file picker is open or dismissing. */
export function beginReaderDataImportPicking(): void {
  notifyPickingBegin();
}

/** Hides the file-picker spinner (no-op if reload overlay already took over). */
export function endReaderDataImportPicking(): void {
  notifyPickingEnd();
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
  unstable_batchedUpdates(() => {
    notifyBegin();
    notifyPickingEnd();
  });
  await yieldForReaderDataImportPaint();

  const startedAt = Date.now();

  try {
    await importWork();
    await Promise.all([...reloadHandlers].map((handler) => Promise.resolve(handler())));
    await waitForMinLoadingDuration(startedAt);
    notifyEnd();
  } catch (error) {
    notifyPickingEnd();
    abortReaderDataImport();
    throw error;
  }
}

/** Notifies the reader to reload annotations and play the chapter transition animation. */
export async function notifyReaderDataImported(): Promise<void> {
  await runReaderDataImportWithAnimation(async () => {});
}
