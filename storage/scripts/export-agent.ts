#!/usr/bin/env tsx
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '../../.env') });
/**
 * Export Single Agent Script
 *
 * Exports a specific agent from the database to a JSON file.
 *
 * Usage:
 *   npm run export-agent <org-slug> <agent-slug> [output-dir]
 *
 * Examples:
 *   npm run export-agent demo blog_post_writer
 *   npm run export-agent global image-generator-openai working
 *   npm run export-agent demo marketing_swarm exported
 *
 * Or directly:
 *   tsx scripts/export-agent.ts demo blog_post_writer
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function exportAgent(orgSlug: string, agentSlug: string, outputDir: string = 'exported') {
  console.log(`🔍 Fetching agent: ${orgSlug}/${agentSlug}\n`);

  // Fetch agent from database
  let query = supabase.from('agents').select('*').eq('slug', agentSlug).limit(1);

  query = orgSlug === 'global' || orgSlug === 'null'
    ? query.is('organization_slug', null)
    : query.eq('organization_slug', orgSlug);

  const { data: agents, error } = await query;

  if (error) {
    console.error('❌ Error fetching agent:', error.message);
    process.exit(1);
  }

  if (!agents || agents.length === 0) {
    console.error(`❌ Agent not found: ${orgSlug}/${agentSlug}`);
    console.error(`\nTry running: npm run list-agents`);
    process.exit(1);
  }

  const agent = agents[0];

  // Create output directory if it doesn't exist
  const dir = path.join(__dirname, '..', outputDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write to file
  const filename = `${orgSlug}_${agentSlug}.json`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(agent, null, 2), 'utf-8');

  console.log(`✅ Exported agent successfully!\n`);
  console.log(`📦 Agent Details:`);
  console.log(`   Organization: ${agent.organization_slug || 'global'}`);
  console.log(`   Slug: ${agent.slug}`);
  console.log(`   Display Name: ${agent.display_name}`);
  console.log(`   Type: ${agent.agent_type}`);
  console.log(`   Mode Profile: ${agent.mode_profile}`);
  console.log(`\n📁 File Location:`);
  console.log(`   ${filepath}`);
  console.log('');
}

// Get args
const orgSlug = process.argv[2];
const agentSlug = process.argv[3];
const outputDir = process.argv[4];

if (!orgSlug || !agentSlug) {
  console.error('❌ Error: Missing required arguments\n');
  console.error('Usage: npm run export-agent <org-slug> <agent-slug> [output-dir]');
  console.error('Examples:');
  console.error('  npm run export-agent demo blog_post_writer');
  console.error('  npm run export-agent global image-generator-openai working');
  process.exit(1);
}

exportAgent(orgSlug, agentSlug, outputDir).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
