import { formatBookLabel } from "@sinag-bible/core";
import type { ReaderLastPosition } from "@/lib/reader-last-position";

export type SearchQuickPick = {
  ref: string;
  excerpt: string;
};

const DEFAULT_QUICK_PICKS: SearchQuickPick[] = [
  { ref: "Mark 11:22", excerpt: "And Jesus answering saith…" },
  { ref: "John 3:16", excerpt: "For God so loved…" },
  { ref: "Psalm 23", excerpt: "The Lord is my shepherd…" },
  { ref: "Romans 8", excerpt: "No condemnation…" },
  { ref: "Philippians 4:13", excerpt: "I can do all things…" },
];

const MORNING_QUICK_PICKS: SearchQuickPick[] = [
  { ref: "Psalm 5:3", excerpt: "Morning prayer…" },
  { ref: "Psalm 143:8", excerpt: "Cause me to hear thy lovingkindness…" },
  { ref: "Lamentations 3:23", excerpt: "Great is thy faithfulness…" },
  { ref: "Psalm 90:14", excerpt: "Satisfy us early with thy mercy…" },
  { ref: "Psalm 19:14", excerpt: "Let the words of my mouth…" },
];

const EVENING_QUICK_PICKS: SearchQuickPick[] = [
  { ref: "Psalm 4:8", excerpt: "In peace I will lie down…" },
  { ref: "Psalm 121:4", excerpt: "He that keepeth Israel…" },
  { ref: "Psalm 31:5", excerpt: "Into thine hand I commit…" },
  { ref: "Psalm 139:23", excerpt: "Search me, O God…" },
  { ref: "Psalm 23", excerpt: "The Lord is my shepherd…" },
];

const QUICK_PICK_CAP = 5;

function timeOfDayBucket(): "morning" | "evening" | "day" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 18 || hour < 5) return "evening";
  return "day";
}

function readerContinuePick(position: ReaderLastPosition | null): SearchQuickPick | null {
  if (!position?.bookSlug || position.chapter < 1) return null;
  const bookLabel = formatBookLabel(position.bookSlug);
  return {
    ref: `${bookLabel} ${position.chapter}`,
    excerpt: "Continue reading…",
  };
}

/** Blend recent searches, last reader position, and time-of-day picks (max 5). */
export function buildSearchQuickPicks(options: {
  recentQueries: string[];
  lastReaderPosition: ReaderLastPosition | null;
}): SearchQuickPick[] {
  const out: SearchQuickPick[] = [];
  const seen = new Set<string>();

  const push = (pick: SearchQuickPick): void => {
    const key = pick.ref.trim().toLowerCase();
    if (!key || seen.has(key) || out.length >= QUICK_PICK_CAP) return;
    seen.add(key);
    out.push(pick);
  };

  for (const q of options.recentQueries) {
    const trimmed = q.trim();
    if (trimmed.length < 2) continue;
    push({ ref: trimmed, excerpt: "Recent search" });
    if (out.length >= 2) break;
  }

  const continuePick = readerContinuePick(options.lastReaderPosition);
  if (continuePick) push(continuePick);

  const bucket = timeOfDayBucket();
  const themed =
    bucket === "morning"
      ? MORNING_QUICK_PICKS
      : bucket === "evening"
        ? EVENING_QUICK_PICKS
        : DEFAULT_QUICK_PICKS;

  for (const pick of themed) {
    push(pick);
    if (out.length >= QUICK_PICK_CAP) break;
  }

  if (out.length < QUICK_PICK_CAP) {
    for (const pick of DEFAULT_QUICK_PICKS) {
      push(pick);
      if (out.length >= QUICK_PICK_CAP) break;
    }
  }

  return out;
}
