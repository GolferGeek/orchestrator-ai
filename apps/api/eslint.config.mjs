// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }]
    },
  },
  {
    // Forbid direct provider SDK imports outside approved modules
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      // Allowed central implementations
      'src/llms/**',
      'src/langchain/**',
      'src/supabase/utils/langchain-client.ts',
      // Tests and config can reference endpoints
      'test/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'openai', message: 'Use the centralized LLM service/client instead of importing provider SDKs directly.' },
            { name: '@langchain/openai', message: 'Use centralized LLM client. Provider-specific LangChain wrappers only in approved modules.' },
            { name: '@langchain/anthropic', message: 'Use centralized LLM client. Provider-specific LangChain wrappers only in approved modules.' },
            { name: '@anthropic-ai/sdk', message: 'Use the centralized LLM service/client instead of importing provider SDKs directly.' },
          ],
          patterns: [
            // Catch any future provider SDKs
            {
              group: ['**/providers/*', '**/sdk/*'],
              message: 'Provider SDKs must only be used in central LLM modules.',
            },
          ],
        },
      ],
    },
  },
);
