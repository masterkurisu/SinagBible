import { Platform } from "react-native";

export type SearchVoicePermissionResult = {
  granted: boolean;
};

export type SearchVoiceResultEvent = {
  isFinal?: boolean;
  results?: { transcript?: string }[];
};

export type SearchVoiceModule = {
  isRecognitionAvailable?: () => boolean;
  requestPermissionsAsync: () => Promise<SearchVoicePermissionResult>;
  start: (options: { lang: string; interimResults: boolean; continuous: boolean }) => void;
  stop: () => void;
  abort?: () => void;
  addListener: (event: string, listener: (event: SearchVoiceResultEvent) => void) => {
    remove: () => void;
  };
};

function loadSearchVoiceModule(): SearchVoiceModule | null {
  try {
    // Optional native module: overlay typing must work if it is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("expo-speech-recognition") as {
      ExpoSpeechRecognitionModule?: SearchVoiceModule;
    };
    return loaded.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
}

/** Mic is offered only when the OS module is present. Web and missing native code stay on typing. */
export function isSearchVoiceAvailable(): boolean {
  if (Platform.OS === "web") return false;
  const mod = loadSearchVoiceModule();
  if (!mod) return false;
  try {
    if (typeof mod.isRecognitionAvailable === "function" && !mod.isRecognitionAvailable()) {
      return false;
    }
  } catch {
    return false;
  }
  return typeof mod.requestPermissionsAsync === "function" && typeof mod.start === "function";
}

export function getSearchVoiceModule(): SearchVoiceModule | null {
  return isSearchVoiceAvailable() ? loadSearchVoiceModule() : null;
}

export function transcriptFromVoiceResult(event: SearchVoiceResultEvent): string {
  return event.results?.[0]?.transcript?.trim() ?? "";
}
