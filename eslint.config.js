// Flat ESLint config. Extends Expo's recommended rules and adds a focused set
// that MIRRORS the SonarCloud quality profile this project enforces — so the
// smells we kept hitting (nested ternaries, array-index keys, high complexity,
// unstable nested components, unused imports) are caught locally and in CI,
// before a PR merges, instead of after the fact on SonarCloud.
const expoConfig = require('eslint-config-expo/flat');
const sonarjs = require('eslint-plugin-sonarjs');
const globals = require('globals');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'node_modules/*', 'eslint.config.js', 'babel.config.js'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-nested-conditional': 'error', // SonarCloud S3358
      'sonarjs/cognitive-complexity': ['error', 15], // S3776
      'no-negated-condition': 'error', // S7735
      'react/no-array-index-key': 'error', // S6479
      'react/no-unstable-nested-components': 'error', // S6478
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ], // S1128
    },
  },
  {
    // Tests and the demo script: provide the runtime globals and don't gate
    // their complexity (test bodies and console tooling are exempt).
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'scripts/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'sonarjs/cognitive-complexity': 'off',
      // jest.mock must be hoisted above imports and its factory can't reference
      // out-of-scope bindings, so require() inside it is the sanctioned idiom.
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
    },
  },
];
