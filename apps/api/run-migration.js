#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read the migration file
const migrationPath = path.join(__dirname, 'supabase/migrations/20250123_add_schema_discovery_functions.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Split migration into individual statements
const statements = migrationSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

async function runMigration() {
  console.log('🚀 Running Supabase migration for MCP schema discovery functions...');
  console.log(`📄 Migration file: ${migrationPath}`);
  console.log(`📊 Found ${statements.length} SQL statements to execute`);
  
  try {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`📝 SQL: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
      
      const { data, error } = await supabase.rpc('exec', { 
        query: statement + ';' 
      });
      
      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        // Try direct execution for CREATE FUNCTION statements
        console.log('🔄 Trying alternative execution method...');
        
        // For CREATE FUNCTION, we might need to execute differently
        // Let's try using the raw query approach
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({ query: statement + ';' })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Alternative method also failed: ${response.status} ${errorText}`);
            continue;
          }
          console.log('✅ Alternative method succeeded');
        } catch (altError) {
          console.error(`❌ Alternative method error:`, altError.message);
          console.log('⚠️  Continuing with next statement...');
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }
    
    // Test the functions
    console.log('\n🧪 Testing the created functions...');
    
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_names');
    if (tablesError) {
      console.error('❌ Error testing get_table_names:', tablesError);
    } else {
      console.log(`✅ get_table_names() works! Found ${tables?.length || 0} tables`);
      if (tables?.length > 0) {
        console.log(`📋 Sample tables: ${tables.slice(0, 5).map(t => t.table_name).join(', ')}`);
      }
    }
    
    console.log('🎉 Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();