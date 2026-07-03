import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MobileAppThemeBundle } from "@sinag-bible/tokens";
import {
  getTranslationOfflinePolicy,
  translationOfflineStatusLabel,
} from "@/lib/translation-offline-capability";
import { useTranslationDownload } from "@/lib/use-translation-download";
import {
  READER_M3_ON_SURFACE_VARIANT,
} from "@/src/features/reader/readerSettingsPanelChrome";

type TranslationOfflineStatusProps = {
  translationId: string;
  ui: MobileAppThemeBundle["ui"];
  mutedColor: string;
};

export function TranslationOfflineStatus({
  translationId,
  ui,
  mutedColor,
}: TranslationOfflineStatusProps) {
  const policy = getTranslationOfflinePolicy(translationId);
  const staticLabel = translationOfflineStatusLabel(translationId);
  const { policySupportsDownload, isFullyDownloaded, downloadState, startDownload } =
    useTranslationDownload(translationId);

  if (policy === "bundled" || policy === "cache_as_you_read") {
    if (!staticLabel) return null;
    return (
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: Platform.OS === "android" ? 12 : 11,
          color: mutedColor,
          marginTop: 2,
        }}
      >
        {staticLabel}
      </Text>
    );
  }

  if (!policySupportsDownload) return null;

  if (isFullyDownloaded || downloadState.status === "complete") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
        <Ionicons name="cloud-done-outline" size={14} color={ui.gold} />
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: Platform.OS === "android" ? 12 : 11,
            color: mutedColor,
          }}
        >
          Downloaded for offline use
        </Text>
      </View>
    );
  }

  if (downloadState.status === "downloading") {
    const total = downloadState.totalChapters;
    const completed = downloadState.completedChapters;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
        <ActivityIndicator size="small" color={ui.gold} />
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: Platform.OS === "android" ? 12 : 11,
            color: mutedColor,
          }}
        >
          {total > 0 ? `Downloading… ${pct}%` : "Downloading…"}
        </Text>
      </View>
    );
  }

  if (downloadState.status === "error" && downloadState.errorMessage) {
    return (
      <View style={{ marginTop: 2, gap: 4 }}>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: Platform.OS === "android" ? 12 : 11,
            color: "#c62828",
          }}
        >
          {downloadState.errorMessage}
        </Text>
        <TouchableOpacity
          onPress={startDownload}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Retry translation download"
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: Platform.OS === "android" ? 12 : 11,
              color: ui.gold,
            }}
          >
            Retry download
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={startDownload}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel="Download translation for offline use"
      style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
    >
      <Ionicons
        name="cloud-download-outline"
        size={14}
        color={Platform.OS === "android" ? READER_M3_ON_SURFACE_VARIANT : ui.goldMuted}
      />
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: Platform.OS === "android" ? 12 : 11,
          color: ui.gold,
        }}
      >
        Download for offline use
      </Text>
    </TouchableOpacity>
  );
}
