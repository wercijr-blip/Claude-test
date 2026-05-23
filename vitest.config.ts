import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globals: true,
    include: ['server/**/*.test.ts', 'client/src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['client/src/**/*.test.ts', 'jsdom'],
      ['server/**/*.test.ts', 'node'],
    ],
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['server/**/*.ts'],
      exclude: [
        'server/**/*.test.ts',
        'server/_core/instrument.ts',
        'server/_core/index.ts',
        'server/workers.ts',
        'server/seed.ts',
        'server/scripts/**',
      ],
      thresholds: {
        // Raise incrementally — do not lower below these values.
        // Lines ceiling ~15%: routes/email/PDF/S3 modules require DB+infra integration tests.
        lines: 15,
        functions: 50,
        branches: 76,
      },
    },
  },
})
