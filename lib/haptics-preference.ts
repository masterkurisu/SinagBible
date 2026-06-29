import AsyncStorage from "@react-native-async-storage/async-storage";

export const HAPTICS_ENABLED_STORAGE_KEY = "sb:settings:haptics-enabled" as const;

type HapticsEnabledListener = (enabled: boolean) => void;

const listeners = new Set<HapticsEnabledListener>();
let cachedEnabled: boolean | null = null;

export function getHapticsEnabledSync(): boolean {
  return cachedEnabled ?? true;
}

export async function loadHapticsEnabledPreference(): Promise<boolean> {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    const raw = await AsyncStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY);
    cachedEnabled = raw === null ? true : raw === "true";
  } catch {
    cachedEnabled = true;
  }
  return cachedEnabled;
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  cachedEnabled = enabled;
  try {
    await AsyncStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    /* persist best-effort */
  }
  for (const listener of listeners) {
    listener(enabled);
  }
}

export function subscribeHapticsEnabled(listener: HapticsEnabledListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
