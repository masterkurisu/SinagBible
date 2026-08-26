export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return new Uint8Array(byteCount);
}
