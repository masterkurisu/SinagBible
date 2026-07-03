import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HighlightColor, LocalJournalEntry, VerseAnnotation } from "@sinag-bible/types";
import { isHighlightColor, parseStoredVerseAnnotation } from "@sinag-bible/types";
import * as DocumentPicker from "expo-document-picker";
import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  makeDirectoryAsync,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { logAppEvent } from "@/lib/app-logs";
import { inlineContentImagesForExport } from "@/lib/journal-content-images";
import {
  getLocalEntries,
  isSampleJournalEntry,
  replaceAllLocalEntries,
} from "@/lib/journal-local";
import {
  loadCarouselFavorites,
  replaceCarouselFavorites,
  type CarouselVerseRecord,
} from "@/lib/journal-carousel-verses";
import {
  annotationsFromLegacyHighlights,
  exportAllReaderChapterAnnotations,
  importAllReaderChapterAnnotations,
  type ReaderChapterAnnotationExport,
} from "@/lib/use-reader-storage";

export const USER_DATA_BACKUP_FORMAT = "sinag-bible-user-data" as const;
export const USER_DATA_BACKUP_SCHEMA_VERSION = 2 as const;
/** Legacy backup schema — still accepted on import. */
export const USER_DATA_BACKUP_SCHEMA_VERSION_V1 = 1 as const;

export type UserDataBackup = {
  format: typeof USER_DATA_BACKUP_FORMAT;
  schemaVersion: typeof USER_DATA_BACKUP_SCHEMA_VERSION | typeof USER_DATA_BACKUP_SCHEMA_VERSION_V1;
  exportedAt: string;
  journalEntries: LocalJournalEntry[];
  favoriteVerses: CarouselVerseRecord[];
  readerChapters: ReaderChapterAnnotationExport[];
};

/** @deprecated Use UserDataBackup */
export type UserDataBackupV1 = UserDataBackup;

export type UserDataBackupResult = "shared" | "unavailable" | "failed";
export type UserDataSaveResult = "saved" | "cancelled" | "failed";
export type UserDataImportResult = "imported" | "cancelled" | "invalid" | "failed";

const BACKUP_SAVE_DIRECTORY_URI_KEY = "sb:backup-save-directory-uri";

function parseLegacyHighlightsRecord(value: unknown): Record<number, HighlightColor> {
  if (!value || typeof value !== "object") return {};
  const next: Record<number, HighlightColor> = {};
  for (const [key, color] of Object.entries(value as Record<string, unknown>)) {
    const verse = parseInt(key, 10);
    if (Number.isFinite(verse) && isHighlightColor(color)) {
      next[verse] = color;
    }
  }
  return next;
}

function parseAnnotationsRecord(value: unknown): Record<number, VerseAnnotation> {
  if (!value || typeof value !== "object") return {};
  const next: Record<number, VerseAnnotation> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const verse = parseInt(key, 10);
    if (!Number.isFinite(verse)) continue;
    const annotation = parseStoredVerseAnnotation(raw);
    if (annotation) next[verse] = annotation;
  }
  return next;
}

function isLocalJournalEntry(value: unknown): value is LocalJournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as LocalJournalEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.book === "string" &&
    typeof entry.chapter === "number" &&
    typeof entry.content === "string" &&
    typeof entry.created_at === "string"
  );
}

function isCarouselVerseRecord(value: unknown): value is CarouselVerseRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as CarouselVerseRecord;
  return (
    typeof record.id === "string" &&
    typeof record.bookSlug === "string" &&
    typeof record.bookName === "string" &&
    typeof record.chapter === "number" &&
    typeof record.verseStart === "number" &&
    typeof record.text === "string" &&
    typeof record.translationId === "string" &&
    typeof record.reference === "string" &&
    typeof record.addedAt === "string"
  );
}

function normalizeReaderChapterExport(value: unknown): ReaderChapterAnnotationExport | null {
  if (!value || typeof value !== "object") return null;
  const chapter = value as Partial<ReaderChapterAnnotationExport> & {
    highlights?: unknown;
    annotations?: unknown;
  };
  if (
    typeof chapter.bookSlug !== "string" ||
    typeof chapter.chapter !== "number" ||
    typeof chapter.translationId !== "string"
  ) {
    return null;
  }

  const notes = parseNotesRecord(chapter.notes);
  const annotations =
    chapter.annotations != null
      ? parseAnnotationsRecord(chapter.annotations)
      : chapter.highlights != null
        ? annotationsFromLegacyHighlights(parseLegacyHighlightsRecord(chapter.highlights))
        : {};

  return {
    bookSlug: chapter.bookSlug,
    chapter: chapter.chapter,
    translationId: chapter.translationId,
    annotations,
    notes,
  };
}

function parseNotesRecord(value: unknown): Record<number, string> {
  if (!value || typeof value !== "object") return {};
  const next: Record<number, string> = {};
  for (const [key, note] of Object.entries(value as Record<string, unknown>)) {
    const verse = parseInt(key, 10);
    if (Number.isFinite(verse) && typeof note === "string" && note.trim()) {
      next[verse] = note;
    }
  }
  return next;
}

