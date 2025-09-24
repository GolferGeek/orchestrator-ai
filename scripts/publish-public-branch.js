#!/usr/bin/env node
/**
 * Publish a sanitized public branch manually.
 *
 * Usage examples:
 *   node scripts/publish-public-branch.js --push
 *   npm run publish:public -- --dry-run
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_FROM_BRANCH = 'main';
const DEFAULT_TO_BRANCH = 'public-main';

const pathsToRemove = [
  'apps/api/src/agents/my-org',
  'apps/api/src/agents/saas',
];

const overridesSource = path.join(
  repoRoot,
  '.github',
  'public-overrides'
);

function log(message) {
  console.log(`[publish-public-branch] ${message}`);
}

function run(cmd, { stdio = 'pipe', cwd = repoRoot } = {}) {
  log(`> ${cmd}`);
  return execSync(cmd, {
    cwd,
    stdio,
    encoding: 'utf8',
  }).trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    push: false,
    allowDirty: false,
    fromBranch: DEFAULT_FROM_BRANCH,
    toBranch: DEFAULT_TO_BRANCH,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--push') {
      options.push = true;
    } else if (arg === '--allow-dirty') {
      options.allowDirty = true;
    } else if (arg === '--from-branch') {
      options.fromBranch = args[++i] || options.fromBranch;
    } else if (arg === '--to-branch') {
      options.toBranch = args[++i] || options.toBranch;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      log(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/publish-public-branch.js [options]

Options:
  --dry-run            Perform all steps except committing/pushing
  --push               Force push the sanitized branch to origin
  --allow-dirty        Allow running with local uncommitted changes
  --from-branch <name> Source branch to sanitize (default: ${DEFAULT_FROM_BRANCH})
  --to-branch <name>   Destination branch name (default: ${DEFAULT_TO_BRANCH})
  -h, --help           Show this help message
`);
}

function ensureRepoRoot() {
  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    log('Error: .git directory not found. Run this script from the repository root.');
    process.exit(1);
  }
}

function ensureCleanWorkingTree(allowDirty) {
  if (allowDirty) return;
  const status = run('git status --porcelain', { cwd: repoRoot });
  if (status.length > 0) {
    log('Error: working tree has uncommitted changes. Commit or stash them, or use --allow-dirty.');
    process.exit(1);
  }
}

function removePaths(baseDir) {
  pathsToRemove.forEach((relativePath) => {
    const absolutePath = path.join(baseDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      log(`Removing ${relativePath}`);
      fs.rmSync(absolutePath, { recursive: true, force: true });
    } else {
      log(`Skipping ${relativePath} (not present)`);
    }
  });
}

function copyOverrides(targetDir) {
  if (!fs.existsSync(overridesSource)) {
    log('No overrides directory found. Skipping copy step.');
    return;
  }

  log('Copying overrides from .github/public-overrides');
  copyDirectory(overridesSource, targetDir);
}

function copyDirectory(source, destination) {
  const entries = fs.readdirSync(source, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function main() {
  ensureRepoRoot();
  const options = parseArgs();
  ensureCleanWorkingTree(options.allowDirty);

  log(`Publishing ${options.fromBranch} -> ${options.toBranch}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-public-'));
  log(`Using temporary worktree: ${tempDir}`);

  try {
    run(`git fetch origin ${options.fromBranch}`, { stdio: 'inherit' });

    run(`git worktree add --force ${JSON.stringify(tempDir)} ${options.fromBranch}`, {
      stdio: 'inherit',
    });

    process.chdir(tempDir);

    run(`git checkout -B ${options.toBranch}`, { stdio: 'inherit', cwd: tempDir });

    removePaths(tempDir);
    copyOverrides(tempDir);

    run('git add -A', { stdio: 'inherit', cwd: tempDir });

    const status = run('git status --porcelain', { cwd: tempDir });

    if (status.length === 0) {
      log('No changes detected after sanitizing. Nothing to commit.');
    } else if (options.dryRun) {
      log('Dry run: changes detected but commit/push skipped.');
      log('\nPreview of changes:');
      run('git status', { stdio: 'inherit', cwd: tempDir });
    } else {
      const commitMessage = `chore: publish sanitized ${options.toBranch}`;
      run(`git commit -m ${JSON.stringify(commitMessage)}`, {
        stdio: 'inherit',
        cwd: tempDir,
      });

      if (options.push) {
        run(`git push origin ${options.toBranch} --force`, {
          stdio: 'inherit',
          cwd: tempDir,
        });
      } else {
        log('Push skipped. Use --push to update the remote branch.');
      }
    }
  } finally {
    process.chdir(repoRoot);
    try {
      run(`git worktree remove --force ${JSON.stringify(tempDir)}`, {
        stdio: 'inherit',
      });
    } catch (error) {
      log('Warning: failed to remove worktree automatically. Remove it manually if needed.');
    }
  }

  log('Done.');
}

main();

