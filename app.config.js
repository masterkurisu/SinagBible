/** @type {import('expo/config').ConfigContext} */
const fs = require("fs");
const path = require("path");

const IS_DEV = process.env.APP_VARIANT === "development";
const hasSpeechRecognition = fs.existsSync(
  path.join(__dirname, "node_modules/expo-speech-recognition"),
);

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? "Sinag Bible (Dev)" : config.name,
  scheme: IS_DEV ? "sinagbible-dev" : config.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV
      ? "com.sinagbible.app.dev"
      : config.ios?.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEV ? "com.sinagbible.app.dev" : config.android?.package,
    // Keep Play photo/video policy compliance even if another plugin re-adds these.
    // RECORD_AUDIO is allowed: optional overlay voice search. Camera stays blocked.
    blockedPermissions: Array.from(
      new Set([
        ...(config.android?.blockedPermissions ?? []),
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.CAMERA",
      ]),
    ),
  },
  plugins: [
    ...(config.plugins ?? []),
    ...(hasSpeechRecognition
      ? [
          [
            "expo-speech-recognition",
            {
              microphonePermission:
                "Sinag Bible uses the microphone for optional voice search. You can still type in the search overlay without it.",
              speechRecognitionPermission:
                "Sinag Bible uses speech recognition to turn your words into a search query. Typing still works if you decline.",
            },
          ],
        ]
      : []),
  ],
  extra: {
    ...config.extra,
    appVariant: IS_DEV ? "development" : "production",
    yvpAppKey: process.env.YVP_APP_KEY ?? process.env.EXPO_PUBLIC_YVP_APP_KEY,
    pexelsApiKey:
      process.env.PEXELS_API_KEY ?? process.env.EXPO_PUBLIC_PEXELS_API_KEY,
  },
});