function parseUserDataBackup(raw: string): UserDataBackup | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const backup = parsed as Partial<UserDataBackup>;

  if (backup.format !== USER_DATA_BACKUP_FORMAT) return null;
  if (
    backup.schemaVersion !== USER_DATA_BACKUP_SCHEMA_VERSION &&
    backup.schemaVersion !== USER_DATA_BACKUP_SCHEMA_VERSION_V1
  ) {
    return null;
  }
  if (!Array.isArray(backup.journalEntries)) return null;
  if (!Array.isArray(backup.favoriteVerses)) return null;
  if (!Array.isArray(backup.readerChapters)) return null;

  const journalEntries = backup.journalEntries.filter(isLocalJournalEntry);
  const favoriteVerses = backup.favoriteVerses.filter(isCarouselVerseRecord);
  const readerChapters = backup.readerChapters
    .map((chapter) => normalizeReaderChapterExport(chapter))
    .filter((chapter): chapter is ReaderChapterAnnotationExport => chapter != null)
    .filter(
      (chapter) =>
        Object.keys(chapter.annotations).length > 0 || Object.keys(chapter.notes).length > 0,
    );

  return {
    format: USER_DATA_BACKUP_FORMAT,
    schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : new Date().toISOString(),
    journalEntries,
    favoriteVerses,
    readerChapters,
  };
}

async function buildUserDataBackup(): Promise<UserDataBackup> {
  const [journalEntries, favoriteVerses, readerChapters] = await Promise.all([
    getLocalEntries(),
    loadCarouselFavorites(),
    exportAllReaderChapterAnnotations(),
  ]);

  const portableEntries = await Promise.all(
    journalEntries
      .filter((entry) => !isSampleJournalEntry(entry.id))
      .map(async (entry) => ({
        ...entry,
        content: await inlineContentImagesForExport(entry.content),
      })),
  );

  return {
    format: USER_DATA_BACKUP_FORMAT,
    schemaVersion: USER_DATA_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    journalEntries: portableEntries,
    favoriteVerses,
    readerChapters,
  };
}

function buildExportFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `sinag-bible-backup-${stamp}.json`;
}

function backupBaseName(filename: string): string {
  return filename.replace(/\.json$/i, "");
}

async function buildBackupJson(): Promise<{ json: string; backup: UserDataBackup; filename: string }> {
  const backup = await buildUserDataBackup();
  return {
    backup,
    json: JSON.stringify(backup, null, 2),
    filename: buildExportFilename(),
  };
}

async function writeBackupToCacheFile(json: string, filename: string): Promise<string | null> {
  if (!cacheDirectory) return null;
  const uri = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(uri, json, { encoding: EncodingType.UTF8 });
  return uri;
}

async function getOrRequestAndroidSaveDirectoryUri(): Promise<string | null> {
  const cached = await AsyncStorage.getItem(BACKUP_SAVE_DIRECTORY_URI_KEY);
  if (cached) return cached;

  const downloadsUri = StorageAccessFramework.getUriForDirectoryInRoot("Download");
  const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
  if (!permissions.granted) return null;

  await AsyncStorage.setItem(BACKUP_SAVE_DIRECTORY_URI_KEY, permissions.directoryUri);
  return permissions.directoryUri;
}

async function saveBackupToAndroidDevice(
  json: string,
  filename: string,
): Promise<UserDataSaveResult> {
  let directoryUri = await getOrRequestAndroidSaveDirectoryUri();
  if (!directoryUri) return "cancelled";

  const writeToDirectory = async (parentUri: string): Promise<void> => {
    const fileUri = await StorageAccessFramework.createFileAsync(
      parentUri,
      backupBaseName(filename),
      "application/json",
    );
    await writeAsStringAsync(fileUri, json, { encoding: EncodingType.UTF8 });
  };

  try {
    await writeToDirectory(directoryUri);
    return "saved";
  } catch (error) {
    logAppEvent("user-data-backup:android-save-retry", {
      error: error instanceof Error ? error.message : String(error),
    });
    await AsyncStorage.removeItem(BACKUP_SAVE_DIRECTORY_URI_KEY);
    directoryUri = await getOrRequestAndroidSaveDirectoryUri();
    if (!directoryUri) return "cancelled";
    try {
      await writeToDirectory(directoryUri);
      return "saved";
    } catch (retryError) {
      logAppEvent("user-data-backup:android-save-failed", {
        error: retryError instanceof Error ? retryError.message : String(retryError),
      });
      return "failed";
    }
  }
}

async function saveBackupToIosDevice(json: string, filename: string): Promise<UserDataSaveResult> {
  if (!documentDirectory) return "failed";
  const dir = `${documentDirectory}backups/`;
  await makeDirectoryAsync(dir, { intermediates: true });
  await writeAsStringAsync(`${dir}${filename}`, json, { encoding: EncodingType.UTF8 });
  return "saved";
}

