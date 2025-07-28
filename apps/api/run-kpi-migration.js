const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function runMigration() {
  console.log('🔄 Starting KPI migration...');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'fixed-comprehensive-kpi-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📁 Migration file loaded:', migrationPath);
    console.log('📊 SQL length:', migrationSQL.length, 'characters');
    
    // Execute the migration
    console.log('⚡ Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      return false;
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Result:', data);
    
    // Verify the data was inserted
    console.log('\n🔍 Verifying data insertion...');
    
    const checks = [
      { table: 'companies', query: 'SELECT COUNT(*) as count FROM companies' },
      { table: 'departments', query: 'SELECT COUNT(*) as count FROM departments' },
      { table: 'kpi_metrics', query: 'SELECT COUNT(*) as count FROM kpi_metrics' },
      { table: 'kpi_goals', query: 'SELECT COUNT(*) as count FROM kpi_goals' },
      { table: 'kpi_data', query: 'SELECT COUNT(*) as count FROM kpi_data' }
    ];
    
    for (const check of checks) {
      const { data: checkData, error: checkError } = await supabase.rpc('exec_sql', {
        sql_query: check.query
      });
      
      if (checkError) {
        console.error(`❌ Failed to check ${check.table}:`, checkError);
      } else {
        const count = checkData?.[0]?.count || 0;
        console.log(`✅ ${check.table}: ${count} records`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('💥 Error during migration:', error);
    return false;
  }
}

// Run the migration
runMigration()
  .then(success => {
    if (success) {
      console.log('\n🎉 KPI migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 KPI migration failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });