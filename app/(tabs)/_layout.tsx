import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { usePathname } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { getTabTint } from "@sinag-bible/tokens";
import { useMobileAppTheme } from "@/lib/mobile-app-theme-context";
import { hapticLightImpact } from "@/lib/haptics";
import { loadReaderLastPosition, peekReaderLastPosition } from "@/lib/reader-last-position";
import {
  ReaderTabBarVisibilityProvider,
  READER_TOOLS_MENU_TAB_BAR_COLOR,
  useReaderSettingsTabBarTint,
  useReaderTabBarScrollHidden,
} from "@/lib/reader-tab-bar-visibility-context";
import { mixHexColors } from "@/lib/mix-hex-color";

/** Path segments map to the primary tab (`(tabs)` group may or may not appear in the path). */
function tabHapticKeyFromPathname(pathname: string | null): string | null {
  if (pathname == null || pathname === "" || pathname === "/") return "index";
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (!first) return "index";
  if (first === "(tabs)") {
    const second = parts[1];
    if (second == null || second === "" || second === "index") return "index";
    if (second === "reader" || second === "journal" || second === "search") return second;
    return null;
  }
  if (first === "reader" || first === "journal" || first === "search") return first;
  if (first === "index") return "index";
  return null;
}

/** True when the active reader tab is showing a chapter (not the redirect index). */
function isReaderChapterRoute(pathname: string | null): boolean {
  if (pathname == null || pathname === "") return false;
  const parts = pathname.split("/").filter(Boolean);
  let i = 0;
  if (parts[0] === "(tabs)") i = 1;
  if (parts[i] !== "reader") return false;
  const afterReader = parts.slice(i + 1);
  return afterReader.length >= 2 && afterReader[0] !== "index";
}

const JOURNAL_DRAFT_KEY_CANDIDATES = [
  "sinagbible_journal_draft",
  "sb:journal:draft",
  "quietword_journal_draft",
  "qs:journal:draft",
  "sb-journal-draft",
  "qs-journal-draft",
  "journal_draft",
];
const DRAFT_DISCOVERY_INTERVAL_MS = 60_000;

export default function TabLayout() {
  return (
    <ReaderTabBarVisibilityProvider>
      <TabLayoutInner />
    </ReaderTabBarVisibilityProvider>
  );
}

