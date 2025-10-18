#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function exportCleanData() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('📦 Exporting Clean Database Data');
  console.log('================================\n');

  // Create exports directory
  const exportDir = path.join(process.cwd(), 'exports', 'clean-data');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Core tables to export with their expected data
  const coreTables = [
    'users',
    'profiles', 
    'agent_conversations',
    'tasks',
    'projects', 
    'deliverables',
    'llm_providers',
    'llm_models',
    'cidafm_commands',
    'user_cidafm_commands',
    'langgraph_states',
    'project_steps',
    'human_inputs',
    'kpi_data',
    'kpi_goals'
  ];

  const exportData = {};
  const exportSummary = {
    exportedAt: new Date().toISOString(),
    tables: {},
    totalRecords: 0
  };

  for (const tableName of coreTables) {
    try {
      console.log(`📊 Exporting ${tableName}...`);
      
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
      exportData[tableName] = data || [];
      exportSummary.tables[tableName] = { 
        status: 'success', 
        records: recordCount,
        actualCount: count || recordCount
      };
      exportSummary.totalRecords += recordCount;
      
      console.log(`   └─ ✅ Exported ${recordCount} records from ${tableName}`);
      
    } catch (error) {
      console.log(`   └─ 💥 Exception exporting ${tableName}: ${error.message}`);
      exportSummary.tables[tableName] = { 
        status: 'exception', 
        error: error.message,
        records: 0 
      };
    }
  }

  // Write individual table files
  console.log('\n💾 Writing export files...');
  for (const [tableName, tableData] of Object.entries(exportData)) {
    const filename = `${tableName}.json`;
    const filepath = path.join(exportDir, filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(tableData, null, 2));
      console.log(`   └─ ✅ Written ${filename} (${tableData.length} records)`);
    } catch (error) {
      console.log(`   └─ ❌ Failed to write ${filename}: ${error.message}`);
    }
  }

  // Write complete export file
  const completeFilepath = path.join(exportDir, 'complete-export.json');
  try {
    fs.writeFileSync(completeFilepath, JSON.stringify(exportData, null, 2));
    console.log(`   └─ ✅ Written complete-export.json`);
  } catch (error) {
    console.log(`   └─ ❌ Failed to write complete export: ${error.message}`);
  }

  // Write summary file
  const summaryFilepath = path.join(exportDir, 'export-summary.json');
  try {
    fs.writeFileSync(summaryFilepath, JSON.stringify(exportSummary, null, 2));
    console.log(`   └─ ✅ Written export-summary.json`);
  } catch (error) {
    console.log(`   └─ ❌ Failed to write summary: ${error.message}`);
  }

  // Generate import script for local Supabase
  const importScriptContent = `#!/usr/bin/env node

// Import script for local Supabase instance
// Run this after setting up local Supabase with: npm run supabase:start

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function importCleanData() {
  // Local Supabase configuration
  const supabaseUrl = process.env.SUPABASE_LOCAL_URL || 'http://localhost:8000';
  const supabaseKey = process.env.SUPABASE_LOCAL_ANON_KEY || process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
  
  if (!supabaseKey) {
    console.error('❌ Missing local Supabase key');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('📥 Importing Clean Data to Local Supabase');
  console.log('=========================================\\n');

  const dataDir = __dirname;
  const summary = JSON.parse(fs.readFileSync(path.join(dataDir, 'export-summary.json')));
  
  // Import tables in dependency order
  const importOrder = [
    'llm_providers',
    'llm_models', 
    'cidafm_commands',
    'users',
    'profiles',
    'user_cidafm_commands',
    'projects',
    'agent_conversations',
    'tasks',
    'deliverables', 
    'project_steps',
    'langgraph_states',
    'human_inputs',
    'kpi_data',
    'kpi_goals'
  ];
  
  for (const tableName of importOrder) {
    if (!summary.tables[tableName] || summary.tables[tableName].status !== 'success') {
      console.log(\`⏭️  Skipping \${tableName} (no clean data)\`);
      continue;
    }
    
    try {
      const dataFile = path.join(dataDir, \`\${tableName}.json\`);
      if (!fs.existsSync(dataFile)) {
        console.log(\`⏭️  Skipping \${tableName} (file not found)\`);
        continue;
      }
      
      const tableData = JSON.parse(fs.readFileSync(dataFile));
      console.log(\`📥 Importing \${tableName} (\${tableData.length} records)...\`);
      
      if (tableData.length > 0) {
        // Import in batches to avoid overwhelming the database
        const batchSize = 100;
        let imported = 0;
        
        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize);
          const { error } = await supabase.from(tableName).insert(batch);
          
          if (error) {
            console.log(\`   └─ ❌ Error importing batch: \${error.message}\`);
            // Continue with next batch instead of stopping
          } else {
            imported += batch.length;
            console.log(\`   └─ ✅ Imported \${imported}/\${tableData.length} records...\`);
          }
        }
        
        console.log(\`   └─ 🎉 Completed \${tableName}: \${imported} records imported\`);
      } else {
        console.log(\`   └─ ✅ \${tableName} is empty - nothing to import\`);
      }
      
    } catch (error) {
      console.log(\`   └─ 💥 Exception importing \${tableName}: \${error.message}\`);
    }
  }
  
  console.log('\\n🎉 Import Complete!');
  console.log('==================');
  console.log('Your local Supabase now has the cleaned production data.');
  console.log('\\nNext steps:');
  console.log('1. Update your .env to use SUPABASE_MODE=local');
  console.log('2. Test the application with: npm run dev');
  console.log('3. Switch modes with SUPABASE_MODE=cloud when needed');
}

importCleanData().catch(error => {
  console.error('\\n💥 Import failed:', error);
  process.exit(1);
});
`;

  const importScriptPath = path.join(exportDir, 'import-to-local.js');
  try {
    fs.writeFileSync(importScriptPath, importScriptContent);
    fs.chmodSync(importScriptPath, '755'); // Make executable
    console.log(`   └─ ✅ Written import-to-local.js`);
  } catch (error) {
    console.log(`   └─ ❌ Failed to write import script: ${error.message}`);
  }

  // Generate README
  const readmeContent = `# Clean Database Export

Generated on: ${exportSummary.exportedAt}
Total Records: ${exportSummary.totalRecords}

## Files

- \`complete-export.json\` - All data in single file
- \`export-summary.json\` - Export statistics and metadata
- \`import-to-local.js\` - Script to import data to local Supabase
- \`[table-name].json\` - Individual table data files

## Table Summary

${Object.entries(exportSummary.tables)
  .map(([table, info]) => `- **${table}**: ${info.status} (${info.records} records)`)
  .join('\n')}

## Usage

### To import to local Supabase:

1. Set up local Supabase: \`npm run supabase:start\`
2. Run the import: \`node import-to-local.js\`
3. Update your .env: \`SUPABASE_MODE=local\`

### To use in production:

Keep \`SUPABASE_MODE=cloud\` and the data is already cleaned in your cloud instance.

## Notes

- This export contains only core business data
- MCP tables have been cleared
- Unused user tracking tables have been removed
- KPI data has been reduced to manageable size
- All table references updated to use llm_providers/llm_models
`;

  const readmePath = path.join(exportDir, 'README.md');
  try {
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`   └─ ✅ Written README.md`);
  } catch (error) {
    console.log(`   └─ ❌ Failed to write README: ${error.message}`);
  }

  console.log('\n🎉 Clean Data Export Complete!');
  console.log('==============================');
  console.log(`📁 Location: ${exportDir}`);
  console.log(`📊 Total Records: ${exportSummary.totalRecords}`);
  console.log(`📋 Tables Exported: ${Object.keys(exportSummary.tables).length}`);
  
  const successfulTables = Object.values(exportSummary.tables).filter(t => t.status === 'success').length;
  console.log(`✅ Successful: ${successfulTables}`);
  
  const errorTables = Object.values(exportSummary.tables).filter(t => t.status !== 'success').length;
  if (errorTables > 0) {
    console.log(`⚠️  Errors: ${errorTables}`);
  }
  
  console.log('\n📖 Next Steps:');
  console.log('==============');
  console.log('1. Set up local Supabase: npm run supabase:start');
  console.log(`2. Import data: cd ${exportDir} && node import-to-local.js`);
  console.log('3. Test with local data: SUPABASE_MODE=local npm run dev');
  console.log('4. Switch between local/cloud: Change SUPABASE_MODE in .env');
}

exportCleanData().catch(error => {
  console.error('\n💥 Export failed:', error);
  process.exit(1);
});