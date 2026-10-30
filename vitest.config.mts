import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // The PGlite suites apply every migration to a fresh in-process database
    // and run in parallel; under load they outlast vitest's 5s default.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
