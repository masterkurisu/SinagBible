import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

let initialized = false;

export function initCrashReporting(): void {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    debug: __DEV__,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
    release: Constants.expoConfig?.version ?? "unknown",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}
