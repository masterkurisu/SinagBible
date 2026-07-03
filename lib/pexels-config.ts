/**
 * Pexels API key — set `PEXELS_API_KEY` in `.env.local` or EAS secrets (see `app.config.js`).
 */
import Constants from "expo-constants";

function getExpoExtra(): { pexelsApiKey?: string } | undefined {
  return (
    Constants.expoConfig?.extra ??
    (Constants.manifest2 as { extra?: { pexelsApiKey?: string } } | null)?.extra ??
    (Constants.manifest as { extra?: { pexelsApiKey?: string } } | null)?.extra
  );
}

export function getPexelsApiKey(): string | null {
  const key =
    getExpoExtra()?.pexelsApiKey ??
    process.env.EXPO_PUBLIC_PEXELS_API_KEY ??
    process.env.PEXELS_API_KEY;
  return key?.trim() || null;
}

export function isPexelsApiKeyConfigured(): boolean {
  return getPexelsApiKey() != null;
}
