// @ts-check
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const angular = require('@angular-eslint/eslint-plugin');

module.exports = [
  {
    files: ['projects/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: ['./projects/ngx-mfe-broker/tsconfig.lib.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@angular-eslint': angular,
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      ...tseslint.configs['recommended-requiring-type-checking'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@angular-eslint/no-empty-lifecycle-method': 'error',
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: ['./projects/ngx-mfe-broker/tsconfig.spec.json'],
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
