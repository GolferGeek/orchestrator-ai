#!/usr/bin/env node
/*
  Inventory filesystem agents under apps/api/src/agents and emit a Markdown summary.
  - Scans for agent.yaml files
  - Extracts key fields: display name, type, department/category, API endpoint (if any)
  - Prints a Markdown table and JSON block for further processing
*/

const fs = require('fs');
const path = require('path');
let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  console.error('Missing dependency js-yaml. Install at the repo root: npm i js-yaml');
  process.exit(1);
}

const ROOT = process.cwd();
const AGENTS_DIR = path.join(ROOT, 'apps', 'api', 'src', 'agents');

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name === 'agent.yaml') {
      out.push(full);
    }
  }
  return out;
}

function safeGet(obj, pathStr, def) {
  try {
    const parts = pathStr.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return def;
      cur = cur[p];
    }
    return cur == null ? def : cur;
  } catch (_) {
    return def;
  }
}

function parseYaml(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return yaml.load(raw);
  } catch (e) {
    return null;
  }
}

function collect() {
  if (!fs.existsSync(AGENTS_DIR)) {
    console.error('Agents directory not found:', AGENTS_DIR);
    process.exit(2);
  }
  const files = walk(AGENTS_DIR);
  const agents = [];
  for (const file of files) {
    const doc = parseYaml(file) || {};
    const rel = path.relative(AGENTS_DIR, path.dirname(file));
    const record = {
      path: rel,
      name: safeGet(doc, 'metadata.name', null) || safeGet(doc, 'name', null) || path.basename(rel),
      type: (doc.type || safeGet(doc, 'metadata.type', null) || 'unknown'),
      category: safeGet(doc, 'metadata.category', null) || safeGet(doc, 'hierarchy.department', null) || null,
      apiEndpoint: safeGet(doc, 'api_configuration.endpoint', null),
      executionProfile: safeGet(doc, 'configuration.execution_profile', null),
      canPlan: Boolean(safeGet(doc, 'configuration.execution_capabilities.can_plan', false)),
      canBuild: Boolean(safeGet(doc, 'configuration.execution_capabilities.can_build', false)),
    };
    agents.push(record);
  }
  return agents;
}

function printMarkdown(list) {
  const header = `# Filesystem Agent Inventory\n\nTotal: ${list.length}\n\n| Path | Name | Type | Category | API Endpoint | Plan | Build |\n| --- | --- | --- | --- | --- | --- | --- |`;
  const rows = list
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((a) => {
      const endpoint = a.apiEndpoint ? '`' + a.apiEndpoint + '`' : '';
      return `| ${a.path} | ${a.name} | ${a.type} | ${a.category ?? ''} | ${endpoint} | ${a.canPlan ? 'yes' : ''} | ${a.canBuild ? 'yes' : ''} |`;
    })
    .join('\n');
  console.log([header, rows, '', '```json', JSON.stringify(list, null, 2), '```', ''].join('\n'));
}

const agents = collect();
printMarkdown(agents);

