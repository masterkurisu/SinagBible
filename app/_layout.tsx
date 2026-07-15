import "react-native-gesture-handler";
import "../global.css";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, type Href } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { STARTUP_FONT_MAP } from "@/lib/app-font-map";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { InteractionManager, AppState, Platform } from "react-native";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ScreenLoadingSkeleton } from "@/components/loading-skeleton";
import { OnboardingContainer } from "@/src/features/onboarding/OnboardingContainer";
import { ONBOARDING_DEBUG_FORCE_APP_INTRO } from "@/lib/onboarding-debug";
import {
  ONBOARDING_DONE_STORAGE_KEY,
  publishOnboardingState,
  subscribeOnboardingState,
} from "@/lib/onboarding-storage";
import { MobileAppThemeProvider, useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { initAppLogs } from "@/lib/app-logs";
import { initCrashReporting } from "@/lib/crash-reporting";
import { applyPlatformOrientationLock } from "@/lib/apply-platform-orientation-lock";
import { loadHapticsEnabledPreference } from "@/lib/haptics-preference";
import { openChapterDb } from "@/lib/chapter-db";
import { initJournalStorage } from "@/lib/journal-local";
import { migrateAsyncStorageChapters } from "@/lib/migrate-async-storage";
import { fetchChapterRemoteConfig } from "@/lib/chapter-remote-config";
import { reconcileWithRemoteConfig } from "@/lib/chapter-store";
import {
  FEATURE_ONBOARDING_FORCE_ALL,
  resetAllFeatureOnboardingStorage,
} from "@/lib/feature-onboarding-storage";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });
initAppLogs();
initCrashReporting();
void applyPlatformOrientationLock();
void loadHapticsEnabledPreference();

if (__DEV__ && ONBOARDING_DEBUG_FORCE_APP_INTRO) {
  console.info("[onboarding] forceAppIntro is on — app intro slides will show.");
  void AsyncStorage.removeItem(ONBOARDING_DONE_STORAGE_KEY);
}

if (__DEV__ && FEATURE_ONBOARDING_FORCE_ALL) {
  console.info(
    "[feature-onboarding] force flag(s) on — feature tours will re-run (see lib/onboarding-debug.ts).",
  );
  void resetAllFeatureOnboardingStorage();
}

function runChapterRemoteReconcile(): void {
  void fetchChapterRemoteConfig()
    .then((config) => {
      if (config) reconcileWithRemoteConfig(config);
    })
    .catch((error) => {
      console.warn("chapter-store remote reconcile failed", error);
    });
}

function ThemedStatusBar() {
  const { themeId } = useMobileAppTheme();
  const useLightStatusIcons =
    themeId === "dark" || themeId === "night" || themeId === "noir";
  return <StatusBar style={useLightStatusIcons ? "light" : "dark"} />;
}

function ThemedStack() {
  const { bundle } = useMobileAppTheme();
  const { ui } = bundle;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: ui.parchmentMid },
        headerTintColor: ui.brown800,
        headerTitleStyle: { fontFamily: "Lora_400Regular" },
        contentStyle: { flex: 1, backgroundColor: ui.parchmentMid },
        animation: Platform.OS === "android" ? "fade_from_bottom" : "ios_from_right",
        animationDuration: Platform.OS === "android" ? 200 : 340,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="journal/[id]" options={{ title: "Journal Entry" }} />
      <Stack.Screen name="journal/new" options={{ title: "New Entry" }} />
      <Stack.Screen name="journal/edit/[id]" options={{ title: "Edit Entry" }} />
    </Stack>
  );
}

function RootLayoutContent() {
  const router = useRouter();
  const [fontsLoaded] = useFonts(STARTUP_FONT_MAP);
  const [onboardingStorageReady, setOnboardingStorageReady] = useState(false);
  const [chapterDbReady, setChapterDbReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [pendingHomeAfterOnboarding, setPendingHomeAfterOnboarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(ONBOARDING_DONE_STORAGE_KEY);
        if (!cancelled) {
          setOnboardingDone(v === "true");
        }
      } catch {
        if (!cancelled) {
          setOnboardingDone(false);
        }
      } finally {
        if (!cancelled) {
          setOnboardingStorageReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Promise.all([openChapterDb(), initJournalStorage()]);
      } catch (error) {
        console.warn("journal storage startup failed", error);
      } finally {
        if (!cancelled) setChapterDbReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chapterDbReady) return;

    const task = InteractionManager.runAfterInteractions(() => {
      void migrateAsyncStorageChapters().catch((error) => {
        console.warn("chapter-store migration failed", error);
      });
      runChapterRemoteReconcile();
    });

    return () => {
      task.cancel();
    };
  }, [chapterDbReady]);

  useEffect(() => {
    if (!chapterDbReady) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        runChapterRemoteReconcile();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [chapterDbReady]);

  useEffect(() => {
    return subscribeOnboardingState((done) => {
      setOnboardingDone(done);
      if (!done) {
        setPendingHomeAfterOnboarding(false);
      }
    });
  }, []);

  const finishOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_DONE_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setPendingHomeAfterOnboarding(true);
    setOnboardingDone(true);
    publishOnboardingState(true);
  }, []);

  useEffect(() => {
    if (!pendingHomeAfterOnboarding || !onboardingDone) return;
    setPendingHomeAfterOnboarding(false);
    router.replace("/" as Href);
  }, [pendingHomeAfterOnboarding, onboardingDone, router]);

  useEffect(() => {
    if (fontsLoaded && onboardingStorageReady && chapterDbReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, onboardingStorageReady, chapterDbReady]);

  return (
    <>
      {!fontsLoaded || !chapterDbReady ? (
        <ScreenLoadingSkeleton lines={5} caption="Loading…" />
      ) : !onboardingStorageReady ? null : onboardingDone ? (
        <ThemedStack />
      ) : (
        <OnboardingContainer onFinish={finishOnboarding} />
      )}
      <ThemedStatusBar />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
        SafeAreaProvider: supplied once by Expo Router’s ExpoRoot (see expo-router/build/ExpoRoot.js).
        Avoid nesting a second provider here — duplicate providers can skew inset calculations on Android.
      */}
      <AppErrorBoundary>
        <MobileAppThemeProvider>
          <RootLayoutContent />
        </MobileAppThemeProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