export async function saveUserDataToDevice(): Promise<UserDataSaveResult> {
  logAppEvent("user-data-backup:save-requested");

  try {
    const { json, backup, filename } = await buildBackupJson();
    const result =
      Platform.OS === "android"
        ? await saveBackupToAndroidDevice(json, filename)
        : await saveBackupToIosDevice(json, filename);

    if (result === "saved") {
      logAppEvent("user-data-backup:saved", {
        journalCount: backup.journalEntries.length,
        favoriteCount: backup.favoriteVerses.length,
        readerChapterCount: backup.readerChapters.length,
        platform: Platform.OS,
      });
    }
    return result;
  } catch (error) {
    logAppEvent("user-data-backup:save-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}

export async function shareUserData(): Promise<UserDataBackupResult> {
  logAppEvent("user-data-backup:share-requested");

  if (!(await Sharing.isAvailableAsync())) {
    return "unavailable";
  }

  try {
    const { json, backup, filename } = await buildBackupJson();
    const uri = await writeBackupToCacheFile(json, filename);
    if (!uri) return "failed";

    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Share Sinag Bible backup",
      UTI: "public.json",
    });
    logAppEvent("user-data-backup:export-shared", {
      journalCount: backup.journalEntries.length,
      favoriteCount: backup.favoriteVerses.length,
      readerChapterCount: backup.readerChapters.length,
    });
    return "shared";
  } catch (error) {
    logAppEvent("user-data-backup:export-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}

/** @deprecated Use {@link shareUserData} or {@link saveUserDataToDevice} instead. */
export async function exportUserData(): Promise<UserDataBackupResult> {
  return shareUserData();
}

async function applyUserDataBackup(backup: UserDataBackupV1): Promise<void> {
  await Promise.all([
    replaceAllLocalEntries(backup.journalEntries),
    replaceCarouselFavorites(backup.favoriteVerses),
    importAllReaderChapterAnnotations(backup.readerChapters),
  ]);

  await AsyncStorage.setItem("sinagbible_sample_journal_entry_dismissed", "1");
}

export type PickImportBackupResult =
  | { status: "cancelled" }
  | { status: "picked"; uri: string };

export class ImportBackupCancelledError extends Error {
  constructor() {
    super("Import cancelled");
    this.name = "ImportBackupCancelledError";
  }
}

export class ImportBackupInvalidError extends Error {
  constructor() {
    super("Invalid backup file");
    this.name = "ImportBackupInvalidError";
  }
}

export class ImportBackupFailedError extends Error {
  constructor(cause?: unknown) {
    super("Import failed");
    this.name = "ImportBackupFailedError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

async function readBackupFileContents(uri: string): Promise<string> {
  try {
    return await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
  } catch {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to read backup file (${response.status})`);
    }
    return await response.text();
  }
}

/** Opens the system file picker for a backup JSON file. */
export async function pickImportBackupFile(): Promise<PickImportBackupResult> {
  logAppEvent("user-data-backup:import-requested");

  let pickerResult: DocumentPicker.DocumentPickerResult;
  try {
    pickerResult = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: false,
      multiple: false,
    });
  } catch (error) {
    logAppEvent("user-data-backup:import-picker-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ImportBackupFailedError(error);
  }

  if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
    return { status: "cancelled" };
  }

  return { status: "picked", uri: pickerResult.assets[0].uri };
}

/** Reads, validates, and applies a backup file from a local URI. */
export async function applyImportBackupFromUri(uri: string): Promise<void> {
  try {
    const raw = await readBackupFileContents(uri);
    const backup = parseUserDataBackup(raw);
    if (!backup) {
      throw new ImportBackupInvalidError();
    }

    let sourceSchemaVersion: number | undefined;
    try {
      const parsed = JSON.parse(raw) as { schemaVersion?: unknown };
      if (typeof parsed.schemaVersion === "number") {
        sourceSchemaVersion = parsed.schemaVersion;
      }
    } catch {
      /* ignore — parseUserDataBackup already validated */
    }

    await applyUserDataBackup(backup);
    logAppEvent("user-data-backup:imported", {
      journalCount: backup.journalEntries.length,
      favoriteCount: backup.favoriteVerses.length,
      readerChapterCount: backup.readerChapters.length,
      sourceSchemaVersion,
      migratedFromV1: sourceSchemaVersion === USER_DATA_BACKUP_SCHEMA_VERSION_V1,
    });
  } catch (error) {
    if (error instanceof ImportBackupInvalidError) {
      throw error;
    }
    logAppEvent("user-data-backup:import-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ImportBackupFailedError(error);
  }
}

export async function importUserData(): Promise<UserDataImportResult> {
  try {
    const pickResult = await pickImportBackupFile();
    if (pickResult.status === "cancelled") {
      return "cancelled";
    }

    await applyImportBackupFromUri(pickResult.uri);
    return "imported";
  } catch (error) {
    if (error instanceof ImportBackupInvalidError) {
      return "invalid";
    }
    return "failed";
  }
}
