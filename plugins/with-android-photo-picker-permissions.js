const {
  AndroidConfig,
  createRunOncePlugin,
} = require("expo/config-plugins");

/**
 * Google Play photo/video policy (API 33+): apps that only pick or save
 * occasional images must use the system photo picker and must not declare
 * READ_MEDIA_IMAGES / READ_MEDIA_VIDEO.
 *
 * expo-media-library can reintroduce these via its config plugin / library
 * manifest. Block them after other plugins run.
 */
const BLOCKED_MEDIA_PERMISSIONS = [
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
];

const withAndroidPhotoPickerPermissions = (config) => {
  return AndroidConfig.Permissions.withBlockedPermissions(
    config,
    BLOCKED_MEDIA_PERMISSIONS,
  );
};

module.exports = createRunOncePlugin(
  withAndroidPhotoPickerPermissions,
  "with-android-photo-picker-permissions",
  "1.0.0",
);
