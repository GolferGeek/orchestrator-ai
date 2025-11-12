#!/usr/bin/env tsx
/**
 * Export LangGraph Agents Script
 *
 * Exports the three LangGraph agents from the database to storage/snapshots/agents/
 *
 * Usage:
 *   tsx storage/scripts/export-langgraph-agents.ts
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
  { orgSlug: 'demo', slug: 'marketing-swarm-langgraph' },
  { orgSlug: 'demo', slug: 'requirements-writer-langgraph' },
  { orgSlug: 'demo', slug: 'metrics-agent-langgraph' },
];

async function exportLangGraphAgents() {
  console.log('🚀 Exporting LangGraph agents from database...\n');

  const outputDir = path.join(__dirname, '..', 'snapshots', 'agents');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const { orgSlug, slug } of LANGGRAPH_AGENTS) {
    try {
      console.log(`🔍 Fetching: ${orgSlug}/${slug}...`);

      // Fetch agent from database
      let query = supabase.from('agents').select('*').eq('slug', slug).limit(1);

      query = orgSlug === 'global' || orgSlug === 'null'
        ? query.is('organization_slug', null)
        : query.eq('organization_slug', orgSlug);

      const { data: agents, error } = await query;

      if (error) {
        console.error(`❌ Error fetching ${slug}:`, error.message);
        errorCount++;
        continue;
      }

      if (!agents || agents.length === 0) {
        console.error(`⚠️  Agent not found in database: ${orgSlug}/${slug}`);
        console.error(`   (This is OK if it hasn't been inserted yet)\n`);
        errorCount++;
        continue;
      }

      const agent = agents[0];

      // Write to file (use demo_ prefix to match existing naming convention)
      const filename = `demo_${slug}.json`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(agent, null, 2), 'utf-8');

      console.log(`✅ Exported: ${filename}`);
      console.log(`   ID: ${agent.id}`);
      console.log(`   Type: ${agent.agent_type}`);
      console.log(`   Status: ${agent.status || 'null'}\n`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error exporting ${slug}:`, err);
      errorCount++;
    }
  }

  console.log('='.repeat(60));
  console.log(`✨ Export complete!`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed/Not Found: ${errorCount}`);
  console.log(`   Location: ${outputDir}`);
  console.log('='.repeat(60));
}

exportLangGraphAgents().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});


