#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TARGETS = [
  {
    name: 'api',
    displayName: 'API',
    cwd: path.join(repoRoot, 'apps/api'),
    configFile: path.join(repoRoot, 'apps/api/eslint.config.mjs'),
    patterns: ['src/**/*.ts', 'test/**/*.ts', 'testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-empty': 'error',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    name: 'web',
    displayName: 'Web',
    cwd: path.join(repoRoot, 'apps/web'),
    configFile: path.join(repoRoot, 'apps/web/eslint.config.js'),
    patterns: [
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/**/*.vue',
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'tests/**/*.vue',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      'no-prototype-builtins': 'error',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
];

const outputDir = path.join(
  repoRoot,
  'obsidian/efforts/matt/current/lint-for-the-win',
);
const outputPath = path.join(outputDir, 'lint-baseline-metrics.json');

fs.mkdirSync(outputDir, { recursive: true });

const results = [];

for (const target of TARGETS) {
  const eslint = new ESLint({
    cwd: target.cwd,
    overrideConfigFile: target.configFile,
    overrideConfig: {
      rules: target.rules,
      plugins: target.plugins,
    },
    errorOnUnmatchedPattern: false,
  });

  const reports = await eslint.lintFiles(target.patterns);

  const counts = Object.fromEntries(
    Object.keys(target.rules).map((rule) => [rule, 0]),
  );

  for (const report of reports) {
    for (const message of report.messages) {
      const ruleId = message.ruleId;
      if (ruleId && counts[ruleId] !== undefined) {
        counts[ruleId] += 1;
      }
    }
  }

  results.push({
    workspace: target.name,
    displayName: target.displayName,
    ruleCounts: counts,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  targets: results,
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log('Lint baseline metrics written to:');
console.log(`  ${path.relative(repoRoot, outputPath)}`);
console.log('');

for (const target of results) {
  console.log(target.displayName);
  for (const [rule, count] of Object.entries(target.ruleCounts)) {
    console.log(`  ${rule}: ${count}`);
  }
  console.log('');
}
