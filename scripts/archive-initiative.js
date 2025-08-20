#!/usr/bin/env node
/*
Archive an initiative: snapshot PRD and Taskmaster artifacts into history folder.

Usage:
  node scripts/archive-initiative.js <slug> [--keep-tag]
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function print(msg) { process.stdout.write(String(msg) + '\n'); }
function fatal(msg) { process.stderr.write(String(msg) + '\n'); process.exit(1); }

function parseArgs(argv) {
	const args = { _: [] };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--keep-tag') args.keepTag = true;
		else args._.push(a);
	}
	return args;
}

(function main() {
	const args = parseArgs(process.argv);
	const slug = args._[0];
	if (!slug) fatal('Usage: node scripts/archive-initiative.js <slug> [--keep-tag]');

	const repoRoot = path.resolve(__dirname, '..');
	const activePrd = path.join(repoRoot, 'docs', 'prd', 'active', `${slug}.md`);
	const historyDir = path.join(repoRoot, 'docs', 'prd', 'history');
	const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
	const archiveRoot = path.join(historyDir, `${date}-${slug}`);

	if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
	if (!fs.existsSync(archiveRoot)) fs.mkdirSync(archiveRoot, { recursive: true });

	// Copy PRD
	if (fs.existsSync(activePrd)) {
		fs.copyFileSync(activePrd, path.join(archiveRoot, 'PRD.md'));
		print(`🗂️  Copied PRD to ${path.relative(repoRoot, path.join(archiveRoot, 'PRD.md'))}`);
	} else {
		print('ℹ️  No active PRD file found to copy. Skipping.');
	}

	// Copy tasks.json snapshot if present
	const tasksJson = path.join(repoRoot, '.taskmaster', 'tasks', 'tasks.json');
	if (fs.existsSync(tasksJson)) {
		fs.copyFileSync(tasksJson, path.join(archiveRoot, 'tasks.json'));
		print('🗂️  Snapshot tasks.json');
	} else {
		print('ℹ️  No .taskmaster/tasks/tasks.json found. Skipping snapshot.');
	}

	// Generate markdown task files into archive
	print('▶️  Generating markdown task files into archive...');
	spawnSync('task-master', ['generate', '--tag', slug, '--output', path.join(archiveRoot, 'tasks')], { stdio: 'inherit' });

	// Dump complexity report into archive (ignore errors)
	spawnSync('task-master', ['complexity-report', '--tag', slug, '--file', path.join(archiveRoot, 'complexity-report.json')], { stdio: 'inherit' });

	// Remove active PRD and optionally retire tag
	if (fs.existsSync(activePrd)) {
		try {
			fs.unlinkSync(activePrd);
			print('🧹 Removed active PRD file.');
		} catch {}
	}
	if (!args.keepTag) {
		print('🛑 Retiring Taskmaster tag...');
		spawnSync('task-master', ['delete-tag', slug, '--yes'], { stdio: 'inherit' });
	}

	print(`✅ Archived to ${path.relative(repoRoot, archiveRoot)}`);
	print('Commit suggestion:');
	print(`  git add ${path.relative(repoRoot, archiveRoot)} docs/prd/active || true`);
	print(`  git commit -m "chore(archive): finalize and archive ${slug} PRD and Taskmaster artifacts"`);
	print('  git push');
})();


