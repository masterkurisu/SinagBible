# Android R8 Optimization — Implementation Plan

> **Goal:** Enable R8 code shrinking and resource shrinking for production Android
> builds to address the Google Play Console recommendation, reduce AAB size, and
> improve native memory/startup performance.
>
> **Scope:** Config + release QA only. No JS bundle changes. No iOS impact.
>
> **Stack context:** Expo SDK 57, React Native 0.86, EAS managed workflow (no
> committed `android/` folder), production profile builds an app bundle.

---

## Current state

| Item | Status |
|------|--------|
| `expo-build-properties` plugin | Not installed |
| `enableMinifyInReleaseBuilds` | Not set (R8 off in release) |
| `enableShrinkResourcesInReleaseBuilds` | Not set |
| `extraProguardRules` | None |
| Previous native customization | `android.enableR8FullMode=true` existed in an older `gradle.properties` snapshot but was removed during the SDK 56→57 migration |

**Implication:** Production AABs are likely built without R8 minification. Debug/dev
builds are unaffected either way — R8 only applies to release builds.

---

## What R8 will change

### Benefits (expected)

- Smaller download size (native Java/Kotlin footprint; JS bundle unchanged)
- Lower memory use and modest startup improvement
- Code obfuscation for native Android classes (not a security boundary, but a plus)
- Clears the Play Console “enable R8 optimization” recommendation

### Risks (must test)

- **Release-only crashes** when R8 strips classes accessed via reflection
- **Unreadable crash stacks** without mapping files uploaded to Sentry
- **Edge-to-edge layout regression** — reported in some Expo projects when minify is
  enabled without correct keep rules (test Android 14 and 15)
- **Longer EAS build times** (minor)

### What R8 does *not* affect

- Metro JS bundle size or Hermes bytecode
- iOS builds
- Expo Go / development client debug behavior

---

## Strategy

Use a **phased rollout**: enable minification first, validate on a real device, then
add resource shrinking. Keep ProGuard rules minimal at first and grow only when
release QA finds crashes.

```text
Phase 1 — Baseline measurement (no R8)
Phase 2 — Enable R8 minify only
Phase 3 — Release QA on internal/preview build
Phase 4 — Add resource shrinking (optional, after minify is stable)
Phase 5 — Production release + monitor Sentry
```

Do **not** ship R8 to production until a full internal QA pass on a **release**
build (not dev client) passes.

---

## Phase 1 — Baseline measurement

Before changing config, record numbers from the current production AAB so we can
compare after R8.

**Status:** Complete (2026-08-04). No R8 config changes were made.

### Steps

1. Download the current production AAB from Play Console or the latest successful
   EAS production build.
2. Note:
   - AAB file size (MB)
   - Play Console “App size” breakdown if available
   - Cold-start feel on a mid-range Android device (informal)
3. Save the EAS build ID for reference.

### Recorded baseline (pre-R8)

