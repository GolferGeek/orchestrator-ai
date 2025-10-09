#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateSQLMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔄 Generating SQL Migration from Clean Data');
  console.log('==========================================\n');

  // Create migrations directory
  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', '_').substring(0, 15);
  const migrationFile = path.join(migrationsDir, `${timestamp}_clean_database_migration.sql`);

  // Core tables to export with their expected data
  const coreTables = [
    { name: 'llm_providers', order: 1 },
    { name: 'llm_models', order: 2 },
    { name: 'cidafm_commands', order: 3 },
    { name: 'users', order: 4 },
    { name: 'user_cidafm_commands', order: 5 },
    { name: 'projects', order: 6 },
    { name: 'agent_conversations', order: 7 },
    { name: 'tasks', order: 8 },
    { name: 'deliverables', order: 9 },
    { name: 'project_steps', order: 10 },
    { name: 'langgraph_states', order: 11 },
    { name: 'human_inputs', order: 12 },
    { name: 'kpi_data', order: 13 },
    { name: 'kpi_goals', order: 14 }
  ];

  let migrationSQL = `-- Clean Database Migration
-- Generated: ${new Date().toISOString()}
-- Description: Migration with cleaned production data for local development
-- 
-- This migration:
-- 1. Clears existing data from core tables
-- 2. Inserts cleaned production data
-- 3. Maintains referential integrity
-- 4. Removes test/development cruft

-- =============================================================================
-- PART 1: CLEANUP - Remove existing data in dependency order
-- =============================================================================

-- Disable foreign key checks temporarily (if supported)
-- SET foreign_key_checks = 0;

BEGIN;

-- Clear data in reverse dependency order
TRUNCATE TABLE human_inputs CASCADE;
TRUNCATE TABLE langgraph_states CASCADE;
TRUNCATE TABLE project_steps CASCADE;
TRUNCATE TABLE deliverables CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE agent_conversations CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE user_cidafm_commands CASCADE;
TRUNCATE TABLE kpi_data CASCADE;
TRUNCATE TABLE kpi_goals CASCADE;
-- Keep users table for existing accounts
TRUNCATE TABLE cidafm_commands CASCADE;
TRUNCATE TABLE llm_models CASCADE;
TRUNCATE TABLE llm_providers CASCADE;

-- =============================================================================
-- PART 2: DATA INSERTION - Insert cleaned data in dependency order
-- =============================================================================

`;

  const tableData = {};
  const exportSummary = {
    generatedAt: new Date().toISOString(),
    tables: {},
    totalRecords: 0
  };

  // Sort tables by dependency order
  const orderedTables = coreTables.sort((a, b) => a.order - b.order);

  for (const tableInfo of orderedTables) {
    const tableName = tableInfo.name;
    
    try {
      console.log(`📊 Fetching ${tableName}...`);
      
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' });
      
      if (error) {
        console.log(`   └─ ⚠️  Error accessing ${tableName}: ${error.message}`);
        exportSummary.tables[tableName] = { 
          status: 'error', 
          error: error.message,
          records: 0 
        };
        continue;
      }
      
      const recordCount = data?.length || 0;
      tableData[tableName] = data || [];
      exportSummary.tables[tableName] = { 
        status: 'success', 
        records: recordCount 
      };
      exportSummary.totalRecords += recordCount;
      
      console.log(`   └─ ✅ Fetched ${recordCount} records from ${tableName}`);
      
      // Generate SQL INSERT statements
      if (recordCount > 0) {
        migrationSQL += `-- Insert data for ${tableName} (${recordCount} records)\n`;
        
        // Get the first record to determine column structure
        const firstRecord = data[0];
        const columns = Object.keys(firstRecord);
        
        migrationSQL += `INSERT INTO ${tableName} (${columns.map(col => `"${col}"`).join(', ')}) VALUES\n`;
        
        const valueLines = data.map((record, index) => {
          const values = columns.map(col => {
            const value = record[col];
            if (value === null || value === undefined) {
              return 'NULL';
            } else if (typeof value === 'string') {
              // Escape single quotes and wrap in quotes
              return `'${value.replace(/'/g, "''")}'`;
            } else if (typeof value === 'boolean') {
              return value ? 'TRUE' : 'FALSE';
            } else if (typeof value === 'object') {
              // Handle JSON objects
              return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
            } else if (value instanceof Date || (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value))) {
              return `'${value}'::timestamp with time zone`;
            } else {
              return String(value);
            }
          });
          
          const isLast = index === data.length - 1;
          return `  (${values.join(', ')})${isLast ? ';' : ','}`;
        });
        
        migrationSQL += valueLines.join('\n');
        migrationSQL += '\n\n';
      } else {
        migrationSQL += `-- No data to insert for ${tableName}\n\n`;
      }
      
    } catch (error) {
      console.log(`   └─ 💥 Exception fetching ${tableName}: ${error.message}`);
      exportSummary.tables[tableName] = { 
        status: 'exception', 
        error: error.message,
        records: 0 
      };
    }
  }

  migrationSQL += `-- =============================================================================
-- PART 3: POST-MIGRATION TASKS
-- =============================================================================

-- Update sequences to prevent ID conflicts
-- (This ensures auto-incrementing IDs start after existing data)
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), false);
SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 1), false);
SELECT setval(pg_get_serial_sequence('deliverables', 'id'), COALESCE((SELECT MAX(id) FROM deliverables), 1), false);

-- Re-enable foreign key checks
-- SET foreign_key_checks = 1;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Uncomment these to verify the migration worked correctly:
/*
SELECT 'llm_providers' as table_name, count(*) as records FROM llm_providers
UNION ALL
SELECT 'llm_models', count(*) FROM llm_models  
UNION ALL
SELECT 'cidafm_commands', count(*) FROM cidafm_commands
UNION ALL
SELECT 'users', count(*) FROM users
UNION ALL
SELECT 'agent_conversations', count(*) FROM agent_conversations
UNION ALL
SELECT 'tasks', count(*) FROM tasks
UNION ALL
SELECT 'projects', count(*) FROM projects
UNION ALL
SELECT 'deliverables', count(*) FROM deliverables
ORDER BY table_name;
*/

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Summary:
-- Total records migrated: ${exportSummary.totalRecords}
-- Tables processed: ${Object.keys(exportSummary.tables).length}
-- Generated: ${exportSummary.generatedAt}
`;

  // Write the migration file
  console.log('\n💾 Writing SQL migration file...');
  try {
    fs.writeFileSync(migrationFile, migrationSQL);
    console.log(`   └─ ✅ Written ${path.basename(migrationFile)}`);
  } catch (error) {
    console.log(`   └─ ❌ Failed to write migration file: ${error.message}`);
    process.exit(1);
  }

  // Create a rollback migration as well
  const rollbackFile = path.join(migrationsDir, `${timestamp}_rollback_clean_database_migration.sql`);
  const rollbackSQL = `-- Rollback Migration for Clean Database
-- Generated: ${new Date().toISOString()}
-- Description: Rollback script to undo the clean database migration

BEGIN;

-- Clear all data that was inserted by the migration
TRUNCATE TABLE human_inputs CASCADE;
TRUNCATE TABLE langgraph_states CASCADE;
TRUNCATE TABLE project_steps CASCADE;
TRUNCATE TABLE deliverables CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE agent_conversations CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE user_cidafm_commands CASCADE;
TRUNCATE TABLE kpi_data CASCADE;
TRUNCATE TABLE kpi_goals CASCADE;
TRUNCATE TABLE cidafm_commands CASCADE;
TRUNCATE TABLE llm_models CASCADE;
TRUNCATE TABLE llm_providers CASCADE;

COMMIT;

-- Note: This rollback removes all data from the affected tables.
-- If you need to restore the original data, you'll need to use your
-- original database backup.
`;

  try {
    fs.writeFileSync(rollbackFile, rollbackSQL);
    console.log(`   └─ ✅ Written ${path.basename(rollbackFile)}`);
  } catch (error) {
    console.log(`   └─ ⚠️  Failed to write rollback file: ${error.message}`);
  }

  // Create migration summary
  const summaryFile = path.join(migrationsDir, `${timestamp}_migration_summary.json`);
  try {
    fs.writeFileSync(summaryFile, JSON.stringify(exportSummary, null, 2));
    console.log(`   └─ ✅ Written ${path.basename(summaryFile)}`);
  } catch (error) {
    console.log(`   └─ ⚠️  Failed to write summary file: ${error.message}`);
  }

  // Create usage instructions
  const instructionsFile = path.join(migrationsDir, 'README.md');
  const instructionsContent = `# Database Migration Files

Generated: ${exportSummary.generatedAt}

## Files in this directory:

- \`${timestamp}_clean_database_migration.sql\` - Main migration script
- \`${timestamp}_rollback_clean_database_migration.sql\` - Rollback script  
- \`${timestamp}_migration_summary.json\` - Migration statistics
- \`README.md\` - This file

## Usage:

### For Local Supabase:

1. Start local Supabase:
   \`\`\`bash
   npm run supabase:start
   \`\`\`

2. Run the migration:
   \`\`\`bash
   psql "postgresql://postgres:postgres@localhost:7012/postgres" -f ${timestamp}_clean_database_migration.sql
   \`\`\`

3. Update your environment:
   \`\`\`bash
   export SUPABASE_MODE=local
   npm run dev
   \`\`\`

### For Production Database:

⚠️ **CAUTION**: This will replace existing data. Always backup first!

\`\`\`bash
psql "your-production-connection-string" -f ${timestamp}_clean_database_migration.sql
\`\`\`

### To Rollback:

\`\`\`bash
psql "your-connection-string" -f ${timestamp}_rollback_clean_database_migration.sql
\`\`\`

## Migration Summary:

- **Total Records**: ${exportSummary.totalRecords}
- **Tables Processed**: ${Object.keys(exportSummary.tables).length}
- **Successful Tables**: ${Object.values(exportSummary.tables).filter(t => t.status === 'success').length}

### Table Breakdown:

${Object.entries(exportSummary.tables)
  .map(([table, info]) => `- **${table}**: ${info.status} (${info.records} records)`)
  .join('\n')}

## Benefits of SQL Migration vs JSON:

✅ **Version Control Friendly**: Readable diffs  
✅ **Database Agnostic**: Works with any PostgreSQL instance  
✅ **Transaction Safe**: Atomic operations with BEGIN/COMMIT  
✅ **Performance**: Direct SQL is faster than JSON imports  
✅ **Professional**: Standard database migration approach  
✅ **Debugging**: Easy to read and modify SQL statements  

## Integration with Supabase CLI:

You can integrate this with Supabase migrations:

1. Copy the migration file to your Supabase migrations folder:
   \`\`\`bash
   cp ${timestamp}_clean_database_migration.sql supabase/migrations/
   \`\`\`

2. Run via Supabase CLI:
   \`\`\`bash
   supabase db reset --local
   \`\`\`
`;

  try {
    fs.writeFileSync(instructionsFile, instructionsContent);
    console.log(`   └─ ✅ Written README.md with usage instructions`);
  } catch (error) {
    console.log(`   └─ ⚠️  Failed to write instructions: ${error.message}`);
  }

  console.log('\n🎉 SQL Migration Generation Complete!');
  console.log('====================================');
  console.log(`📁 Location: ${migrationsDir}`);
  console.log(`📊 Total Records: ${exportSummary.totalRecords}`);
  console.log(`📋 Tables Processed: ${Object.keys(exportSummary.tables).length}`);
  
  const successfulTables = Object.values(exportSummary.tables).filter(t => t.status === 'success').length;
  console.log(`✅ Successful: ${successfulTables}`);
  
  const errorTables = Object.values(exportSummary.tables).filter(t => t.status !== 'success').length;
  if (errorTables > 0) {
    console.log(`⚠️  Errors: ${errorTables}`);
  }
  
  console.log('\n📖 Key Advantages of SQL Migration:');
  console.log('===================================');
  console.log('✅ Version control friendly (readable diffs)');
  console.log('✅ Standard database migration approach');
  console.log('✅ Transaction-safe with BEGIN/COMMIT');
  console.log('✅ Works with any PostgreSQL instance');
  console.log('✅ Better performance than JSON imports');
  console.log('✅ Easy to customize and debug');
  
  console.log('\n🚀 Usage:');
  console.log('=========');
  console.log(`psql "your-connection-string" -f ${path.basename(migrationFile)}`);
  console.log('\nSee README.md for detailed instructions.');
}

generateSQLMigration().catch(error => {
  console.error('\n💥 SQL migration generation failed:', error);
  process.exit(1);
});