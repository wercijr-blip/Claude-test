import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/**/*.test.ts'],
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
    coverage: {
      provider: 'v8',
      // Route handlers and infra files require a live DB/Redis/S3 — covered by integration tests.
      // Thresholds apply only to the core business logic units that are unit-testable.
      include: [
        'server/clinicalIntelligence.ts',
        'server/pubmed.ts',
        'server/_core/encryption.ts',
        'server/_core/cpfValidator.ts',
        'server/_core/rateLimiters.ts',
        'server/_core/circuitBreaker.ts',
        'server/cis/**/*.ts',
      ],
      exclude: ['server/**/*.test.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
    },
  },
})
