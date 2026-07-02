import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { cacheDirectory, EncodingType, writeAsStringAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type AppLogLevel = "log" | "info" | "warn" | "error" | "debug";

export type AppLogEntry = {
  id: number;
  timestamp: string;
  level: AppLogLevel;
  message: string;
};

const MAX_ENTRIES = 2500;
const PERSIST_STORAGE_KEY = "sb:app-logs" as const;
const PERSIST_DEBOUNCE_MS = 1500;

let nextId = 1;
const entries: AppLogEntry[] = [];
let installed = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

type ConsoleMethod = (...args: unknown[]) => void;

const originalConsole: Record<AppLogLevel, ConsoleMethod> = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function serializeValue(value: unknown): string {
  if (value == null) return String(value);
  if (value instanceof Error) {
    const stack = value.stack?.trim();
    return stack ? `${value.name}: ${value.message}\n${stack}` : `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function formatLogArgs(args: unknown[]): string {
  return args.map(serializeValue).join(" ");
}

function appendLog(level: AppLogLevel, args: unknown[]): void {
  const message = formatLogArgs(args);
  if (!message.trim()) return;

  entries.push({
    id: nextId++,
    timestamp: new Date().toISOString(),
    level,
    message,
  });

  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  schedulePersist();
}

function schedulePersist(): void {
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistLogs().catch(() => {});
  }, PERSIST_DEBOUNCE_MS);
}

async function persistLogs(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERSIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore — in-memory logs still available for export
  }
}

async function restorePersistedLogs(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as AppLogEntry[];
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed.slice(-MAX_ENTRIES)) {
      if (
        typeof entry?.id === "number" &&
        typeof entry.timestamp === "string" &&
        typeof entry.level === "string" &&
        typeof entry.message === "string"
      ) {
        entries.push(entry);
        nextId = Math.max(nextId, entry.id + 1);
      }
    }
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
  } catch {
    // ignore corrupt snapshot
  }
}

function wrapConsoleMethod(level: AppLogLevel): ConsoleMethod {
  return (...args: unknown[]) => {
    appendLog(level, args);
    originalConsole[level](...args);
  };
}

function installGlobalErrorHandler(): void {
  const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void; setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void } }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    appendLog("error", [
      isFatal ? "[fatal]" : "[unhandled]",
      error instanceof Error ? error : serializeValue(error),
    ]);
    previousHandler?.(error, isFatal);
  });
}

export function logAppEvent(tag: string, detail?: Record<string, unknown>): void {
  if (detail) {
    appendLog("info", [`[${tag}]`, detail]);
    return;
  }
  appendLog("info", [`[${tag}]`]);
}

export function getAppLogEntries(): readonly AppLogEntry[] {
  return entries;
}

function buildExportHeader(): string {
  const expoConfig = Constants.expoConfig;
  const appVersion = expoConfig?.version ?? "unknown";
  const buildNumber =
    Platform.OS === "ios"
      ? expoConfig?.ios?.buildNumber
      : expoConfig?.android?.versionCode?.toString();
  const deviceModel = Device.modelName ?? Device.deviceName ?? "unknown";
  const osVersion = Device.osVersion ?? Platform.Version?.toString() ?? "unknown";

  return [
    "Sinag Bible — diagnostic log export",
    `Exported: ${new Date().toISOString()}`,
    `App version: ${appVersion}${buildNumber ? ` (${buildNumber})` : ""}`,
    `Environment: ${process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? "development" : "production")}`,
    `Platform: ${Platform.OS} ${osVersion}`,
    `Device: ${deviceModel}`,
    `Device type: ${Device.deviceType ?? "unknown"}`,
    `Entry count: ${entries.length}`,
    "",
    "----- logs -----",
    "",
  ].join("\n");
}

export function buildAppLogsExportText(): string {
  const body = entries
    .map((entry) => `${entry.timestamp} [${entry.level}] ${entry.message}`)
    .join("\n");
  return `${buildExportHeader()}${body}\n`;
}

function buildExportFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `sinag-bible-logs-${stamp}.txt`;
}

export type ShareAppLogsResult = "shared" | "unavailable" | "failed";

export async function shareAppLogs(): Promise<ShareAppLogsResult> {
  logAppEvent("app-logs:export-requested", { entryCount: entries.length });

  if (!(await Sharing.isAvailableAsync())) {
    return "unavailable";
  }

  if (!cacheDirectory) {
    return "failed";
  }

  const uri = `${cacheDirectory}${buildExportFilename()}`;

  try {
    await writeAsStringAsync(uri, buildAppLogsExportText(), { encoding: EncodingType.UTF8 });
    await Sharing.shareAsync(uri, {
      mimeType: "text/plain",
      dialogTitle: "Save Sinag Bible logs",
      UTI: "public.plain-text",
    });
    logAppEvent("app-logs:export-shared");
    return "shared";
  } catch (error) {
    appendLog("error", ["[app-logs:export-failed]", error instanceof Error ? error : String(error)]);
    return "failed";
  }
}

export function initAppLogs(): void {
  if (installed) return;
  installed = true;

  console.log = wrapConsoleMethod("log");
  console.info = wrapConsoleMethod("info");
  console.warn = wrapConsoleMethod("warn");
  console.error = wrapConsoleMethod("error");
  console.debug = wrapConsoleMethod("debug");

  installGlobalErrorHandler();

  void restorePersistedLogs().finally(() => {
    logAppEvent("app-logs:initialized", { restoredEntryCount: entries.length });
  });
}
