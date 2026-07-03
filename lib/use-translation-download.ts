import { useCallback, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { isOfflineNetInfo } from "@/lib/network-connectivity";
import {
  getTranslationDownloadState,
  startTranslationDownload,
  subscribeTranslationDownload,
  type TranslationDownloadState,
} from "@/lib/translation-download";
import {
  isTranslationFullyDownloaded,
  supportsFullTranslationDownload,
} from "@/lib/translation-offline-capability";

export function useTranslationDownload(translationId: string): {
  policySupportsDownload: boolean;
  isFullyDownloaded: boolean;
  downloadState: TranslationDownloadState;
  startDownload: () => void;
} {
  const [downloadState, setDownloadState] = useState(() =>
    getTranslationDownloadState(translationId),
  );
  const [fullyDownloaded, setFullyDownloaded] = useState(() =>
    isTranslationFullyDownloaded(translationId),
  );

  useEffect(() => {
    const canonicalKey = getTranslationDownloadState(translationId).translationId;
    const refresh = (id: string) => {
      if (id !== canonicalKey) return;
      setDownloadState(getTranslationDownloadState(translationId));
      setFullyDownloaded(isTranslationFullyDownloaded(translationId));
    };
    refresh(canonicalKey);
    return subscribeTranslationDownload(refresh);
  }, [translationId]);

  const startDownload = useCallback(() => {
    void startTranslationDownload(translationId).catch(() => {
      /* state updated via subscription */
    });
  }, [translationId]);

  return {
    policySupportsDownload: supportsFullTranslationDownload(translationId),
    isFullyDownloaded: fullyDownloaded,
    downloadState,
    startDownload,
  };
}

/** True when the device is on Wi-Fi (used for optional auto-download on pin). */
export async function isOnWifi(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (isOfflineNetInfo(state)) return false;
  return state.type === "wifi";
}
