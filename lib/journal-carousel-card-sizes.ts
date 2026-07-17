import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "sb:journal:carousel-card-sizes";

/** Preset width for carousel cards, expressed as a fraction of screen width. */
export type CarouselCardSize = "small" | "medium" | "large";

/** Global default — either a preset or the original varied layout. */
export type CarouselDefaultCardSize = CarouselCardSize | "varied";

export const CAROUSEL_CARD_SIZE_RATIOS: Record<CarouselCardSize, number> = {
  small: 0.52,
  medium: 0.64,
  large: 0.78,
};

/** Original index-based varied layout sizes (matches WIDTH_RATIOS order). */
const VARIED_LAYOUT_CARD_SIZES: readonly CarouselCardSize[] = ["small", "large", "medium"];

export const CAROUSEL_CARD_SIZE_OPTIONS: { value: CarouselCardSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS: {
  value: CarouselDefaultCardSize;
  label: string;
}[] = [
  { value: "varied", label: "Varied" },
  ...CAROUSEL_CARD_SIZE_OPTIONS,
];

export const DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE: CarouselDefaultCardSize = "varied";

const WIDTH_RATIOS = [0.58, 0.72, 0.64] as const;

const listeners = new Set<(overrides: Record<string, CarouselCardSize>) => void>();

function notifyListeners(overrides: Record<string, CarouselCardSize>) {
  for (const listener of listeners) {
    listener(overrides);
  }
}

export function getCarouselCardSizeLabel(size: CarouselCardSize): string {
  return CAROUSEL_CARD_SIZE_OPTIONS.find((option) => option.value === size)?.label ?? size;
}

export function getCarouselDefaultCardSizeLabel(size: CarouselDefaultCardSize): string {
  return CAROUSEL_DEFAULT_CARD_SIZE_OPTIONS.find((option) => option.value === size)?.label ?? size;
}

export function normalizeCarouselDefaultCardSize(
  value: unknown,
): CarouselDefaultCardSize {
  if (
    value === "varied" ||
    value === "small" ||
    value === "medium" ||
    value === "large"
  ) {
    return value;
  }
  return DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE;
}

export function normalizeCarouselCardSize(value: unknown): CarouselCardSize | null {
  if (value === "small" || value === "medium" || value === "large") return value;
  return null;
}

export function resolveCarouselWidthRatio(
  verseId: string,
  layoutIndex: number,
  overrides: Readonly<Record<string, CarouselCardSize>>,
  defaultCardSize: CarouselDefaultCardSize = DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE,
): number {
  const override = overrides[verseId];
  if (override) return CAROUSEL_CARD_SIZE_RATIOS[override];
  if (defaultCardSize !== "varied") return CAROUSEL_CARD_SIZE_RATIOS[defaultCardSize];
  return WIDTH_RATIOS[layoutIndex % WIDTH_RATIOS.length]!;
}

export function getEffectiveCarouselCardSize(
  verseId: string,
  layoutIndex: number,
  overrides: Readonly<Record<string, CarouselCardSize>>,
  defaultCardSize: CarouselDefaultCardSize = DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE,
): CarouselCardSize {
  const override = overrides[verseId];
  if (override) return override;
  if (defaultCardSize !== "varied") return defaultCardSize;
  return VARIED_LAYOUT_CARD_SIZES[layoutIndex % VARIED_LAYOUT_CARD_SIZES.length]!;
}

export function hasCarouselCardSizeOverride(
  verseId: string,
  overrides: Readonly<Record<string, CarouselCardSize>>,
): boolean {
  return overrides[verseId] != null;
}

/** Size this card would use with no per-verse override (global default or varied layout). */
export function getCarouselCardSizeWithoutOverride(
  verseId: string,
  layoutIndex: number,
  defaultCardSize: CarouselDefaultCardSize = DEFAULT_CAROUSEL_DEFAULT_CARD_SIZE,
): CarouselCardSize {
  return getEffectiveCarouselCardSize(verseId, layoutIndex, {}, defaultCardSize);
}

export function countCarouselCardSizeOverrides(
  overrides: Readonly<Record<string, CarouselCardSize>>,
): number {
  return Object.keys(overrides).length;
}

function normalizeOverrides(raw: unknown): Record<string, CarouselCardSize> {
  if (!raw || typeof raw !== "object") return {};
  const next: Record<string, CarouselCardSize> = {};
  for (const [verseId, value] of Object.entries(raw)) {
    const size = normalizeCarouselCardSize(value);
    if (size) next[verseId] = size;
  }
  return next;
}

export function subscribeCarouselCardSizes(
  listener: (overrides: Record<string, CarouselCardSize>) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadCarouselCardSizes(): Promise<Record<string, CarouselCardSize>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return normalizeOverrides(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function saveCarouselCardSizes(
  overrides: Record<string, CarouselCardSize>,
): Promise<Record<string, CarouselCardSize>> {
  const next = normalizeOverrides(overrides);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notifyListeners(next);
  return next;
}

export async function clearCarouselCardSizes(): Promise<Record<string, CarouselCardSize>> {
  return saveCarouselCardSizes({});
}

export async function patchCarouselCardSize(
  verseId: string,
  size: CarouselCardSize,
): Promise<Record<string, CarouselCardSize>> {
  const current = await loadCarouselCardSizes();
  return saveCarouselCardSizes({ ...current, [verseId]: size });
}

export async function removeCarouselCardSize(
  verseId: string,
): Promise<Record<string, CarouselCardSize>> {
  const current = await loadCarouselCardSizes();
  if (!current[verseId]) return current;
  const next = { ...current };
  delete next[verseId];
  return saveCarouselCardSizes(next);
}
