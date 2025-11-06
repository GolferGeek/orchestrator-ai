#!/usr/bin/env tsx
/**
 * Import Agent Script (TypeScript - uses current schema)
 *
 * Reads a JSON agent file and upserts it to the database.
 * JSON files are the source of truth.
 *
 * Usage:
 *   tsx storage/scripts/import-agent.ts <path-to-json>
 *   tsx storage/scripts/import-agent.ts storage/snapshots/agents/demo_marketing_swarm_langgraph.json
 */

import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AgentRecord {
  id?: string;
  organization_slug: string | null;
  slug: string;
  display_name: string;
  description: string | null;
  agent_type: string;
  mode_profile: string;
  version: string | null;
  status: string | null;
  yaml: string;
  agent_card?: any;
  context?: any;
  config?: any;
  function_code?: string | null;
  plan_structure?: any;
  deliverable_structure?: any;
  io_schema?: any;
  created_at?: string;
  updated_at?: string;
}

async function importAgent(filepath: string) {
  console.log('🚀 Importing agent from JSON file...\n');

  // Resolve filepath
  let resolvedPath = filepath;
  if (!path.isAbsolute(filepath)) {
    resolvedPath = path.join(process.cwd(), filepath);
  }

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Read and parse JSON
  let agentData: AgentRecord;
  try {
    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');
    agentData = JSON.parse(fileContent);
  } catch (err) {
    console.error(`❌ Error parsing JSON file:`, err);
    process.exit(1);
  }

  // Validate required fields
  const requiredFields = ['slug', 'display_name', 'agent_type', 'mode_profile', 'yaml'];
  const missingFields = requiredFields.filter((field) => !(field in agentData));

  if (missingFields.length > 0) {
    console.error(`❌ Error: Missing required fields: ${missingFields.join(', ')}`);
    process.exit(1);
  }

  console.log(`📦 Agent: ${agentData.organization_slug || 'global'}/${agentData.slug}`);
  console.log(`   Display Name: ${agentData.display_name}`);
  console.log(`   Type: ${agentData.agent_type}`);
  console.log(`   Mode Profile: ${agentData.mode_profile}`);
  console.log(`   Status: ${agentData.status || 'null'}\n`);

  // Prepare data for upsert (remove id and timestamps, they'll be managed by DB)
  const { id, created_at, updated_at, ...upsertData } = agentData as any;

  // Upsert to database
  console.log('💾 Upserting to database...');
  const { data, error } = await supabase
    .from('agents')
    .upsert(upsertData, {
      onConflict: 'organization_slug,slug',
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error upserting agent:', error.message);
    console.error('   Details:', error);
    process.exit(1);
  }

  console.log('✅ Agent imported successfully!\n');
  console.log('📊 Database Record:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Organization: ${data.organization_slug || 'global'}`);
  console.log(`   Slug: ${data.slug}`);
  console.log(`   Display Name: ${data.display_name}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Updated: ${data.updated_at}`);
  console.log('');
}

// Get filepath from command line args
const filepath = process.argv[2];

if (!filepath) {
  console.error('❌ Error: No filepath provided\n');
  console.error('Usage: tsx storage/scripts/import-agent.ts <path-to-json>');
  console.error('Example: tsx storage/scripts/import-agent.ts storage/snapshots/agents/demo_marketing_swarm_langgraph.json');
  process.exit(1);
}

// Run the import
importAgent(filepath).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});


