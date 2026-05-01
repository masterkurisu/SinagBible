export * from "./primitives";
export * from "./app-nav-metrics";
export * from "./bottom-nav-chrome";
export * from "./search-overlay";
export * from "./journal-screen";
export * from "./journal-entry-sheet";
export * from "./skeleton";
export * from "./shadcn-forms";
export * from "./reader-chrome";
export * from "./mobile-app-theme";

import type { Primitives } from "./primitives";
import { bottomNavChrome } from "./bottom-nav-chrome";
import { searchOverlay } from "./search-overlay";
import { journalScreen } from "./journal-screen";
import { journalEntrySheet } from "./journal-entry-sheet";
import { skeleton } from "./skeleton";
import { shadcnButton, shadcnCard, shadcnInput } from "./shadcn-forms";
import { readerChrome } from "./reader-chrome";

/** Grouped UI surfaces for convenience (mobile imports). */
export const ui = {
  bottomNavChrome,
  searchOverlay,
  journalScreen,
  journalEntrySheet,
  skeleton,
  readerChrome,
  forms: {
    button: shadcnButton,
    input: shadcnInput,
    card: shadcnCard,
  },
} as const;

/** @deprecated Use `Primitives` — retained for older `Tokens` name */
export type Tokens = Primitives;
