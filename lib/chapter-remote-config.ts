import type { RemoteConfigReconcileInput } from "@/lib/chapter-store";

/** Phase 4b: replace with EAS Updates / Firebase / backend provider. */
let remoteConfigProvider: (() => Promise<RemoteConfigReconcileInput | null>) | null = null;

export function setChapterRemoteConfigProvider(
  provider: (() => Promise<RemoteConfigReconcileInput | null>) | null,
): void {
  remoteConfigProvider = provider;
}

export async function fetchChapterRemoteConfig(): Promise<RemoteConfigReconcileInput | null> {
  if (!remoteConfigProvider) return null;
  try {
    return await remoteConfigProvider();
  } catch {
    return null;
  }
}
