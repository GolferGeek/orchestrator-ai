// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsconfigPath = path.join(__dirname, 'tsconfig.eslint.json');
const testFilePatterns = [
  '**/*.spec.ts',
  '**/*.spec.tsx',
  'test/**/*.ts',
  'testing/**/*.ts',
];

const temporaryTypeSafetyAllowlist = {
  '@typescript-eslint/no-explicit-any': {
    level: 'off',
    reason: 'Phase 2–4 will reintroduce strict typing across LLM and agent services.',
  },
  '@typescript-eslint/no-unsafe-argument': {
    level: 'off',
    reason: 'Awaiting typed adapters for provider payloads (Phase 2).',
  },
  '@typescript-eslint/no-unsafe-assignment': {
    level: 'off',
    reason: 'Current Supabase/LLM responses remain untyped until Phase 2–3.',
  },
  '@typescript-eslint/no-unsafe-member-access': {
    level: 'off',
    reason: 'Dependent on DTO rollout for runtime artifacts (Phase 2–3).',
  },
  '@typescript-eslint/no-unsafe-call': {
    level: 'off',
    reason: 'Legacy dynamic invocation patterns to be replaced in Phase 3.',
  },
  '@typescript-eslint/no-unsafe-return': {
    level: 'off',
    reason: 'Service return types require DTO normalization (Phase 2–3).',
  },
  '@typescript-eslint/no-floating-promises': {
    level: 'off',
    reason: 'Async strategy under review; will move to error post Phase 6.',
  },
  '@typescript-eslint/await-thenable': {
    level: 'off',
    reason: 'Ensuring staged rollout before flipping to error in Phase 6.',
  },
  '@typescript-eslint/require-await': {
    level: 'off',
    reason: 'Async helpers will be revisited during residual cleanup (Phase 6).',
  },
  '@typescript-eslint/restrict-template-expressions': {
    level: 'off',
    reason: 'String interpolation refactors scheduled for Phase 6.',
  },
  '@typescript-eslint/no-misused-promises': {
    level: 'off',
    reason: 'Promise utilities to be hardened alongside agent runtime updates (Phase 3).',
  },
  '@typescript-eslint/no-redundant-type-constituents': {
    level: 'off',
    reason: 'Type normalization dependent on DTO workstreams (Phase 2–3).',
  },
  '@typescript-eslint/unbound-method': {
    level: 'off',
    reason: 'Transitioning to arrow functions/binds during cleanup (Phase 6).',
  },
};

const allowlistedTypeSafetyRules = Object.fromEntries(
  Object.entries(temporaryTypeSafetyAllowlist).map(([rule, config]) => [
    rule,
    config.level,
  ]),
);

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.mjs',
      // TODO(lint phase 6): bring scripts back once TypeScript project setup covers utility scripts
      'scripts/**',
      // TODO(lint phase 6): include legacy E2E suite when converted to new tsconfig structure
      'testing/test/**',
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      eslintPluginPrettierRecommended,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: {
          defaultProject: tsconfigPath,
        },
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      ...allowlistedTypeSafetyRules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: testFilePatterns,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'src/llms/**',
      'src/langchain/**',
      'src/supabase/utils/langchain-client.ts',
      'test/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'openai',
              message:
                'Use the centralized LLM service/client instead of importing provider SDKs directly.',
            },
            {
              name: '@langchain/openai',
              message:
                'Use centralized LLM client. Provider-specific LangChain wrappers only in approved modules.',
            },
            {
              name: '@langchain/anthropic',
              message:
                'Use centralized LLM client. Provider-specific LangChain wrappers only in approved modules.',
            },
            {
              name: '@anthropic-ai/sdk',
              message:
                'Use the centralized LLM service/client instead of importing provider SDKs directly.',
            },
          ],
          patterns: [
            {
              group: ['**/providers/*', '**/sdk/*'],
              message:
                'Provider SDKs must only be used in central LLM modules.',
            },
          ],
        },
      ],
    },
  },
);
