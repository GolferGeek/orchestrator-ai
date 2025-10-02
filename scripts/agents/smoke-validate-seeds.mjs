#!/usr/bin/env node
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const API_BASE = process.env.API_BASE || 'http://localhost:7100';
const TOKEN = process.env.TOKEN;
const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

async function validateOne(path) {
  const body = await readFile(path, 'utf8');
  const res = await fetch(`${API_BASE}/api/admin/agents/validate?dryRun=true`, {
    method: 'POST',
    headers,
    body,
  });
  const json = await res.json();
  return json;
}

async function main() {
  const files = [
    resolve('docs/feature/matt/payloads/blog_post_writer.json'),
    resolve('docs/feature/matt/payloads/hr_assistant.json'),
  ];
  for (const f of files) {
    process.stdout.write(`Validating: ${f}\n`);
    try {
      const out = await validateOne(f);
      const ok = out?.success && (!out?.issues || out.issues.length === 0) && (!out?.dryRun || out.dryRun.ok !== false);
      process.stdout.write(`  success=${ok} issues=${(out.issues || []).length}\n`);
      if (out?.dryRun) {
        process.stdout.write(`  dryRun: ${JSON.stringify(out.dryRun).slice(0, 200)}...\n`);
      }
    } catch (e) {
      process.stdout.write(`  error: ${e?.message}\n`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
