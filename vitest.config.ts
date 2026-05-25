import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    include: ["server/**/*.test.ts", "client/src/**/*.test.ts"],
    environmentMatchGlobs: [
      ["client/src/**/*.test.ts", "jsdom"],
      ["server/**/*.test.ts", "node"],
    ],
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["server/**/*.ts"],
      exclude: [
        "server/**/*.test.ts",
        "server/_core/instrument.ts",
        "server/_core/index.ts",
        "server/_core/openapi.ts", // static data object — no executable logic
        "server/_core/metrics.ts",
        "server/workers.ts",
        "server/seed.ts",
        "server/scripts/**",
      ],
      thresholds: {
        // Raised after adding retentionWorker, approvalService, and UTF-8 tests.
        // Do not lower these values.
        lines: 16,
        functions: 51,
        branches: 76,
      },
    },
  },
});
