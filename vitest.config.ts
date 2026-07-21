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
      "expo-file-system/legacy": path.resolve(__dirname, "lib/__tests__/expo-file-system-mock.ts"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
