export function openDatabaseSync(): never {
  throw new Error("expo-sqlite stub: openDatabaseSync");
}

export async function deleteDatabaseAsync(): Promise<void> {
  /* no-op in unit tests */
}
