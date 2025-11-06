#!/usr/bin/env tsx
/**
 * Generate SQL INSERT statements from JSON agent files
 *
 * Reads JSON files from storage/snapshots/agents/ and generates SQL INSERT statements
 * that can be run to sync the database. This keeps JSON as the source of truth.
 *
 * Usage:
 *   tsx storage/scripts/generate-sql-from-json.ts [output-file]
 *   tsx storage/scripts/generate-sql-from-json.ts apps/langgraph/sql/insert-api-agents.sql
 */

import * as fs from 'fs';
import * as path from 'path';

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
}

function escapeSqlString(str: string | null | undefined): string {
  if (!str) return 'NULL';
  return `'${str.replace(/'/g, "''").replace(/\n/g, '\\n')}'`;
}

function generateSqlFromAgent(agent: AgentRecord): string {
  const orgSlug = agent.organization_slug || 'NULL';
  const orgSlugSql = orgSlug === 'NULL' ? 'NULL' : escapeSqlString(orgSlug);

  return `INSERT INTO agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    version,
    status,
    yaml${agent.context ? ',\n    context' : ''}
) VALUES (
    ${orgSlugSql},
    ${escapeSqlString(agent.slug)},
    ${escapeSqlString(agent.display_name)},
    ${escapeSqlString(agent.description)},
    ${escapeSqlString(agent.agent_type)},
    ${escapeSqlString(agent.mode_profile)},
    ${escapeSqlString(agent.version)},
    ${escapeSqlString(agent.status)},
    ${escapeSqlString(agent.yaml)}${agent.context ? `,\n    '${JSON.stringify(agent.context).replace(/'/g, "''")}'::jsonb` : ''}
) ON CONFLICT (organization_slug, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    yaml = EXCLUDED.yaml,
    updated_at = now();`;
}

function generateSqlFromJsonFiles(
  agentsDir: string,
  filter?: (filename: string) => boolean,
): string {
  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.json'));

  let sql = `-- Auto-generated SQL from JSON agent files
-- Generated: ${new Date().toISOString()}
-- Source: ${agentsDir}
-- 
-- This file is generated from JSON files. Edit the JSON files and regenerate this SQL.
-- To regenerate: tsx storage/scripts/generate-sql-from-json.ts ${agentsDir}

`;

  const filteredFiles = filter ? files.filter(filter) : files;

  for (let i = 0; i < filteredFiles.length; i++) {
    const filename = filteredFiles[i];
    const filepath = path.join(agentsDir, filename);

    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const agent: AgentRecord = JSON.parse(content);

      // Extract display name for comment
      const displayName = agent.display_name || agent.slug;

      sql += `-- ${i + 1}. ${displayName} (${agent.slug})\n`;
      sql += generateSqlFromAgent(agent);
      sql += '\n\n';
    } catch (err) {
      console.error(`⚠️  Error processing ${filename}:`, err);
    }
  }

  sql += `-- Verify the inserts
SELECT organization_slug, slug, display_name, agent_type, status FROM agents
WHERE slug IN (${filteredFiles
    .map((f) => {
      const content = fs.readFileSync(path.join(agentsDir, f), 'utf-8');
      const agent: AgentRecord = JSON.parse(content);
      return escapeSqlString(agent.slug);
    })
    .join(', ')})
ORDER BY slug;
`;

  return sql;
}

async function main() {
  const agentsDir = path.join(__dirname, '..', 'snapshots', 'agents');
  const outputFile = process.argv[2] || 'apps/langgraph/sql/insert-api-agents.sql';

  if (!fs.existsSync(agentsDir)) {
    console.error(`❌ Error: Directory not found: ${agentsDir}`);
    process.exit(1);
  }

  console.log('🔧 Generating SQL from JSON files...\n');
  console.log(`📁 Source: ${agentsDir}`);
  console.log(`📄 Output: ${outputFile}\n`);

  // Filter for LangGraph agents if generating the LangGraph SQL file
  const filter =
    outputFile.includes('langgraph') || outputFile.includes('insert-api-agents')
      ? (filename: string) =>
          filename.includes('langgraph') ||
          filename.includes('marketing-swarm-langgraph') ||
          filename.includes('requirements-writer-langgraph') ||
          filename.includes('metrics-agent-langgraph')
      : undefined;

  const sql = generateSqlFromJsonFiles(agentsDir, filter);

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, sql, 'utf-8');

  console.log('✅ SQL generated successfully!');
  console.log(`\n📝 To apply to database:`);
  console.log(`   psql -h 127.0.0.1 -p 7012 -U postgres -d postgres -f ${outputFile}`);
  console.log(`\n💡 Or use the import script:`);
  console.log(`   npm run db:import-all-agents`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});


