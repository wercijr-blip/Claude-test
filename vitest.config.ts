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
        // Raise incrementally as test surface grows — do not lower below these values.
        lines: 7,
        functions: 30,
        branches: 60,
      },
    },
  },
})
