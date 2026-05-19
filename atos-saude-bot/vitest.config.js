import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    env: {
      DB_PATH: ':memory:',
      JWT_SECRET: 'vitest-secret-minimo-32-chars-para-teste',
      NODE_ENV: 'test',
      EVOLUTION_URL: 'http://localhost:8080',
      EVOLUTION_API_KEY: 'test-key',
      INSTANCE_NAME: 'test',
      ANTHROPIC_API_KEY: 'sk-ant-test'
    },
    include: ['src/tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/tests/**', 'src/scripts/**', 'src/panel/index.html'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40
      }
    }
  }
})
