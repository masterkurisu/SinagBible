# Changelog

All notable changes to Sinag Bible, organized by version.

---
## 1.1.0

### New features & UI
- **Journal notes** — tap Reflection to open a full-screen notes canvas. Formatting (bold, italic, headings, lists, checklists), verse mentions, and images paint in the field without markdown markers. Shrink or Android back returns to the compact preview. Nested lists and VoiceOver/TalkBack still use the previous editor.

## 1.0.0 - Public Release

### New features & UI
- **Study notes** — HelloAO commentary API integration; study-notes action shows a badge when commentary exists for the selected verses; refactored study notes sheet
- **Back to top FAB** — reader scroll-to-top button with idle fade, fling-aware reveal, and haptic feedback
- **Verse copy** — clipboard copy includes the correct translation abbreviation with the reference

### Fixes
- **Search** — YouVersion translations (NIV, etc.) now show verse text from the active translation instead of KJV keyword hits
- **Reader selection** — verse selection clears when leaving the reader tab or interacting with the app bar
- **Journal container transform** — entry detail morph transition crash fixes; safer reflection HTML rendering and loading state

### Infrastructure
- Metro config — monorepo watch folders, pnpm resolution, and block `node_modules` markdown from TreeFS reload crashes
- pnpm workspace configuration updates

---

## 1.0.0.10 - Pre Release

### New features & UI
- **M3 motion system** — shared spring and duration tokens (`m3-motion.ts`); M3 springs for bottom sheets; dual scrim API for modal shells; settings menu spring tokens; reduced-motion support and token audit
- **Container transform** — reusable `ContainerTransform` overlay + host; M3 container-transform choreography for search expand/collapse; journal list → entry detail morph transition with detail preview bridge
- **Verse tags** — inline `@verse` mentions in reader notes with mention sheet, chips, preview tooltip, and tap-to-open in reader; core verse-tags grammar parser + unit tests
- **Journal reflection editor** — unified on native markdown (removed `react-native-pell-rich-editor` dependency)
- **Long-press tooltips & haptics** — action bar, inline notes, and journal tiles
- **Verse carousel** — card sizes synced with carousel settings; improved image fetch
- **Reader** — page turn button animation and position adjusted

### Fixes
- NIV footnotes leaking into verse text (audited other YouVersion translations)
- Search showed "no results" while still loading
- Verse line spacing
- Journal tiles white corners in dark themes
- Navbar closing/opening race
- Bottom chapter padding

### Performance & memory
- **Phased performance plan** (phases 0–5):
  - Timeout cleanup and journal `entryRowRefs` pruning on unmount/delete
  - Note draft state kept local to selection layer (fewer reader re-renders while typing)
  - Split tab bar scroll and settings tint into separate contexts
  - Lightweight carousel-favorites hook on reader screen
  - LRU caps on HelloAO and YVP translation search caches
  - Async abort guards and animation cleanup on unmount
- Session cache caps + dev cache snapshot helpers
- Book select performance improvements

### Other
- Dev environment migrated from Mac to PC

---

## 1.0.0.9

### New features & UI
- **Changelog viewer** — in-app changelog sheet in More menu, bundled from `CHANGELOG.md`
- **Verse carousel** — image customization + customizable card sizes
- **Privacy policy** — updated and redesigned
- **Home** — removed tab-style design from top list
- **Reader app bar** — icon animations changed to jiggle
- **Journal translation labels** — passage references show translation abbreviations instead of raw IDs (list, detail, and new entry form)

### Fixes
- Missing translations
- Dismiss behavior
- Reader font lazy load
- Share logs not saving offline
- Dev client
- Matthew incorrectly placed in Old Testament
- Store key for production builds
- Reader onboarding showing repeatedly
- Highlight underlines rendering + color selection contrast
- Onboarding spotlights repositioned after SDK update

### Performance & animations
- Book select performance
- Journal performance
- General performance pass
- Reader navbar hide animation optimized
- Animation optimizations (2 passes) + animations optimizations 3

### Infrastructure
- **Expo SDK 56 → 57** (v1.0.0.9) + SDK update finished

---

## 1.0.0.8

### New features
- **Import/export** — backup & restore user data (`ReaderDataBackupSheet`, `user-data-backup.ts`, import sync)
- **Offline reading overhaul** — chapter store, translation downloads, pinned translation prefetch, network connectivity checks, YVP attribution footer
- **Highlight styles** — underline & squiggly annotation styles (`ReaderAnnotationSheet`, overlay rendering)
- **New reader themes** — expanded theme tokens; improved dark-theme text contrast
- **Journal carousel settings** — image mapping & carousel customization tweaks
- **Delete entry dialog** — new journal entry deletion flow

### UI & components
- Updated M3 components (snackbar, bottom sheets, settings sheets)
- Reader settings & more-settings sheets redesigned
- Translation loading overlay improvements
- Import/export animation polish

### Fixes
- Import animations
- Journal coachmarks & swipe interaction
- Carousel image display (Pexels mapping/repository)
- Delete-my-data dialog — added backup reminder before deletion

### Performance
- Major reader performance pass (chapter caching, verse row rendering, API service)

### Other
- Android dev build config updates (`MainActivity`/`MainApplication` moved to `dev` package)
- Native tab chrome adjustments

---

## 1.0.0.7

### Fixes
- **Journal editing** — fixed save/edit flow so detail view updates correctly after editing; improved pending-entry bridge between edit and detail screens; refactored new-entry form and local storage handling
- **Carousel & daily verse images** — fixed Pexels API key not loading in production builds (`EXPO_PUBLIC_PEXELS_API_KEY` fallback + improved config resolution)

