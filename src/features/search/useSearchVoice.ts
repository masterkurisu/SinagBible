import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSearchVoiceModule,
  isSearchVoiceAvailable,
  transcriptFromVoiceResult,
  type SearchVoiceModule,
} from "@/lib/search-voice";

type VoiceSub = { remove: () => void };

/**
 * Optional overlay speech-to-text. Typing still works when the module, permission,
 * or OS recognizer is missing.
 */
export function useSearchVoice({
  enabled,
  onTranscript,
}: {
  enabled: boolean;
  onTranscript: (text: string, isFinal: boolean) => void;
}) {
  const [listening, setListening] = useState(false);
  const available = isSearchVoiceAvailable();
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const subsRef = useRef<VoiceSub[]>([]);

  const clearSubs = useCallback(() => {
    for (const sub of subsRef.current) {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    }
    subsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    const mod = getSearchVoiceModule();
    clearSubs();
    try {
      mod?.stop();
      mod?.abort?.();
    } catch {
      /* overlay typing still works */
    }
    setListening(false);
  }, [clearSubs]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const start = useCallback(async () => {
    const mod: SearchVoiceModule | null = getSearchVoiceModule();
    if (!mod) return;
    try {
      const permission = await mod.requestPermissionsAsync();
      if (!permission.granted) return;
      clearSubs();
      const resultSub = mod.addListener("result", (event) => {
        const text = transcriptFromVoiceResult(event);
        if (!text) return;
        onTranscriptRef.current(text, Boolean(event.isFinal));
      });
      const endSub = mod.addListener("end", () => {
        clearSubs();
        setListening(false);
      });
      const errorSub = mod.addListener("error", () => {
        clearSubs();
        setListening(false);
      });
      subsRef.current = [resultSub, endSub, errorSub];
      mod.start({ lang: "en-US", interimResults: true, continuous: false });
      setListening(true);
    } catch {
      clearSubs();
      setListening(false);
    }
  }, [clearSubs]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    void start();
  }, [listening, start, stop]);

  return { available, listening, toggle, stop };
}
