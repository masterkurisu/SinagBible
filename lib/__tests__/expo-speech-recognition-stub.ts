export const ExpoSpeechRecognitionModule = {
  isRecognitionAvailable: () => false,
  requestPermissionsAsync: async () => ({ granted: false, status: "undetermined" }),
  start: () => {},
  stop: () => {},
  abort: () => {},
  addListener: () => ({ remove() {} }),
};

export function useSpeechRecognitionEvent(): void {}
