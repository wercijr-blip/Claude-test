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
        // Server entry-points & wiring — not unit-testable
        "server/_core/instrument.ts",
        "server/_core/index.ts",
        "server/_core/openapi.ts",
        "server/_core/metrics.ts",
        "server/_core/context.ts", // Express req → tRPC context; needs live req
        "server/_core/logger.ts", // pino setup; IO-only, no logic
        "server/routers.ts", // aggregates route exports; no logic
        "server/workers.ts",
        "server/seed.ts",
        "server/scripts/**",
        // Infrastructure requiring live DB/services
        "server/_core/ensureSchema.ts", // startup DDL safety-net; needs real DB
        "server/storage.ts", // AWS S3 wrapper; needs real credentials
        "server/whatsapp.ts", // WhatsApp client setup
      ],
      thresholds: {
        // Calibrated to actual measured coverage (25.8/70.6/82.5 em 10/06/2026)
        // with a small margin. Raise incrementally — do not lower below these values.
        lines: 25,
        functions: 70,
        branches: 82,
      },
    },
  },
});
