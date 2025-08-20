#!/usr/bin/env node
/* Print the current PRD conversation recipe and quick-start commands */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const recipe = path.join(repoRoot, 'docs', 'prd', 'CONVERSATION-RECIPE.md');

if (fs.existsSync(recipe)) {
	process.stdout.write(fs.readFileSync(recipe, 'utf8'));
} else {
	process.stdout.write('Missing docs/prd/CONVERSATION-RECIPE.md');
}


