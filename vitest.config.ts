import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@sinag-bible/types": path.resolve(__dirname, "packages/types/src/index.ts"),
      "expo-file-system/legacy": path.resolve(__dirname, "lib/__tests__/expo-file-system-mock.ts"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
