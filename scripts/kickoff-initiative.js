#!/usr/bin/env node
/*
Kickoff an initiative: create a PRD from template and optionally auto-run Taskmaster steps.

Usage:
  node scripts/kickoff-initiative.js <slug> [--title "Title"] [--auto] [--force-auto] [--threshold 6]

Flags:
  --auto        After creating the PRD, run: add-tag, use-tag, parse-prd, analyze, expand, generate
  --force-auto  Skip PRD completeness check when using --auto (not recommended)
  --threshold N Complexity analysis threshold (default: 6)
*/

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function print(msg) {
	process.stdout.write(String(msg) + '\n');
}

function fatal(msg) {
	process.stderr.write(String(msg) + '\n');
	process.exit(1);
}

function parseArgs(argv) {
	const args = { _: [], threshold: 6 };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--title') {
			args.title = argv[++i];
		} else if (a === '--auto') {
			args.auto = true;
		} else if (a === '--force-auto') {
			args.forceAuto = true;
		} else if (a === '--threshold') {
			const v = Number(argv[++i]);
			if (!Number.isFinite(v) || v <= 0) fatal('Invalid --threshold');
			args.threshold = v;
		} else {
			args._.push(a);
		}
	}
	return args;
}

(function main() {
	const args = parseArgs(process.argv);
	const slug = args._[0];
	if (!slug) fatal('Usage: node scripts/kickoff-initiative.js <slug> [--title "Title"]');

	const repoRoot = path.resolve(__dirname, '..');
	const templatePath = path.join(repoRoot, 'docs', 'prd', 'templates', 'prd-template.md');
	const activeDir = path.join(repoRoot, 'docs', 'prd', 'active');
	const destPath = path.join(activeDir, `${slug}.md`);

	if (!fs.existsSync(templatePath)) fatal(`Missing template: ${templatePath}`);
	if (!fs.existsSync(activeDir)) fs.mkdirSync(activeDir, { recursive: true });

	let created = false;
	const title = args.title || slug.replace(/-/g, ' ');
	if (!fs.existsSync(destPath)) {
		const template = fs.readFileSync(templatePath, 'utf8');
		const today = new Date().toISOString().slice(0, 10);
		const filled = template
			.replace('slug: <kebab-case>', `slug: ${slug}`)
			.replace('title: <Short, imperative title>', `title: ${title}`)
			.replace('created: <YYYY-MM-DD>', `created: ${today}`);
		fs.writeFileSync(destPath, filled, 'utf8');
		created = true;
	}

	print(`${created ? '✅ Created' : 'ℹ️ Using existing'} PRD: ${path.relative(repoRoot, destPath)}`);

	if (!args.auto) {
		print('Next steps:');
		print('1) Fill the PRD completely.');
		print('2) Create Taskmaster tag and parse:');
		print(`   task-master add-tag ${slug} --description "Large initiative: ${title}"`);
		print(`   task-master use-tag ${slug}`);
		print(`   task-master parse-prd ${path.relative(repoRoot, destPath)} --tag ${slug} --force`);
		print('3) Analyze, expand, and generate:');
		print(`   task-master analyze-complexity --tag ${slug} --threshold ${args.threshold}`);
		print(`   task-master expand --tag ${slug}`);
		print(`   task-master generate --tag ${slug}`);
		print('4) Work through tasks with: task-master next --tag ' + slug);
		print('5) On completion, run: npm run initiative:archive -- ' + slug);
		return;
	}

	// --auto: ensure PRD appears filled before parsing unless forced
	const content = fs.readFileSync(destPath, 'utf8');
	const hasPlaceholders = /<[^>]+>/.test(content) || /\bTODO\b/i.test(content);
	if (hasPlaceholders && !args.forceAuto) {
		fatal('Refusing to auto-parse because PRD contains placeholders. Edit it first or use --force-auto.');
	}

	function run(cmd, argv) {
		const res = spawnSync(cmd, argv, { stdio: 'inherit' });
		if (res.status !== 0) fatal(`Command failed: ${cmd} ${argv.join(' ')}`);
	}

	print('▶️  Creating Taskmaster tag and parsing PRD...');
	run('task-master', ['add-tag', slug, '--description', `Large initiative: ${title}`]);
	run('task-master', ['use-tag', slug]);
	run('task-master', ['parse-prd', path.relative(repoRoot, destPath), '--tag', slug, '--force']);
	print('▶️  Analyzing complexity, expanding, and generating tasks...');
	run('task-master', ['analyze-complexity', '--tag', slug, '--threshold', String(args.threshold)]);
	run('task-master', ['expand', '--tag', slug]);
	run('task-master', ['generate', '--tag', slug]);
	print('✅ Kickoff complete. Next: implement tasks and track with: task-master next --tag ' + slug);
	print('When done, archive with: npm run initiative:archive -- ' + slug);
})();