function TabLayoutInner() {
  const pathname = usePathname();
  const readerTabBarScrollHidden = useReaderTabBarScrollHidden();
  const readerSettingsTabBarTint = useReaderSettingsTabBarTint();
  const prevTabHapticKeyRef = useRef<string | null>(null);
  const activeTabKey = tabHapticKeyFromPathname(pathname);
  const hideTabBarOnAndroidHome = Platform.OS === "android" && activeTabKey === "index";
  const hideTabBarOnAndroidReaderScroll =
    Platform.OS === "android" &&
    activeTabKey === "reader" &&
    isReaderChapterRoute(pathname) &&
    readerTabBarScrollHidden;
  const hideTabBarOnAndroid = hideTabBarOnAndroidHome || hideTabBarOnAndroidReaderScroll;
  const { bundle } = useMobileAppTheme();
  const chrome = bundle.chrome;
  const reader = bundle.reader;
  const { tabTint: TAB_TINT, tabMuted: TAB_MUTED, tabBarBackground: TAB_BAR_BACKGROUND, androidRipple, androidIndicator } =
    chrome;
  const tabBarBackgroundColor =
    Platform.OS === "android" && activeTabKey === "reader"
      ? mixHexColors(reader.sceneSurface, READER_TOOLS_MENU_TAB_BAR_COLOR, readerSettingsTabBarTint)
      : TAB_BAR_BACKGROUND;
  const [hasJournalDraft, setHasJournalDraft] = useState(false);
  const discoveredDraftKeysRef = useRef<string[]>([]);
  const lastDraftDiscoveryAtRef = useRef(0);

  useEffect(() => {
    if (peekReaderLastPosition() != null) return;
    // Warm memory cache so /reader can redirect without waiting on AsyncStorage.
    void loadReaderLastPosition();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hasAnyDraftValue = async (allowDiscovery: boolean): Promise<boolean> => {
      const keysToCheck = [...JOURNAL_DRAFT_KEY_CANDIDATES, ...discoveredDraftKeysRef.current];
      for (const key of keysToCheck) {
        const raw = await AsyncStorage.getItem(key);
        if (raw && raw !== "null" && raw !== '""' && raw !== "{}") {
          return true;
        }
      }
      if (allowDiscovery) {
        // Discovery scan is expensive; only run when explicitly needed.
        const allKeys = await AsyncStorage.getAllKeys();
        const discovered = allKeys.filter((k) => /journal.*draft|draft.*journal/i.test(k));
        discoveredDraftKeysRef.current = discovered;
        for (const key of discovered) {
          const raw = await AsyncStorage.getItem(key);
          if (raw && raw !== "null" && raw !== '""' && raw !== "{}") {
            return true;
          }
        }
      }
      return false;
    };

    const refreshDraftBadge = async (forceDiscovery: boolean) => {
      try {
        const now = Date.now();
        const shouldDiscover =
          forceDiscovery ||
          now - lastDraftDiscoveryAtRef.current >= DRAFT_DISCOVERY_INTERVAL_MS;
        if (shouldDiscover) lastDraftDiscoveryAtRef.current = now;
        const next = await hasAnyDraftValue(shouldDiscover);
        if (!cancelled) setHasJournalDraft(next);
      } catch {
        if (!cancelled) setHasJournalDraft(false);
      }
    };

    void refreshDraftBadge(true);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshDraftBadge(true);
      }
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (activeTabKey !== "journal") return;
    // Refresh badge when user returns to the tab where drafts are edited.
    void (async () => {
      try {
        const keysToCheck = [...JOURNAL_DRAFT_KEY_CANDIDATES, ...discoveredDraftKeysRef.current];
        for (const key of keysToCheck) {
          const raw = await AsyncStorage.getItem(key);
          if (raw && raw !== "null" && raw !== '""' && raw !== "{}") {
            setHasJournalDraft(true);
            return;
          }
        }
        setHasJournalDraft(false);
      } catch {
        setHasJournalDraft(false);
      }
    })();
  }, [activeTabKey]);

  useEffect(() => {
    const key = activeTabKey;
    if (key == null) return;
    const prev = prevTabHapticKeyRef.current;
    if (prev !== null && prev !== key) {
      hapticLightImpact();
    }
    prevTabHapticKeyRef.current = key;
  }, [activeTabKey]);

  const labelFontSize = Platform.OS === "android" ? 12 : 10;

  const iosTabBarSurfaceProps =
    Platform.OS === "ios"
      ? bundle.id === "default"
        ? { blurEffect: "systemMaterial" as const }
        : {
            /** Without this, iOS material blur overrides `backgroundColor` and stays light. */
            blurEffect: "none" as const,
            disableTransparentOnScrollEdge: true as const,
          }
      : {};
  const tabHiddenProps =
    hideTabBarOnAndroid
      ? ({ hidden: true } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  return (
    <NativeTabs
      {...iosTabBarSurfaceProps}
      {...tabHiddenProps}
      tintColor={TAB_TINT}
      iconColor={{ default: TAB_MUTED, selected: TAB_TINT }}
      badgeBackgroundColor="#e53935"
      backgroundColor={tabBarBackgroundColor}
      {...Platform.select({
        android: {
          // With 4 tabs, Material "auto" hides unselected labels — looks broken; show all labels.
          labelVisibilityMode: "labeled" as const,
          rippleColor: androidRipple,
          indicatorColor: androidIndicator,
        },
        default: {},
      })}
      labelStyle={{
        default: {
          color: TAB_MUTED,
          fontSize: labelFontSize,
          fontWeight: "500",
        },
        selected: { color: TAB_TINT, fontSize: labelFontSize, fontWeight: "600" },
      }}
    >
      <NativeTabs.Trigger name="index" disablePopToTop disableScrollToTop>
        <NativeTabs.Trigger.Label selectedStyle={{ color: getTabTint(chrome, 0) }}>
          Home
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          selectedColor={getTabTint(chrome, 0)}
          sf={{ default: "house", selected: "house.fill" }}
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="home-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="home" />,
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reader" disablePopToTop disableScrollToTop>
        <NativeTabs.Trigger.Label selectedStyle={{ color: getTabTint(chrome, 1) }}>
          Bible
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          selectedColor={getTabTint(chrome, 1)}
          sf={{ default: "book.closed", selected: "book.closed.fill" }}
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="book-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="book" />,
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal" disablePopToTop disableScrollToTop>
        <NativeTabs.Trigger.Label selectedStyle={{ color: getTabTint(chrome, 2) }}>
          Journal
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          selectedColor={getTabTint(chrome, 2)}
          sf={{ default: "square.and.pencil", selected: "square.and.pencil" }}
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="square-edit-outline" />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="square-edit-outline" />
            ),
          }}
        />
        {hasJournalDraft ? <NativeTabs.Trigger.Badge>{" "}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" disablePopToTop disableScrollToTop>
        <NativeTabs.Trigger.Label selectedStyle={{ color: getTabTint(chrome, 3) }}>
          Search
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          selectedColor={getTabTint(chrome, 3)}
          sf={{ default: "magnifyingglass", selected: "magnifyingglass" }}
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="magnify" />,
            selected: <NativeTabs.Trigger.VectorIcon family={MaterialCommunityIcons} name="magnify" />,
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
