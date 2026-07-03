import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/** True when the device has no usable network (offline for reader fetch purposes). */
export function isOfflineNetInfo(state: NetInfoState): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

export async function isDeviceOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isOfflineNetInfo(state);
}
