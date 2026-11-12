import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['scripts/sw.template.js', 'dist', 'node_modules', 'android', 'ios', 'docs', 'public', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // End-to-end tests drive the game through the `window.ressac` handle.
    files: ['e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['scripts/**/*.{js,mjs}', 'eslint.config.js'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', self: 'readonly', caches: 'readonly', fetch: 'readonly', URL: 'readonly', Response: 'readonly', setTimeout: 'readonly', document: 'readonly', window: 'readonly', localStorage: 'readonly' },
    },
  },
);
