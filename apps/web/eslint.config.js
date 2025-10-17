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
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unused-vars': [
    'off',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-duplicate-enum-values': 'off',
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
    ],
  },
  ...vueFlatRecommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      globals: browserGlobals,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        project: [tsconfigPath],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: sharedTypeScriptRules,
  },
  {
    files: ['**/*.vue'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        projectService: true,
        project: [tsconfigPath],
        tsconfigRootDir: __dirname,
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
      'vue/multi-word-component-names': 'off',
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
    },
  },
);
