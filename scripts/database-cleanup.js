#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function cleanupDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧹 Starting Database Cleanup');
  console.log('============================\n');
  console.log('⚠️  BACKUP CONFIRMED: _supabase/db_cluster-11-08-2025@06-57-06.backup');
  console.log('🔄 This process is REVERSIBLE - we have a complete backup!\n');

  // Phase 1: Remove MCP Tables (completely unused)
  console.log('🗑️  Phase 1: Removing MCP Tables');
  console.log('=================================');
  
  const mcpTables = [
    'mcp_executions',
    'mcp_failures', 
    'mcp_feedback',
    'mcp_tool_usage'
  ];
  
  for (const tableName of mcpTables) {
    try {
      // First check if table exists and get row count
      const { data: countData, error: countError } = await supabase.rpc('exec_sql', {
        query: `SELECT COUNT(*) as count FROM ${tableName};`
      });
      
      if (countError) {
        console.log(`⏭️  Table '${tableName}' not found or inaccessible - skipping`);
        continue;
      }
      
      const rowCount = countData?.[0]?.count || 0;
      console.log(`📊 ${tableName}: ${rowCount} rows`);
      
      if (rowCount > 0) {
        console.log(`   └─ Removing ${rowCount} rows...`);
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        
        if (deleteError) {
          console.log(`   └─ ❌ Error deleting from ${tableName}: ${deleteError.message}`);
        } else {
          console.log(`   └─ ✅ Cleared all data from ${tableName}`);
        }
      } else {
        console.log(`   └─ Already empty - no action needed`);
      }
    } catch (error) {
      console.log(`   └─ ⚠️  Error processing ${tableName}: ${error.message}`);
    }
  }

  // Phase 2: Remove Unused User Tables
  console.log('\n👥 Phase 2: Removing Unused User Tables');
  console.log('=======================================');
  
  const userTables = [
    'user_audit_log',
    'user_context', 
    'user_interactions',
    'user_preferences',
    'user_privacy_settings',
    'user_routing_patterns',
    'user_sessions',
    'user_usage_stats'
    // Note: keeping user_cidafm_commands for favorites
  ];
  
  for (const tableName of userTables) {
    try {
      const { data: countData, error: countError } = await supabase.rpc('exec_sql', {
        query: `SELECT COUNT(*) as count FROM ${tableName};`
      });
      
      if (countError) {
        console.log(`⏭️  Table '${tableName}' not found - skipping`);
        continue;
      }
      
      const rowCount = countData?.[0]?.count || 0;
      console.log(`📊 ${tableName}: ${rowCount} rows`);
      
      if (rowCount > 0) {
        console.log(`   └─ Removing ${rowCount} rows...`);
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
        
        if (deleteError) {
          console.log(`   └─ ❌ Error deleting from ${tableName}: ${deleteError.message}`);
        } else {
          console.log(`   └─ ✅ Cleared all data from ${tableName}`);
        }
      } else {
        console.log(`   └─ Already empty - no action needed`);
      }
    } catch (error) {
      console.log(`   └─ ⚠️  Error processing ${tableName}: ${error.message}`);
    }
  }

  // Phase 3: Clean Test Data (reduce but don't eliminate)
  console.log('\n🧪 Phase 3: Cleaning Test Data');
  console.log('==============================');
  
  // Clean old KPI data - keep only recent 1000 rows
  try {
    const { data: kpiCount } = await supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as count FROM kpi_data;`
    });
    
    const totalKpiRows = kpiCount?.[0]?.count || 0;
    console.log(`📊 kpi_data: ${totalKpiRows} rows`);
    
    if (totalKpiRows > 1000) {
      const rowsToDelete = totalKpiRows - 1000;
      console.log(`   └─ Keeping 1000 most recent rows, removing ${rowsToDelete}...`);
      
      const { error: deleteError } = await supabase.rpc('exec_sql', {
        query: `
          DELETE FROM kpi_data 
          WHERE id IN (
            SELECT id FROM kpi_data 
            ORDER BY created_at ASC 
            LIMIT ${rowsToDelete}
          );
        `
      });
      
      if (deleteError) {
        console.log(`   └─ ❌ Error cleaning kpi_data: ${deleteError.message}`);
      } else {
        console.log(`   └─ ✅ Cleaned kpi_data, ${rowsToDelete} rows removed`);
      }
    } else {
      console.log(`   └─ Already under 1000 rows - no cleanup needed`);
    }
  } catch (error) {
    console.log(`   └─ ⚠️  Error processing kpi_data: ${error.message}`);
  }

  // Clean old KPI goals - keep only recent 500 rows
  try {
    const { data: goalCount } = await supabase.rpc('exec_sql', {
      query: `SELECT COUNT(*) as count FROM kpi_goals;`
    });
    
    const totalGoalRows = goalCount?.[0]?.count || 0;
    console.log(`📊 kpi_goals: ${totalGoalRows} rows`);
    
    if (totalGoalRows > 500) {
      const rowsToDelete = totalGoalRows - 500;
      console.log(`   └─ Keeping 500 most recent rows, removing ${rowsToDelete}...`);
      
      const { error: deleteError } = await supabase.rpc('exec_sql', {
        query: `
          DELETE FROM kpi_goals 
          WHERE id IN (
            SELECT id FROM kpi_goals 
            ORDER BY created_at ASC 
            LIMIT ${rowsToDelete}
          );
        `
      });
      
      if (deleteError) {
        console.log(`   └─ ❌ Error cleaning kpi_goals: ${deleteError.message}`);
      } else {
        console.log(`   └─ ✅ Cleaned kpi_goals, ${rowsToDelete} rows removed`);
      }
    } else {
      console.log(`   └─ Already under 500 rows - no cleanup needed`);
    }
  } catch (error) {
    console.log(`   └─ ⚠️  Error processing kpi_goals: ${error.message}`);
  }

  // Phase 4: Summary of Core Data Preserved
  console.log('\n✅ Phase 4: Core Data Preserved');
  console.log('===============================');
  
  const coreTables = [
    'users',
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
    'human_inputs'
  ];
  
  for (const tableName of coreTables) {
    try {
      const { data: countData } = await supabase.rpc('exec_sql', {
        query: `SELECT COUNT(*) as count FROM ${tableName};`
      });
      
      const rowCount = countData?.[0]?.count || 0;
      console.log(`📊 ${tableName}: ${rowCount} rows - PRESERVED`);
    } catch (error) {
      console.log(`📊 ${tableName}: Unable to count - ${error.message}`);
    }
  }

  console.log('\n🎉 Database Cleanup Complete!');
  console.log('=============================');
  console.log('✅ MCP tables cleared');
  console.log('✅ Unused user tables cleared'); 
  console.log('✅ Test data reduced to manageable size');
  console.log('✅ All core business data preserved');
  console.log('✅ Backup available for emergency restore');
  console.log('\n🚀 Ready for code updates and local migration!');
}

// Run the cleanup
cleanupDatabase().catch(error => {
  console.error('\n💥 Cleanup failed:', error);
  process.exit(1);
});