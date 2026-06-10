import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./client/src/test-setup.ts"],
    include: ["server/**/*.test.ts", "client/src/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [
      ["client/src/**/*.test.{ts,tsx}", "jsdom"],
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
        "server/_core/openapi.ts",
        "server/_core/metrics.ts",
        "server/workers.ts",
        "server/seed.ts",
        "server/scripts/**",
      ],
      thresholds: {
        // Calibrated to actual measured coverage (19.1/64.6/79.0 em 10/06/2026)
        // with a small margin. Raise incrementally — do not lower below these values.
        lines: 18,
        functions: 60,
        branches: 77,
      },
    },
  },
});
