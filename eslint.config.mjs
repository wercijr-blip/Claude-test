/**
 * ESLint flat config (ESLint v9+)
 *
 * Nota: o projeto não tem @typescript-eslint instalado. Esta configuração
 * usa apenas regras nativas do ESLint para reforçar boas práticas universais.
 * A checagem de tipos TypeScript é feita pelo compilador via `pnpm check`.
 * A formatação de código é verificada por `pnpm lint` (prettier --check).
 */
export default [
  {
    files: ['server/**/*.ts', 'shared/**/*.ts'],
    rules: {
      // TypeScript cuida de undefined vars e vars não usadas — desligamos aqui
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Boas práticas universais
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    // Arquivos de teste: console e vars não usadas são aceitáveis
    files: ['server/**/*.test.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]