| Field | Value |
|-------|-------|
| EAS build ID | `7bc1bd79-17a9-45e4-9f41-8ba8ea89e560` |
| Build URL | [expo.dev build](https://expo.dev/accounts/sinagbibles-organization/projects/sinag-bible/builds/7bc1bd79-17a9-45e4-9f41-8ba8ea89e560) |
| AAB artifact | [download](https://expo.dev/artifacts/eas/0oIqkfplF8dAu4SE-rFofj86Xg8ywd0gHYtWJ8u9tcM.aab) |
| App version | 1.0.0 (version code 33) |
| SDK | Expo 57.0.0 |
| Git commit | `b7100e976dc53d831d793fad06cecbba631a94bf` |
| Build date | 2026-07-28 |
| R8 minify | Off (no `expo-build-properties` plugin) |
| AAB file size | **131.81 MB** (138,214,396 bytes) |
| AAB uncompressed (zip entries) | 365.34 MB |

**AAB module breakdown** (from local archive inspection):

| Module / path | Size (MB) | Notes |
|---------------|-----------|-------|
| `base/lib/` (native `.so`) | 111.10 | Largest slice; R8 may trim JNI/Java glue indirectly |
| `base/res/` | 56.78 | Resource shrinking target in Phase 4 |
| `base/dex/` | 45.78 | Primary R8 minify target in Phase 2 |
| `base/assets/` | 24.82 | JS bundle + app assets (R8 does not touch) |
| `BUNDLE-METADATA/` | 123.93 | Play signing / metadata (not user download) |

Local copy saved at `.r8-baseline/sinag-bible-vc33-baseline.aab` (gitignored).

**Play Console — Release delivery** (1.0.0 - Public Release, production, Jul 30 2026):

| Field | Value |
|-------|-------|
| Size for new installs | **66.5 MB** |
| Time to download | 38 seconds |
| Size for updates | No data yet |
| Install base on this release | 6.25% |
| Device availability | 18,615 devices |

**Play Console — Production vitals** (Jul 29 – Aug 2, 2026):

| Field | Value |
|-------|-------|
| User-perceived crashes | 0 |
| User-perceived crash rate | Data unavailable (sample too small) |
| User-perceived ANRs | 0 |
| User-perceived ANR rate | Data unavailable (sample too small) |
| Issues affecting users | None |

### Manual follow-ups (still open)

- [x] **Play Console download size** — 66.5 MB for new installs (recorded 2026-08-04).
- [ ] **Cold start (subjective)** — install production build on a mid-range Android 14/15
      device and note splash-to-home feel before enabling R8.
- [ ] **Sentry crash-free rate (7d)** — snapshot current rate from Sentry before Phase 5
      ship for post-R8 comparison (Play Console vitals show 0 crashes but sample is small).

### Deliverable

Fill in before/after table (at end of this doc). **Before R8** column populated below.

---

## Phase 2 — Enable R8 minify

### 2a. Install `expo-build-properties`

```bash
npx expo install expo-build-properties
```

Pin to the Expo SDK 57–compatible version via `expo install` (do not hand-pick a
major version).

### 2b. Add plugin to `app.json`

Add **after** existing plugins (order relative to Sentry is fine; Sentry plugin
can stay as-is):

```json
[
  "expo-build-properties",
  {
    "android": {
      "enableMinifyInReleaseBuilds": true
    }
  }
]
```

**Important:** Use `enableMinifyInReleaseBuilds`, not the deprecated
`enableProguardInReleaseBuilds`.

Do **not** enable `enableShrinkResourcesInReleaseBuilds` yet — add it in Phase 4
after minify-only QA passes.

### 2c. Starter ProGuard rules (conservative)

If the first release build crashes on launch or specific features, add keep rules via
`extraProguardRules` in the same plugin block. Start with this baseline only if
needed — do not add preemptively unless QA fails:

```json
[
  "expo-build-properties",
  {
    "android": {
      "enableMinifyInReleaseBuilds": true,
      "extraProguardRules": "-keepattributes SourceFile,LineNumberTable\n-keepattributes *Annotation*\n-keep class com.facebook.react.** { *; }\n-keep class com.facebook.hermes.** { *; }\n-keep class com.facebook.jni.** { *; }\n-keep class com.swmansion.reanimated.** { *; }\n-keep class com.swmansion.rnscreens.** { *; }\n-keep class expo.modules.** { *; }\n-keep class io.sentry.** { *; }\n-dontwarn io.sentry.**\n-keep class net.sqlcipher.** { *; }\n-dontwarn net.sqlcipher.**"
    }
  }
]
```

**Why these libraries matter in Sinag Bible:**

| Library | Reason |
|---------|--------|
| `react-native-reanimated` | Native worklets / JNI |
| `react-native-screens` | Native screen stack |
| `expo-modules` | Expo native module bridge |
| `@sentry/react-native` | Crash reporting + native SDK |
| `expo-sqlite` + SQLCipher | Encrypted DB native layer (`useSQLCipher: true`) |

### 2d. Verify config applied (optional local check)

If you run a local prebuild for inspection:

```bash
npx expo prebuild --platform android --clean
```

Then confirm `android/app/build.gradle` release `buildTypes` has
`minifyEnabled true`. Delete the generated `android/` folder afterward if you
want to stay fully managed — EAS Build runs prebuild on the server regardless.

### 2e. Build internal release

Use the **preview** or **production** EAS profile (not development):

```bash
eas build --platform android --profile preview
```

Prefer `preview` (APK, internal distribution) for faster sideload QA before a
production AAB upload.

---

## Phase 3 — Release QA checklist

Install the **release** APK/AAB on physical devices. Dev client builds do not
exercise R8.

### Smoke test (must pass)

- [ ] App launches past splash screen
- [ ] Onboarding / home loads
- [ ] Tab navigation (Home, Bible, Journal, Search FAB)
- [ ] Reader: open chapter, scroll, verse selection, highlights, copy
- [ ] Reader: book picker, translation picker, settings side sheet
- [ ] Reader: study notes sheet, back-to-top FAB
- [ ] Journal: list, new entry, edit entry, save, delete
- [ ] Journal: reflection editor, image attach/export
- [ ] Search: open overlay, run query, open result in reader
- [ ] Import/export backup sheet
- [ ] Theme switch (light / dark / night / noir) — status bar icon contrast
- [ ] Offline chapter load (SQLite + SQLCipher path)
- [ ] App background → foreground (no crash on resume)

### Edge-to-edge / layout (Android 14 + 15 if available)

- [ ] Status bar icons readable on all themes
- [ ] Bottom tab bar and search FAB not clipped by gesture nav
- [ ] Full-screen modals and bottom sheets align correctly (journal new entry,
      translation picker, onboarding spotlights)
- [ ] Keyboard open on journal forms does not hide critical controls

### Crash monitoring

- [ ] Trigger a test crash in a **non-production** build if possible, or verify
      Sentry receives events from a prior release
- [ ] Confirm Sentry stack traces are **symbolicated** (not obfuscated gibberish)

**Sentry note:** `disableAutoUpload: true` is set on the Sentry plugin today.
For R8, ensure mapping files reach Sentry one way or another:

- Enable auto-upload in CI/EAS when ready, **or**
- Manually upload `mapping.txt` from the EAS build artifacts after each release

Without mapping files, production crashes become hard to debug.

### If QA fails

1. Reproduce on release build; capture `adb logcat` around the crash.
2. Check EAS build artifacts for `missing_rules.txt` or R8 warnings.
3. Add targeted `-keep` rules to `extraProguardRules` (smallest rule that fixes
   the crash).
4. Rebuild preview and re-run failed test cases only.
5. Do not enable resource shrinking until minify-only is stable.

---

## Phase 4 — Resource shrinking (after minify is stable)

Once Phase 3 passes on at least one Android 14 and one Android 15 device:

```json
{
  "android": {
    "enableMinifyInReleaseBuilds": true,
    "enableShrinkResourcesInReleaseBuilds": true
  }
}
```

Re-run the full Phase 3 checklist. Resource shrinking removes unused drawables,
layouts, and strings — rare but can break apps that load resources by dynamic name.

---

## Phase 5 — Production release

### Pre-ship

- [ ] Preview QA checklist complete
- [ ] CHANGELOG entry under next version (Infrastructure)
- [ ] Compare AAB size vs Phase 1 baseline
- [ ] Sentry mapping upload plan confirmed

### Ship

```bash
eas build --platform android --profile production
```

Submit via existing Play Console flow.

### Post-ship (first 48–72 hours)

- Watch Sentry for new native crashes (`java.lang.ClassNotFoundException`,
  `NoSuchMethodError`, SQLCipher errors)
- Check Play Console pre-launch report / vitals for regressions
- Keep previous production AAB build ID for rollback reference

---

## Rollback plan

If production crashes spike after R8:

1. **Fast rollback:** Revert the `expo-build-properties` plugin block (or set
   `enableMinifyInReleaseBuilds: false`), rebuild, and submit a hotfix.
2. **Surgical fix:** Add ProGuard keep rules for the crashing library and ship
   a patch instead of full rollback.

Rollback does not affect user data — only the native binary changes.

---

## Config reference (target end state)

After all phases, `app.json` plugins should include something like:

```json
[
  "expo-build-properties",
  {
    "android": {
      "enableMinifyInReleaseBuilds": true,
      "enableShrinkResourcesInReleaseBuilds": true,
      "extraProguardRules": "<rules added only as needed from QA>"
    }
  }
]
```

`eas.json` production profile needs **no changes** — R8 is controlled entirely
through the config plugin.

---

## Before / after tracking

| Metric | Before R8 | After minify only | After minify + shrink |
|--------|-----------|-------------------|------------------------|
| EAS build ID | `7bc1bd79-17a9-45e4-9f41-8ba8ea89e560` | | |
| AAB size (MB) | 131.81 | | |
| Play Console download size | 66.5 MB (new installs) | | |
| Cold start (subjective) | _TBD — device QA_ | | |
| Sentry crash-free rate (7d) | _TBD — snapshot from Sentry_ | | |
| Play Console crash rate | 0 crashes; rate N/A (small sample) | | |
| Play Console ANR rate | 0 ANRs; rate N/A (small sample) | | |

---

## Open questions (resolve before Phase 2)

- [ ] **Sentry mapping upload:** Enable auto-upload in EAS, or manual upload per
      release? (`SENTRY_DISABLE_AUTO_UPLOAD=true` is set in build profiles today.)
- [ ] **QA devices:** Which physical devices cover Android 14 and 15?
- [ ] **Release train:** Ship R8 in the next minor (e.g. 1.0.1) or batch with
      other Android work?

---

## Quick handoff (paste into a new chat)

```text
Implement Phase 2 of @docs/r8-optimization-plan.md only.
Install expo-build-properties, add enableMinifyInReleaseBuilds to app.json.
Do not enable shrinkResources yet. Do not ship to production.
```
