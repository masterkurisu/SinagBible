const files = new Map<string, string>();

export async function getInfoAsync(path: string): Promise<{ exists: boolean }> {
  return { exists: files.has(path) };
}

export async function moveAsync({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<void> {
  const value = files.get(from);
  if (value !== undefined) {
    files.set(to, value);
    files.delete(from);
  } else {
    files.set(to, "1");
    files.delete(from);
  }
}

export function resetMockFileSystem(): void {
  files.clear();
}

export function seedMockFile(path: string): void {
  files.set(path, "1");
}
