import eslint from '@eslint/js';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsconfigPath = path.join(__dirname, 'tsconfig.eslint.json');

const browserGlobals = {
  ...globals.browser,
  ...globals.es2021,
};

const sharedTypeScriptRules = {
  '@typescript-eslint/no-unused-vars': [
    'off',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-duplicate-enum-values': 'off',
  '@typescript-eslint/no-unused-expressions': 'off',
  '@typescript-eslint/ban-ts-comment': 'off',
  'prefer-const': 'off',
  'no-prototype-builtins': 'off',
};

const vueFlatRecommended = pluginVue.configs['flat/recommended'];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.output/**',
      'coverage/**',
      'ios/**',
      'android/**',
      '**/*.vue?*', // Ignore Vue virtual files that may have parsing issues
    ],
  },
  ...vueFlatRecommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: browserGlobals,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: sharedTypeScriptRules,
  },
  {
    files: ['**/*.vue'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
      globals: browserGlobals,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      vue: pluginVue,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...sharedTypeScriptRules,
      // Turn off all Vue style rules so we can focus on API backend
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/v-on-event-hyphenation': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/attributes-order': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/no-deprecated-slot-attribute': 'off',
      'vue/no-unused-vars': 'warn',
      'vue/no-mutating-props': 'off',
      'vue/no-ref-as-operand': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-dupe-v-else-if': 'off',
      'vue/no-parsing-error': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx', 'tests/**/*.vue'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...globals.jest,
      },
    },
  },
  {
    files: ['tests/e2e/support/commands.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
