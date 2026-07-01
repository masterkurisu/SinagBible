/**
 * Pexels API key — set `PEXELS_API_KEY` in `.env.local` (see `app.config.js`).
 */
import Constants from "expo-constants";

export function getPexelsApiKey(): string | null {
  const key =
    (Constants.expoConfig?.extra as { pexelsApiKey?: string } | undefined)?.pexelsApiKey ??
    process.env.PEXELS_API_KEY;
  return key?.trim() || null;
}
