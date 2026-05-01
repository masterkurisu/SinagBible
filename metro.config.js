const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = projectRoot;

const config = getDefaultConfig(projectRoot);

// Treat `.md` as a bundled asset (e.g. repo-root `privacy_policy.md` in PrivacyPolicySheet).
if (!config.resolver.assetExts.includes("md")) {
  config.resolver.assetExts.push("md");
}
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== "md");

// Watch the monorepo in addition to Expo defaults
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot]),
);

// Resolve modules from the app first, then the monorepo root (workspace packages).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Do NOT set `disableHierarchicalLookup: true` with pnpm: imports inside packages in
// `node_modules/.pnpm/...` (e.g. @expo/metro-runtime → whatwg-fetch) resolve via the
// sibling `node_modules` next to that package. Flat lookup only checks the paths above
// and breaks those transitive imports.

// pnpm + workspace packages (e.g. `@sinag-bible/ui`) can each have their own physical
// `node_modules/react`. Metro may bundle two copies → "Invalid hook call" / useState null.
// Pin React to this app's instance (see https://docs.expo.dev/guides/monorepos/).
const reactPackage = path.resolve(projectRoot, "node_modules/react");
const reactDomPackage = path.resolve(projectRoot, "node_modules/react-dom");
const reactNativePackage = path.resolve(projectRoot, "node_modules/react-native");
const nativewindPackage = path.resolve(projectRoot, "node_modules/nativewind");
const cssInteropPackage = path.resolve(projectRoot, "node_modules/react-native-css-interop");
const pellRichEditorPackage = path.resolve(projectRoot, "node_modules/react-native-pell-rich-editor");
const webviewPackage = path.resolve(projectRoot, "node_modules/react-native-webview");
const expoRouterPackage = path.resolve(projectRoot, "node_modules/expo-router");
const expoHapticsPackage = path.resolve(projectRoot, "node_modules/expo-haptics");
const expoPrintPackage = path.resolve(projectRoot, "node_modules/expo-print");
const flashListPackage = path.resolve(projectRoot, "node_modules/@shopify/flash-list");
const markdownDisplayPackage = path.resolve(projectRoot, "node_modules/react-native-markdown-display");

/**
 * Workspace packages are `@sinag-bible/*`. Metro resolves them from the monorepo package roots so
 * bundling stays stable with pnpm workspaces.
 */
const sinagBibleWorkspacePackages = {
  "@sinag-bible/core": path.resolve(workspaceRoot, "packages/core"),
  "@sinag-bible/tokens": path.resolve(workspaceRoot, "packages/tokens"),
  "@sinag-bible/types": path.resolve(workspaceRoot, "packages/types"),
  "@sinag-bible/ui": path.resolve(workspaceRoot, "packages/ui"),
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...sinagBibleWorkspacePackages,
  react: reactPackage,
  "react-dom": reactDomPackage,
  "react-native": reactNativePackage,
  nativewind: nativewindPackage,
  "react-native-css-interop": cssInteropPackage,
  "react-native-pell-rich-editor": pellRichEditorPackage,
  "react-native-webview": webviewPackage,
  /** Single copy so LinkPreviewContext matches ExpoRoot (avoids useLinkPreviewContext crash). */
  "expo-router": expoRouterPackage,
  /** pnpm + monorepo: ensure Metro resolves the app-linked native module (not a missing hoisted path). */
  "expo-haptics": expoHapticsPackage,
  "expo-print": expoPrintPackage,
  /** pnpm symlink → Metro sometimes fails "Unable to resolve @shopify/flash-list" without an explicit root. */
  "@shopify/flash-list": flashListPackage,
  /** Same pnpm + Metro issue as flash-list (onboarding privacy policy modal). */
  "react-native-markdown-display": markdownDisplayPackage,
};

/** Subpaths must be shims too — `extraNodeModules` only aliases the package root. */
const pinnedReactSource = {
  react: path.join(reactPackage, "index.js"),
  "react/jsx-runtime": path.join(reactPackage, "jsx-runtime.js"),
  "react/jsx-dev-runtime": path.join(reactPackage, "jsx-dev-runtime.js"),
  "react/compiler-runtime": path.join(reactPackage, "compiler-runtime.js"),
  "react-dom": path.join(reactDomPackage, "index.js"),
};

/**
 * With `jsxImportSource: "nativewind"`, Babel emits these imports. Resolution can fail when
 * Metro starts from `node_modules/.pnpm/.../react-native/...` (no `nativewind` sibling).
 * Pin to the app-linked package (apps/mobile/node_modules/nativewind).
 */
const pinnedNativewindJsx = {
  "nativewind/jsx-runtime": path.join(nativewindPackage, "jsx-runtime", "index.js"),
  "nativewind/jsx-dev-runtime": path.join(nativewindPackage, "jsx-dev-runtime", "index.js"),
};

/** NativeWind re-exports these; pin so Metro always resolves from the app-linked copy. */
const pinnedCssInteropJsx = {
  "react-native-css-interop/jsx-runtime": path.join(cssInteropPackage, "dist", "runtime", "jsx-runtime.js"),
  "react-native-css-interop/jsx-dev-runtime": path.join(
    cssInteropPackage,
    "dist",
    "runtime",
    "jsx-dev-runtime.js",
  ),
};

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = pinnedReactSource[moduleName];
  if (pinned) {
    return { type: "sourceFile", filePath: pinned };
  }
  const nativewindJsx = pinnedNativewindJsx[moduleName];
  if (nativewindJsx) {
    return { type: "sourceFile", filePath: nativewindJsx };
  }
  const cssInteropJsx = pinnedCssInteropJsx[moduleName];
  if (cssInteropJsx) {
    return { type: "sourceFile", filePath: cssInteropJsx };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
