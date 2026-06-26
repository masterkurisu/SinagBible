# Mobile Release Checklist

## Preflight

- [ ] Run `pnpm --filter @sinag-bible/mobile prepublish:checklist`.
- [ ] Run `pnpm --filter @sinag-bible/mobile lint`.
- [ ] Run `pnpm --filter @sinag-bible/mobile typecheck`.
- [ ] Verify `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_APP_ENV=production` are configured in EAS secrets.

## Policy + Store Compliance

- [ ] Ko-fi support link is visible in Credits on iOS and Android.
- [ ] Privacy policy URL is publicly reachable:
  - `https://doc-hosting.flycricket.io/sinag-bible-privacy-policy/14d3d32d-19f6-4899-8b43-c30f46a2f6d3/privacy`
- [ ] Terms URL is reachable:
  - `https://doc-hosting.flycricket.io/sinag-bible-terms-of-use/f14ef8d0-26cb-4c1c-93d1-0be0fe10e22d/terms`

## Build + Submit

- [ ] iOS build: `pnpm --filter @sinag-bible/mobile release:ios`
- [ ] Android build: `pnpm --filter @sinag-bible/mobile release:android`
- [ ] Attach screenshots, description, and privacy URL in App Store Connect + Play Console.

## Store Metadata Copy Pack

- **Privacy policy URL:** `https://doc-hosting.flycricket.io/sinag-bible-privacy-policy/14d3d32d-19f6-4899-8b43-c30f46a2f6d3/privacy`
- **Support email:** `sinag.bibleapp@gmail.com`
- **Core value props:** local-first privacy, multi-translation Bible reader, verse highlights/notes, rich local journaling, search across Bible + journal.
- **Avoid claims:** cloud sync (mobile), push notifications, subscriptions/IAP, AI writing assistance.
