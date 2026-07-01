/**
 * Pexels search API — https://www.pexels.com/api/documentation/
 *
 * GET /v1/search?query={keyword}&orientation=landscape&per_page={n}&page={page}
 * Header: Authorization: {PEXELS_API_KEY}
 */
import { getPexelsApiKey } from "@/lib/pexels-config";

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const PEXELS_API_TIMEOUT_MS = 12_000;

type PexelsPhotoSrc = {
  large2x?: string;
  large?: string;
  original?: string;
};

type PexelsSearchResponse = {
  photos?: Array<{
    src?: PexelsPhotoSrc;
  }>;
};

function photoToUrl(src: PexelsPhotoSrc | undefined): string | null {
  return src?.large2x ?? src?.large ?? src?.original ?? null;
}

export async function searchPexelsImages(
  query: string,
  options?: { page?: number; perPage?: number },
): Promise<string[]> {
  const apiKey = getPexelsApiKey();
  if (!apiKey) return [];

  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 20;

  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    per_page: String(perPage),
    page: String(page),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PEXELS_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${PEXELS_SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data = (await response.json()) as PexelsSearchResponse;
    const urls: string[] = [];
    for (const photo of data.photos ?? []) {
      const url = photoToUrl(photo.src);
      if (url) urls.push(url);
    }
    return urls;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
