#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function analyzeSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 Analyzing current Supabase schema...\n');
  
  try {
    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          table_name,
          table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `
    });
    
    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError.message);
      process.exit(1);
    }
    
    console.log('📊 Current Tables:');
    console.log('==================');
    
    for (const table of tables) {
      console.log(`• ${table.table_name} (${table.table_type})`);
      
      // Get row count for each table
      try {
        const { data: countData, error: countError } = await supabase.rpc('exec_sql', {
          query: `SELECT COUNT(*) as count FROM public."${table.table_name}";`
        });
        
        if (!countError && countData && countData[0]) {
          console.log(`  └─ ${countData[0].count} rows`);
        }
      } catch (e) {
        console.log(`  └─ (unable to count rows)`);
      }
    }
    
    console.log('\n🔍 Analyzing table relationships...');
    
    // Get foreign key relationships
    const { data: fkeys, error: fkeyError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          tc.table_name as source_table,
          kcu.column_name as source_column,
          ccu.table_name as target_table,
          ccu.column_name as target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `
    });
    
    if (!fkeyError && fkeys && fkeys.length > 0) {
      console.log('\n🔗 Foreign Key Relationships:');
      console.log('=============================');
      
      for (const fkey of fkeys) {
        console.log(`${fkey.source_table}.${fkey.source_column} → ${fkey.target_table}.${fkey.target_column}`);
      }
    }
    
    console.log('\n🧹 Cleanup Recommendations:');
    console.log('============================');
    console.log('Based on the CLAUDE.md principles:');
    console.log('• Look for tables with 0 rows (unused)');
    console.log('• Identify test/demo data that can be removed');
    console.log('• Check for duplicate or legacy table structures');
    console.log('• Preserve core business data and relationships');
    
  } catch (error) {
    console.error('❌ Error analyzing schema:', error.message);
    process.exit(1);
  }
}

analyzeSchema();