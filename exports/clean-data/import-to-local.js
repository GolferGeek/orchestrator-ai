#!/usr/bin/env node

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
  console.log('=========================================\n');

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
      console.log(`⏭️  Skipping ${tableName} (no clean data)`);
      continue;
    }
    
    try {
      const dataFile = path.join(dataDir, `${tableName}.json`);
      if (!fs.existsSync(dataFile)) {
        console.log(`⏭️  Skipping ${tableName} (file not found)`);
        continue;
      }
      
      const tableData = JSON.parse(fs.readFileSync(dataFile));
      console.log(`📥 Importing ${tableName} (${tableData.length} records)...`);
      
      if (tableData.length > 0) {
        // Import in batches to avoid overwhelming the database
        const batchSize = 100;
        let imported = 0;
        
        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize);
          const { error } = await supabase.from(tableName).insert(batch);
          
          if (error) {
            console.log(`   └─ ❌ Error importing batch: ${error.message}`);
            // Continue with next batch instead of stopping
          } else {
            imported += batch.length;
            console.log(`   └─ ✅ Imported ${imported}/${tableData.length} records...`);
          }
        }
        
        console.log(`   └─ 🎉 Completed ${tableName}: ${imported} records imported`);
      } else {
        console.log(`   └─ ✅ ${tableName} is empty - nothing to import`);
      }
      
    } catch (error) {
      console.log(`   └─ 💥 Exception importing ${tableName}: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Import Complete!');
  console.log('==================');
  console.log('Your local Supabase now has the cleaned production data.');
  console.log('\nNext steps:');
  console.log('1. Update your .env to use SUPABASE_MODE=local');
  console.log('2. Test the application with: npm run dev');
  console.log('3. Switch modes with SUPABASE_MODE=cloud when needed');
}

importCleanData().catch(error => {
  console.error('\n💥 Import failed:', error);
  process.exit(1);
});
