#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const appJsonPath = path.join(projectRoot, "app.json");
const easJsonPath = path.join(projectRoot, "eas.json");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✅ ${message}`);
}

async function main() {
  const appConfigRaw = await readFile(appJsonPath, "utf8");
  const easConfigRaw = await readFile(easJsonPath, "utf8");
  const appConfig = JSON.parse(appConfigRaw);
  const easConfig = JSON.parse(easConfigRaw);
  const expo = appConfig?.expo ?? {};

  if (expo?.ios?.buildNumber) pass(`iOS buildNumber is set (${expo.ios.buildNumber}).`);
  else fail("Missing expo.ios.buildNumber in app.json.");

  if (typeof expo?.android?.versionCode === "number")
    pass(`Android versionCode is set (${expo.android.versionCode}).`);
  else fail("Missing numeric expo.android.versionCode in app.json.");

  if (easConfig?.build?.production) pass("eas.json has a production build profile.");
  else fail("eas.json is missing build.production profile.");

  const hasSentryPlugin = Array.isArray(expo?.plugins)
    && expo.plugins.some((entry) => Array.isArray(entry) && entry[0] === "@sentry/react-native/expo");
  if (hasSentryPlugin) pass("Sentry Expo plugin is configured.");
  else fail("Missing @sentry/react-native/expo plugin in app.json.");

  console.log("\nManual checks:");
  console.log("- Confirm Ko-fi support link is visible in More settings on iOS and Android.");
  console.log("- Confirm live privacy policy URL is reachable:");
  console.log("  https://doc-hosting.flycricket.io/sinag-bible-privacy-policy/14d3d32d-19f6-4899-8b43-c30f46a2f6d3/privacy");
  console.log("- Verify EXPO_PUBLIC_SENTRY_DSN is configured in EAS secrets for production.");
}

main().catch((error) => {
  fail(`Checklist script failed: ${error instanceof Error ? error.message : String(error)}`);
});
