#!/usr/bin/env tsx
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '../../.env') });
/**
 * Load Agent Script
 *
 * Loads an agent from a JSON file into the database.
 * Uses upsert, so it will update if agent already exists.
 *
 * Usage:
 *   npm run load-agent <filename>
 *
 * Examples:
 *   npm run load-agent working/demo_blog_post_writer.json
 *   npm run load-agent exported/global_image-generator-openai.json
 *
 * Or directly:
 *   tsx scripts/load-agent.ts working/demo_blog_post_writer.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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
}

async function loadAgent(filename: string) {
  console.log('🚀 Loading agent from file...\n');

  // Resolve filename (support relative paths from initial-agent-building directory)
  let filepath = filename;
  if (!path.isAbsolute(filename)) {
    filepath = path.join(__dirname, '..', filename);
  }

  // Check file exists
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Error: File not found: ${filepath}`);
    console.error(`\nUsage: npm run load-agent <filename>`);
    console.error(`Example: npm run load-agent working/demo_blog_post_writer.json`);
    process.exit(1);
  }

  // Read and parse JSON
  let agentData: AgentRecord;
  try {
    const fileContent = fs.readFileSync(filepath, 'utf-8');
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
  console.log(`   Type: ${agentData.agent_type}`);
  console.log(`   Mode Profile: ${agentData.mode_profile}`);
  console.log(`   Has plan_structure: ${agentData.plan_structure ? '✅' : '❌'}`);
  console.log(`   Has deliverable_structure: ${agentData.deliverable_structure ? '✅' : '❌'}`);
  console.log(`   Has io_schema: ${agentData.io_schema ? '✅' : '❌'}`);
  console.log('');

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
    process.exit(1);
  }

  console.log('✅ Agent loaded successfully!\n');
  console.log('📊 Database Record:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Organization: ${data.organization_slug || 'global'}`);
  console.log(`   Slug: ${data.slug}`);
  console.log(`   Display Name: ${data.display_name}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Updated: ${data.updated_at}`);
  console.log('');
}

// Get filename from command line args
const filename = process.argv[2];

if (!filename) {
  console.error('❌ Error: No filename provided\n');
  console.error('Usage: npm run load-agent <filename>');
  console.error('Example: npm run load-agent working/demo_blog_post_writer.json');
  process.exit(1);
}

// Run the load
loadAgent(filename).catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
