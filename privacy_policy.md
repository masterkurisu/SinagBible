# Sinag Bible Privacy Policy

**Developer:** Chris Domingo
**Contact:** sinag.bibleapp@gmail.com
**Effective date:** July 13, 2026

---

## In plain terms

Sinag Bible is a personal Bible reading and journaling app. Your journal entries, highlights, notes, and other reading data belong to you. The mobile app (iOS and Android) stores your content on your device — it is not sent to Sinag Bible servers. We do not sell your data or run ads. We do not use analytics to track your reading or journaling behavior. The only routine off-device data the mobile app may send is anonymous crash and performance diagnostics to help us fix bugs (see Crash reporting below). We do not intentionally send your journal, highlights, or notes to third parties.

---

## 1. What the mobile app collects (iOS and Android)

Your personal content stays on your device. The app stores:

- **Journal entries** — text, passage references (book, chapter, verses), translation used, and any photos you attach
- **Per-verse notes** — notes written beneath individual verses
- **Verse marks** — colored highlights and underlines (straight or squiggly), plus your current reading position
- **Favorite verses** — verses you pin to the journal carousel, including passage text and translation
- **Reading progress** — last-read book, chapter, and translation
- **Pinned translations** — Bible translations you have pinned for quick access and offline prefetch
- **Display and reader preferences** — theme, font family, font size, line spacing, text alignment, haptics on/off, default highlight/underline style, and study-notes commentary selection
- **Journal carousel settings** — how many verses to show, rotation interval, and randomization options
- **Recent searches** — Scripture and journal searches stored locally to speed up future searches
- **Draft entries** — unfinished entries saved temporarily until you save or discard them
- **Onboarding flags** — whether you have completed app and feature tours (stored locally only)
- **Bible text cache** — chapter text from network providers and bundled translations, stored in an encrypted local database to support offline reading and reduce repeat network requests
- **Carousel image cache** — background image URLs for journal carousel cards, cached locally after fetch
- **Diagnostic logs** — technical log entries captured on your device (see Diagnostic logs below)

None of your journal entries, verse marks, notes, or reading activity is transmitted to Sinag Bible servers.

### Bible text network requests

Some Bible translations are loaded over encrypted (HTTPS) connections from third-party Bible APIs. Only the specific chapter or passage you request is fetched. No personal information, account identifiers, or journal content is sent as part of these requests. Fetched chapters are stored in an encrypted local database so subsequent reads can work offline.

- **bible.helloao.org** — many translations via the Free Use Bible API
- **api.youversion.com** — select translations (for example, NIV and Ang Salita ng Diyos) via the YouVersion Platform API, authenticated with an app-level key only

Some translations (for example, KJV and WEB) are bundled inside the app and do not require a network request.

You may also download an entire translation for offline use; those chapters are stored locally on your device.

### Study notes network requests

Study notes (Bible commentary) are loaded from **bible.helloao.org** over HTTPS when you open them. Only the commentary identifier and chapter you request are sent. Commentary text is not uploaded, and your journal content is not included in these requests.

### Carousel background images

The journal carousel may fetch decorative background images from **api.pexels.com** over HTTPS. Requests use generic search keywords (for example, nature themes matched to a book category) — not your journal text, notes, or personal information. Returned image URLs are cached on your device.

### Crash reporting

To help diagnose crashes and stability issues, production builds of the mobile app may send data to **Sentry** (sentry.io), a third-party crash-reporting service. This may include:

- Crash stack traces and error messages
- App version and build environment
- Device type, operating system version, and similar technical metadata
- A small sample of anonymous performance traces (not your reading or journal content)

Sentry is used only for crash and stability diagnostics — not for advertising, behavioral profiling, or tracking what you read or write. We do not intentionally include your journal entries, highlights, notes, or search history in crash reports.

### Diagnostic logs

The app keeps a rolling log of technical messages on your device to help troubleshoot issues. These logs are not sent automatically. You can optionally save or share them from Settings; if you do, the export may include your device model, OS version, and app version along with the log text. Only share logs if you are comfortable with that information leaving your device.

### Photo library access

We request photo library access only when you choose to attach an image to a journal entry or save an exported entry to your camera roll. Photos are not uploaded, analyzed, or used for any purpose beyond what you explicitly initiate.

### Print and share

The app can generate a printable or shareable version of a journal entry using your device's built-in print and share systems. We do not receive or store anything involved in that process — it is handled entirely by your device's OS.

### Backup, import, and delete

