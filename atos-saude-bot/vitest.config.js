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
    include: ['src/tests/**/*.test.js']
  }
})
