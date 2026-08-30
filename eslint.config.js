import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unicorn from 'eslint-plugin-unicorn';

const sourceFiles = ['src/**/*.{ts,tsx}'];
const testFiles = ['tests/**/*.{ts,tsx}'];
const codeFiles = ['**/*.{js,jsx,ts,tsx}'];

export default tseslint.config(
  { ignores: ['.astro', 'dist', 'coverage', 'playwright-report', 'test-results', 'printmaps-inspection'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: codeFiles,
    plugins: { unicorn },
    rules: {
      ...unicorn.configs.recommended.rules,
      complexity: ['error', { max: 12 }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'unicorn/filename-case': ['error', { cases: { camelCase: true, kebabCase: true, pascalCase: true } }],
      // DOM, React, and MapLibre APIs use null intentionally; forcing undefined adds adapter noise.
      'unicorn/no-null': 'off',
      // React's Ref/Props vocabulary is idiomatic and clearer than mechanical expansion.
      'unicorn/name-replacements': 'off',
      // Keep browser-only operations explicit instead of disguising them as cross-runtime globals.
      'unicorn/prefer-global-this': 'off',
      // Iterator helpers and Promise.withResolvers are not yet in the browser support contract.
      'unicorn/prefer-iterator-to-array': 'off',
      'unicorn/prefer-promise-with-resolvers': 'off',
    },
  },
  {
    files: sourceFiles,
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }],
    },
  },
  {
    files: testFiles,
    rules: {
      'max-lines': ['error', { max: 450, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 180, skipBlankLines: true, skipComments: true, IIFEs: true }],
      // Playwright intentionally serializes callbacks into a separate browser realm.
      'unicorn/isolated-functions': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
