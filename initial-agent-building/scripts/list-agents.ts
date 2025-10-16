#!/usr/bin/env tsx
import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.join(__dirname, '../../.env') });
/**
 * List Agents Script
 *
 * Shows all agents currently in the database with their key properties.
 *
 * Usage:
 *   npm run list-agents
 *
 * Or directly:
 *   tsx scripts/list-agents.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AgentRecord {
  id: string;
  organization_slug: string | null;
  slug: string;
  display_name: string;
  agent_type: string;
  mode_profile: string;
  status: string | null;
  plan_structure: any;
  deliverable_structure: any;
  io_schema: any;
}

async function listAgents() {
  console.log('🔍 Fetching agents from database...\n');

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
    console.log('📭 No agents found in database\n');
    console.log('💡 Tip: Run `npm run export-all` to export agents from database');
    console.log('   Or: Run `npm run load-agent <file>` to load an agent');
    return;
  }

  console.log(`📦 Found ${agents.length} agents\n`);
  console.log('='.repeat(100));

  // Group by organization
  const byOrg: Record<string, AgentRecord[]> = {};
  for (const agent of agents as AgentRecord[]) {
    const org = agent.organization_slug || 'global';
    if (!byOrg[org]) byOrg[org] = [];
    byOrg[org].push(agent);
  }

  // Print by organization
  for (const [org, orgAgents] of Object.entries(byOrg)) {
    console.log(`\n🏢 Organization: ${org}`);
    console.log('-'.repeat(100));

    for (const agent of orgAgents) {
      const hasPlan = agent.plan_structure ? '✅' : '❌';
      const hasDeliv = agent.deliverable_structure ? '✅' : '❌';
      const hasIO = agent.io_schema ? '✅' : '❌';

      console.log(`\n   📌 ${agent.slug}`);
      console.log(`      Display Name: ${agent.display_name}`);
      console.log(`      Type: ${agent.agent_type.padEnd(15)} Mode: ${agent.mode_profile}`);
      console.log(`      Status: ${agent.status || 'active'}`);
      console.log(`      Schemas: plan=${hasPlan}  deliverable=${hasDeliv}  io=${hasIO}`);
    }
  }

  console.log('\n' + '='.repeat(100));

  // Summary by type
  const byType: Record<string, number> = {};
  for (const agent of agents as AgentRecord[]) {
    byType[agent.agent_type] = (byType[agent.agent_type] || 0) + 1;
  }

  console.log('\n📊 Summary by Agent Type:');
  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${type.padEnd(20)}: ${count}`);
  }

  // Summary of schema completion
  const withPlan = agents.filter((a: AgentRecord) => a.plan_structure).length;
  const withDeliv = agents.filter((a: AgentRecord) => a.deliverable_structure).length;
  const withIO = agents.filter((a: AgentRecord) => a.io_schema).length;

  console.log('\n📋 Schema Completion:');
  console.log(`   Agents with plan_structure:        ${withPlan}/${agents.length}`);
  console.log(`   Agents with deliverable_structure: ${withDeliv}/${agents.length}`);
  console.log(`   Agents with io_schema:             ${withIO}/${agents.length}`);
  console.log('');
}

listAgents().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
