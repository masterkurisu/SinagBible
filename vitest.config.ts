import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@sinag-bible/types": path.resolve(__dirname, "packages/types/src/index.ts"),
      "@sinag-bible/core/lru-map": path.resolve(__dirname, "packages/core/src/lru-map.ts"),
      "@sinag-bible/core/vague-keyword-index": path.resolve(
        __dirname,
        "packages/core/src/vague-keyword-index.ts",
      ),
      "@sinag-bible/core/search-named-passages": path.resolve(
        __dirname,
        "packages/core/src/search-named-passages.ts",
      ),
      "@sinag-bible/core/search-keyword-popular": path.resolve(
        __dirname,
        "packages/core/src/search-keyword-popular.ts",
      ),
      "@sinag-bible/core/search-topical-index": path.resolve(
        __dirname,
        "packages/core/src/search-topical-index.ts",
      ),
      "@sinag-bible/core/search-strongs-index": path.resolve(
        __dirname,
        "packages/core/src/search-strongs-index.ts",
      ),
      "@sinag-bible/core/search-related-verses": path.resolve(
        __dirname,
        "packages/core/src/search-related-verses.ts",
      ),
      "@sinag-bible/core/bible-meta": path.resolve(__dirname, "packages/core/src/bible-meta.ts"),
      "@sinag-bible/core/bible-translations": path.resolve(
        __dirname,
        "packages/core/src/bible-translations.ts",
      ),
      "@sinag-bible/core/reference-aliases": path.resolve(
        __dirname,
        "packages/core/src/reference-aliases.ts",
      ),
      "@sinag-bible/core/journal": path.resolve(__dirname, "packages/core/src/journal.ts"),
      "expo-file-system/legacy": path.resolve(__dirname, "lib/__tests__/expo-file-system-mock.ts"),
      "expo-sqlite": path.resolve(__dirname, "lib/__tests__/expo-sqlite-stub.ts"),
      "expo-crypto": path.resolve(__dirname, "lib/__tests__/expo-crypto-stub.ts"),
      "expo-secure-store": path.resolve(__dirname, "lib/__tests__/expo-secure-store-stub.ts"),
      "expo-constants": path.resolve(__dirname, "lib/__tests__/expo-constants-stub.ts"),
      "react-native": path.resolve(__dirname, "lib/__tests__/react-native-stub.ts"),
      "expo-speech-recognition": path.resolve(
        __dirname,
        "lib/__tests__/expo-speech-recognition-stub.ts",
      ),
      "@react-native-community/netinfo": path.resolve(__dirname, "lib/__tests__/netinfo-stub.ts"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
