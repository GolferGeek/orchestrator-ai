#!/usr/bin/env tsx
/**
 * Import LangGraph Agents Script
 *
 * Imports the three LangGraph agents from JSON files to the database.
 * Reads from storage/snapshots/agents/ and upserts to database.
 *
 * Usage:
 *   tsx storage/scripts/import-langgraph-agents.ts
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

const LANGGRAPH_AGENTS = [
  'demo_marketing_swarm_langgraph.json',
  'demo_requirements_writer_langgraph.json',
  'demo_metrics_agent_langgraph.json',
];

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
  context?: any;
  function_code?: string | null;
  plan_structure?: any;
  deliverable_structure?: any;
  io_schema?: any;
  created_at?: string;
  updated_at?: string;
}

async function importLangGraphAgents() {
  console.log('🚀 Importing LangGraph agents from JSON files...\n');

  const agentsDir = path.join(__dirname, '..', 'snapshots', 'agents');

  if (!fs.existsSync(agentsDir)) {
    console.error(`❌ Error: Directory not found: ${agentsDir}`);
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const filename of LANGGRAPH_AGENTS) {
    const filepath = path.join(agentsDir, filename);

    if (!fs.existsSync(filepath)) {
      console.error(`⚠️  File not found: ${filename}`);
      console.error(`   (Create this file from the SQL or export from database)\n`);
      errorCount++;
      continue;
    }

    try {
      console.log(`📥 Importing: ${filename}...`);

      // Read and parse JSON
      const fileContent = fs.readFileSync(filepath, 'utf-8');
      const agentData: AgentRecord = JSON.parse(fileContent);

      // Validate required fields
      const requiredFields = ['slug', 'display_name', 'agent_type', 'mode_profile', 'yaml'];
      const missingFields = requiredFields.filter((field) => !(field in agentData));

      if (missingFields.length > 0) {
        console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
        errorCount++;
        continue;
      }

      // Prepare data for upsert (remove id and timestamps)
      const { id, created_at, updated_at, ...upsertData } = agentData as any;

      // Upsert to database
      const { data, error } = await supabase
        .from('agents')
        .upsert(upsertData, {
          onConflict: 'organization_slug,slug',
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error upserting ${agentData.slug}:`, error.message);
        errorCount++;
        continue;
      }

      console.log(`✅ Imported: ${data.slug} (ID: ${data.id})`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error processing ${filename}:`, err);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Import complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${errorCount}`);
  console.log('='.repeat(60));
}

importLangGraphAgents().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});


