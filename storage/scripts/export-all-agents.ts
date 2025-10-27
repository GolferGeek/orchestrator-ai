#!/usr/bin/env tsx
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '../../.env') });
/**
 * Export All Agents Script
 *
 * Exports all agents from the database to JSON files in the exported/ directory.
 * Each agent is saved as: {organization_slug}_{agent_slug}.json
 *
 * Usage:
 *   npm run export-all
 *
 * Or directly:
 *   tsx scripts/export-all-agents.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.error('Please set it in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AgentRecord {
  id: string;
  organization_slug: string | null;
  slug: string;
  display_name: string;
  description: string | null;
  agent_type: string;
  mode_profile: string;
  version: string | null;
  status: string | null;
  yaml: string;
  agent_card: any;
  context: any;
  config: any;
  created_at: string;
  updated_at: string;
  function_code: string | null;
  plan_structure: any;
  deliverable_structure: any;
  io_schema: any;
}

async function exportAllAgents() {
  console.log('🚀 Starting agent export...\n');

  // Fetch all agents from database
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .order('organization_slug', { ascending: true })
    .order('slug', { ascending: true });

  if (error) {
    console.error('❌ Error fetching agents:', error.message);
    process.exit(1);
  }

  if (!agents || agents.length === 0) {
    console.log('⚠️  No agents found in database');
    return;
  }

  console.log(`📦 Found ${agents.length} agents to export\n`);

  // Create exported directory if it doesn't exist
  const exportDir = path.join(__dirname, '..', 'exported');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Export each agent
  let successCount = 0;
  let errorCount = 0;

  for (const agent of agents as AgentRecord[]) {
    try {
      const orgSlug = agent.organization_slug || 'global';
      const filename = `${orgSlug}_${agent.slug}.json`;
      const filepath = path.join(exportDir, filename);

      // Write agent to file with pretty formatting
      fs.writeFileSync(filepath, JSON.stringify(agent, null, 2), 'utf-8');

      console.log(`✅ Exported: ${orgSlug}/${agent.slug} (${agent.agent_type})`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error exporting ${agent.slug}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Export complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${errorCount}`);
  console.log(`   Location: ${exportDir}`);
  console.log('='.repeat(60) + '\n');

  // Print summary by agent type
  const byType: Record<string, number> = {};
  for (const agent of agents as AgentRecord[]) {
    byType[agent.agent_type] = (byType[agent.agent_type] || 0) + 1;
  }

  console.log('📊 Agent Summary by Type:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${type}: ${count}`);
  }
  console.log('');
}

// Run the export
exportAllAgents().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
