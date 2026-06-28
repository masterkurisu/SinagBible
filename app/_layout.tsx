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
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ScreenLoadingSkeleton } from "@/components/loading-skeleton";
import { OnboardingContainer } from "@/src/features/onboarding/OnboardingContainer";
import {
  ONBOARDING_DONE_STORAGE_KEY,
  publishOnboardingState,
  subscribeOnboardingState,
} from "@/lib/onboarding-storage";
import { MobileAppThemeProvider, useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { initCrashReporting } from "@/lib/crash-reporting";

SplashScreen.preventAutoHideAsync();
initCrashReporting();

function ThemedStatusBar() {
  const { themeId } = useMobileAppTheme();
  const useLightStatusIcons = themeId === "dark" || themeId === "night";
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
        animation: "ios_from_right",
        animationDuration: 340,
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
    if (fontsLoaded && onboardingStorageReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, onboardingStorageReady]);

  return (
    <>
      {!fontsLoaded ? (
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