You can export a backup file of your journal entries, favorite verses, and verse marks, or import a backup you created earlier. Backup files are written to your device or shared through your OS share sheet — the app does not upload them to our servers.

You can permanently delete all local app data at any time using **Delete my data** in Settings. This removes journal entries, favorite verses, verse marks, cached Bible text, preferences, and other on-device data from that device. It cannot be undone.

---

## 2. Web account and sync (optional — separate from the mobile app)

The mobile app is fully self-contained and works without any account. It does not currently sync to Sinag Bible cloud services. Cloud sync is a separate, optional web product available at the Sinag Bible website.

If you choose to create a Sinag Bible web account:

### What we store

- Your email address
- Journal entries synced to the cloud — text, formatting, passage references, and timestamps
- Images attached to synced entries, stored via our storage provider

**A note on shared image links:** images in synced entries are stored with a private link accessible only to your account under normal use. Avoid sharing these links externally, as they may contain personal reflections.

### Sign-in options

You may sign in with your email or with Google. If you use Google sign-in, Google processes that authentication under their own privacy policy. We receive only what is needed to identify your account.

### Third-party services (web only)

- **Supabase** — authentication, database, and file storage
- **Google** — only if you use Google sign-in
- **Google Fonts** — font delivery on the web app

These services are used only in the web product. The mobile app uses Google-licensed fonts bundled inside the app; those fonts are loaded from the app package and are not fetched from Google at runtime.

---

## 3. When we may share your information

We do not sell your personal information. We may disclose information only in these limited circumstances:

- As required by law, such as to comply with a subpoena or similar legal process
- When we believe in good faith that disclosure is necessary to protect our rights, your safety or the safety of others, or to investigate fraud
- With trusted service providers who work on our behalf, do not have independent use of the information disclosed to them, and have agreed to adhere to this privacy policy — including **Sentry** for mobile crash reporting and the third-party Bible and image providers described in Section 1 for content delivery

---

## 4. What we do not do

- We do not sell your personal information to anyone
- We do not run advertising or include ad networks in the app
- We do not use analytics SDKs to track your reading, journaling, or in-app behavior
- We do not use your journal content to train AI models
- The mobile app does not send your writing, highlights, notes, or reading activity to Sinag Bible servers

---

## 5. Data retention

### On your device

Data remains on your device until you delete it using **Delete my data** in Settings, delete the app, or clear its data through your device settings. You can stop all on-device storage by uninstalling the app at any time.

### Web account

We keep your account data for as long as your account is active. To request deletion, email us at **sinag.bibleapp@gmail.com** — we will delete or anonymize your data within 30 days, except where required by law.

### If Sinag Bible shuts down

We will provide at least 30 days' notice and a way to export your data before any deletion occurs.

---

## 6. Security

We use encrypted connections (HTTPS) for all network requests. Bible chapter text on your device is stored in an encrypted local database. For the web product, our storage provider applies encryption at rest. No method of storage or transmission is completely secure, and we cannot guarantee absolute security.

---

## 7. Children

Sinag Bible is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact us and we will delete it promptly.

In some regions, you must be at least 16 years of age to consent to the processing of your personally identifiable information (or a parent or guardian may consent on your behalf where permitted). We encourage parents and guardians to monitor their children's use of the app and to contact us at **sinag.bibleapp@gmail.com** if they believe a child has submitted personal information.

---

## 8. Your rights and choices

Depending on where you live, you may have the right to access, correct, export, or delete your personal data. To make a request about web account data, contact us at **sinag.bibleapp@gmail.com**.

On mobile, you can:

- **Export a backup** — Settings → Import / export, to save or share a JSON backup of your journal, favorite verses, and verse marks
- **Delete all local data** — Settings → Delete my data, to permanently remove everything stored on that device
- **Save diagnostic logs** — Settings → Save logs to device, if you need to share technical information with us for support

You can manage app permissions — including photo library access — at any time in your device settings:

- **iOS:** Settings → Sinag Bible
- **Android:** Settings → Apps → Sinag Bible → Permissions

---

## 9. Your consent

By using the Application, you are consenting to the processing of your information as described in this Privacy Policy. If you do not agree, please discontinue use of the app.

---

## 10. Changes to this policy

We may update this policy from time to time. When we do, we will update the effective date at the top. For significant changes, we will make reasonable efforts to notify you. Continued use of the app after an update means you accept the revised policy.

---

## 11. Contact

**Developer:** Chris Domingo
**Email:** sinag.bibleapp@gmail.com
