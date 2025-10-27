#!/usr/bin/env tsx
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '../../.env') });
/**
 * Delete Agent Script
 *
 * Deletes an agent from the database.
 * CAUTION: This is permanent! Make sure you have exported the agent first.
 *
 * Usage:
 *   npm run delete-agent <org-slug> <agent-slug>
 *
 * Examples:
 *   npm run delete-agent demo blog_post_writer
 *   npm run delete-agent global image-generator-openai
 *
 * Or directly:
 *   tsx scripts/delete-agent.ts demo blog_post_writer
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function deleteAgent(orgSlug: string, agentSlug: string) {
  console.log(`🔍 Looking for agent: ${orgSlug}/${agentSlug}\n`);

  // First, verify agent exists
  let query = supabase.from('agents').select('*').eq('slug', agentSlug).limit(1);

  query = orgSlug === 'global' || orgSlug === 'null'
    ? query.is('organization_slug', null)
    : query.eq('organization_slug', orgSlug);

  const { data: agents, error: fetchError } = await query;

  if (fetchError) {
    console.error('❌ Error fetching agent:', fetchError.message);
    process.exit(1);
  }

  if (!agents || agents.length === 0) {
    console.error(`❌ Agent not found: ${orgSlug}/${agentSlug}`);
    console.error(`\nTry running: npm run list-agents`);
    process.exit(1);
  }

  const agent = agents[0];

  // Show agent details
  console.log(`📦 Found Agent:`);
  console.log(`   ID: ${agent.id}`);
  console.log(`   Organization: ${agent.organization_slug || 'global'}`);
  console.log(`   Slug: ${agent.slug}`);
  console.log(`   Display Name: ${agent.display_name}`);
  console.log(`   Type: ${agent.agent_type}`);
  console.log(`   Mode Profile: ${agent.mode_profile}`);
  console.log('');

  // Ask for confirmation
  const confirmed = await askConfirmation(
    `⚠️  Are you sure you want to DELETE this agent? (yes/no): `
  );

  if (!confirmed) {
    console.log('❌ Deletion cancelled');
    process.exit(0);
  }

  // Delete the agent
  console.log('\n🗑️  Deleting agent...');

  let deleteQuery = supabase.from('agents').delete().eq('slug', agentSlug);

  deleteQuery = orgSlug === 'global' || orgSlug === 'null'
    ? deleteQuery.is('organization_slug', null)
    : deleteQuery.eq('organization_slug', orgSlug);

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    console.error('❌ Error deleting agent:', deleteError.message);
    process.exit(1);
  }

  console.log(`✅ Agent deleted successfully: ${orgSlug}/${agentSlug}\n`);
}

// Get args
const orgSlug = process.argv[2];
const agentSlug = process.argv[3];

if (!orgSlug || !agentSlug) {
  console.error('❌ Error: Missing required arguments\n');
  console.error('Usage: npm run delete-agent <org-slug> <agent-slug>');
  console.error('Examples:');
  console.error('  npm run delete-agent demo blog_post_writer');
  console.error('  npm run delete-agent global image-generator-openai');
  process.exit(1);
}

deleteAgent(orgSlug, agentSlug).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
