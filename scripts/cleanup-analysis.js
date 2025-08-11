#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function analyzeForCleanup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧹 Database Cleanup Analysis');
  console.log('============================\n');
  
  // Tables with 0 rows - safe to skip in migration
  const emptyTables = [
    'agent_health_status', 'agent_interactions', 'agent_relationships',
    'human_inputs', 'llm_usage', 'mcp_feedback', 'mcp_tool_usage', 
    'project_steps', 'task_messages', 'user_audit_log', 'user_cidafm_commands',
    'user_context', 'user_interactions', 'user_preferences', 'user_privacy_settings',
    'user_routing_patterns', 'user_sessions', 'user_usage_stats', 'langgraph_state_history'
  ];
  
  console.log('📭 Empty Tables (0 rows):');
  console.log('=========================');
  for (const table of emptyTables) {
    console.log(`• ${table} - Safe to skip in migration`);
  }
  
  // Analyze large tables for potential cleanup
  console.log('\n📊 Large Tables Analysis:');
  console.log('=========================');
  
  // Check kpi_data for date ranges
  try {
    const { data: kpiDates, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          MIN(created_at) as oldest,
          MAX(created_at) as newest,
          COUNT(*) as total,
          COUNT(DISTINCT department_id) as unique_departments
        FROM kpi_data;
      `
    });
    
    if (kpiDates && kpiDates[0]) {
      console.log(`\n• kpi_data (${kpiDates[0].total} rows):`);
      console.log(`  └─ Date range: ${kpiDates[0].oldest} to ${kpiDates[0].newest}`);
      console.log(`  └─ Unique departments: ${kpiDates[0].unique_departments}`);
    }
  } catch (e) {
    console.log('• kpi_data - Unable to analyze dates');
  }
  
  // Check MCP executions
  try {
    const { data: mcpData, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          MIN(created_at) as oldest,
          MAX(created_at) as newest,
          COUNT(*) as total,
          COUNT(DISTINCT user_id) as unique_users
        FROM mcp_executions;
      `
    });
    
    if (mcpData && mcpData[0]) {
      console.log(`\n• mcp_executions (${mcpData[0].total} rows):`);
      console.log(`  └─ Date range: ${mcpData[0].oldest} to ${mcpData[0].newest}`);
      console.log(`  └─ Unique users: ${mcpData[0].unique_users}`);
    }
  } catch (e) {
    console.log('• mcp_executions - Unable to analyze');
  }
  
  // Check companies and departments
  try {
    const { data: companyData, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          c.name as company_name,
          COUNT(d.id) as department_count
        FROM companies c
        LEFT JOIN departments d ON c.id = d.company_id
        GROUP BY c.id, c.name
        ORDER BY department_count DESC;
      `
    });
    
    if (companyData) {
      console.log(`\n• companies & departments:`);
      for (const company of companyData) {
        console.log(`  └─ ${company.company_name}: ${company.department_count} departments`);
      }
    }
  } catch (e) {
    console.log('• companies/departments - Unable to analyze');
  }
  
  // Core data that should be preserved
  console.log('\n✅ Core Data to Preserve:');
  console.log('=========================');
  
  const coreDataQueries = [
    { name: 'users', query: 'SELECT COUNT(*) as count FROM users;' },
    { name: 'agent_conversations', query: 'SELECT COUNT(*) as count FROM agent_conversations;' },
    { name: 'tasks', query: 'SELECT COUNT(*) as count FROM tasks;' },
    { name: 'agents', query: 'SELECT COUNT(*) as count FROM agents;' },
    { name: 'projects', query: 'SELECT COUNT(*) as count FROM projects;' },
    { name: 'deliverables', query: 'SELECT COUNT(*) as count FROM deliverables;' },
  ];
  
  for (const item of coreDataQueries) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: item.query });
      if (data && data[0]) {
        console.log(`• ${item.name}: ${data[0].count} rows - KEEP`);
      }
    } catch (e) {
      console.log(`• ${item.name}: Unable to count`);
    }
  }
  
  console.log('\n📋 Cleanup Recommendations:');
  console.log('============================');
  console.log('1. 🗑️  SAFE TO REMOVE: All empty tables (will be recreated locally)');
  console.log('2. 🤔 REVIEW NEEDED: Large KPI dataset - keep recent data only?');
  console.log('3. 🤔 REVIEW NEEDED: MCP execution logs - keep recent logs only?');
  console.log('4. ✅ PRESERVE: Core user data, conversations, tasks, agents');
  console.log('5. 🧹 CLEAN: Test users, demo data, expired sessions');
  
  console.log('\n🚀 Next Steps:');
  console.log('==============');
  console.log('1. Review the large datasets above');
  console.log('2. Decide what date ranges to keep');
  console.log('3. Export core data for local migration');
  console.log('4. Test migration with clean dataset');
}

analyzeForCleanup();