### Other
- Added **prepublish checklist** script and release checklist entry for Pexels key validation

---

## 1.0.0.6

Major **Material Design 3 redesign** across the app.

### Material 3 redesign
- **Navbar** — full M3 bottom nav redesign; search as expanding FAB button
- **Reader** — app bar added; settings panel moved to left side sheet; font/more settings redesigned; M3 animations; book picker → bottom sheet
- **Journal** — M3 cards, FAB, app bar, filter side sheet with date picker, new entry → bottom sheet
- **Search** — full M3 redesign; added journal search
- **Themes** — M3 theme picker; themes now apply to home page
- **Dialogs & sheets** — delete dialog, inline note modal, credits, study notes, sheet headings all updated to M3
- **Home page** — full redesign with Material design; daily verse card added

### New features
- **Verse carousel** — inspiration carousel in journal with Pexels images, daily verse, share/save/download context menu, carousel settings
- **Search improvements** — faster searches; search within active translation & language
- **Translations** — YouVersion API integration fixes; pinned translations download offline; loading animation
- **App logs** — share/export logs from more settings (`lib/app-logs.ts`)

### Fixes
- Translation picker hidden behind keyboard
- Missing YouVersion API / language filter not working
- Navbar hiding animation
- Navbar labels appearing incorrectly
- Verse carousel image re-rendering
- Reader & journal onboarding coachmark placements

### UI polish
- Haptic feedback → M3 switch
- Settings tooltip on long press (onboarding removed from settings)
- Ko-fi link moved to more modal
- Book name display in app bar adjusted
- New entry form layout cleanup

---

## 1.0.0.5

### New features
- **YouVersion Platform API** — new translation backend with NIV support (`youversion-api.ts`, language sections, default pinned translations)
- **More settings modal** — new reader settings sheet with haptic feedback toggle
- **Book picker onboarding** — coachmark for filter button
- **Language persistence** — language preference shared across journal entries and book selection

### Fixes
- Chapter bottom glitch + tab bar animation adjustments
- Search → reader navigation cutting off verses at top of screen
- Home page buttons not navigating to correct pages
- Reader re-rendering while scrolling

### UI & performance
- Translation picker — trimmed available list, improved pin contrast
- Font settings slider labels adjusted
- Animations optimized for 120Hz displays
- Tab bar auto-hide behavior improved

### Other
- Journal editor onboarding updates (tied to translation/language changes)

---

## 1.0.0.4

### Infrastructure
- **Expo SDK 54 → 56** — Hermes v1, RN 0.85, React 19.2, React Navigation import fixes, MediaLibrary API migration
- iOS prebuild cleanup; removed legacy Quietscript artifacts
- RAM management improvements for 4GB Android devices

### New features & performance
- **Reader refactor** — extracted `ReaderSelectionLayer`, `BookPickerSheet`, `TranslationPickerSheet`, `ReaderFontSettingsSheet`; slimmed down `ReaderModals`
- **Hooks extraction** — `useReaderChapter` and `useReaderPreferences` pulled out of reader screen
- **Search enhancements** — quick picks, expanded translation metadata, improved search screen
- **Reader tab bar auto-hide** — hides on scroll with new visibility context
- **Font lazy loading** — fonts load on demand instead of at startup

### UI & onboarding
- **Spotlights & coachmarks** — aligned for various device sizes; new onboarding target measurement system
- **Page turn arrows** — adjusted opacity, size, timeout, and padding
- **Android tablet** — fixed layout, landscape support, 2-column reader view
- Action bar sizing fixed post-SDK upgrade
- Book picker defaults to currently open book
- Journal new entry button moved back to bottom; form position adjusted

### Fixes
- Journal entries disappearing — improved local storage and embedded image handling
- Settings panel — coachmarks no longer restart; tab bar no longer forced visible on open

---

## 1.0.0.0

Initial public release of **Sinag Bible** — a React Native / Expo Bible reader app.

### Core app (initial commit)
- **Bible reader** — chapter navigation, multiple translations, verse selection, highlights, bookmarks, notes
- **Journal** — create, edit, and view entries with verse references and embedded images
- **Search** — Bible and journal search
- **Home** — landing page with navigation to main sections
- **Reader settings** — font family/size, themes, translation picker, favorites
- **Onboarding** — intro slides for first-time users
- **Platform support** — iOS, Android, and iPad; EAS build config; Sentry crash reporting
- **Monorepo** — shared `@sinag-bible/core`, `tokens`, `types`, `ui` packages

### New features (post-initial)
- **Page turn arrows** — tap zones for previous/next chapter
- **Pill buttons** — settings and book selector in reader header
- **Feature onboarding** — spotlights and coachmarks for:
  - Reader (book selector, settings, page turn, verse select/highlight)
  - Settings panel
  - Action bar / verse selection tools
  - Journal list and editor
- **Privacy policy** — "Begin reading" on onboarding opens privacy policy

### Fixes
- EAS build fixes; dependencies installed
- iOS/iPad book selector not working
- Android book selection button issue
- Font settings not applying
- Reader text flashing on page change; render delay on non-KJV translations
- Journal entry scrolling on Android; save toasts redesigned
- Journal forms — Android reflection scrolling, iOS keyboard toggle, accidental keyboard dismissal
- Journal view dropping text near embedded images
- Journal template made uneditable
- iOS Ko-fi link restored

### Other
- Automated feature test sweep
- Onboarding scroll support for large font sizes
- Smoothed spotlight animations for book selector and settings
