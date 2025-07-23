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

async function executeViaSQLEditor() {
  console.log('🚀 Attempting to execute migration via SQL...');
  
  try {
    // Try creating functions one by one using edge functions or direct SQL approach
    
    // Function 1: get_table_names
    const createGetTableNames = `
      CREATE OR REPLACE FUNCTION get_table_names()
      RETURNS TABLE(table_name text)
      LANGUAGE sql
      SECURITY DEFINER
      AS $$
        SELECT t.table_name::text
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name;
      $$;
    `;
    
    console.log('⏳ Creating get_table_names function...');
    
    // Try using a raw HTTP request to the SQL editor endpoint
    const response1 = await fetch(`${supabaseUrl}/rest/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: createGetTableNames
      })
    });
    
    if (!response1.ok) {
      const errorText = await response1.text();
      console.log('❌ SQL query endpoint failed:', response1.status, errorText);
      
      // Try alternative approach: SQL Editor API
      console.log('🔄 Trying SQL Editor API approach...');
      
      const editorResponse = await fetch(`${supabaseUrl}/rest/v1/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          sql: createGetTableNames
        })
      });
      
      if (!editorResponse.ok) {
        const editorError = await editorResponse.text();
        console.error('❌ SQL Editor API also failed:', editorResponse.status, editorError);
        
        // Final attempt: Just test the database connection
        console.log('🔄 Testing basic database connection...');
        const { data: testData, error: testError } = await supabase
          .from('users')
          .select('id')
          .limit(1);
          
        if (testError) {
          console.error('❌ Basic database connection failed:', testError);
          console.log('\n📋 Manual Migration Required:');
          console.log('Please copy and paste the following SQL into your Supabase SQL Editor:');
          console.log('=' .repeat(80));
          console.log(migrationSQL);
          console.log('=' .repeat(80));
        } else {
          console.log('✅ Database connection works, but no direct SQL execution endpoint available');
          console.log('\n📋 Manual Migration Required:');
          console.log('1. Go to: https://supabase.com/dashboard/project/jcmkjecmdugfzvdijodg/sql/new');
          console.log('2. Copy and paste the migration SQL');
          console.log('3. Click "Run" to execute the migration');
          console.log('\n📄 Migration SQL file location:', migrationPath);
        }
      } else {
        console.log('✅ SQL Editor API succeeded');
      }
    } else {
      console.log('✅ Query endpoint succeeded');
    }
    
  } catch (error) {
    console.error('❌ Migration execution failed:', error);
    console.log('\n📋 Manual Migration Required:');
    console.log('Please copy and paste the following SQL into your Supabase SQL Editor:');
    console.log('=' .repeat(80));
    console.log(migrationSQL);
    console.log('=' .repeat(80));
  }
}

executeViaSQLEditor();