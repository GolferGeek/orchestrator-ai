const debugExecutionIssues = async () => {
  console.log('🔍 Debugging execution issues for failed queries...\n');
  
  const failedQueries = [
    {
      name: "Departments revenue vs KPI goals",
      sql: "SELECT d.id, d.name, (SUM(s.revenue) - d.kpi_goal) AS revenue_difference, ((SUM(s.revenue) - d.kpi_goal) / d.kpi_goal) * 100 AS percentage_difference FROM departments d LEFT JOIN sales s ON d.id = s.department_id GROUP BY d.id, d.name ORDER BY revenue_difference DESC LIMIT 5;"
    },
    {
      name: "Long-running agents without tasks",
      sql: "SELECT ac.agent_name, ac.last_active_at FROM agent_conversations ac LEFT JOIN tasks t ON ac.id = t.agent_conversation_id WHERE ac.ended_at IS NULL AND (NOW() - ac.started_at) > INTERVAL '24 hours' AND t.id IS NULL LIMIT 100;"
    },
    {
      name: "MCP tools average response time",
      sql: "SELECT mcp_name, tool_name, AVG(execution_time_ms) AS average_response_time FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' AND status != 'failed' GROUP BY mcp_name, tool_name ORDER BY mcp_name, tool_name;"
    },
    {
      name: "Departments below KPI goals by 20%",
      sql: "SELECT d.id, d.name, m.metric_name, m.actual_value, m.goal_value FROM departments d LEFT JOIN metrics m ON d.id = m.department_id WHERE m.actual_value < (m.goal_value * 0.8) LIMIT 100;"
    },
    {
      name: "Companies and departments KPI ranking",  
      sql: "SELECT c.name AS company_name, d.name AS department_name, k.metric_name, k.performance_score FROM companies c LEFT JOIN departments d ON c.id = d.company_id LEFT JOIN kpi_performance k ON d.id = k.department_id ORDER BY k.performance_score DESC"
    }
  ];
  
  for (let i = 0; i < failedQueries.length; i++) {
    const query = failedQueries[i];
    console.log(`=== DEBUG ${i + 1}/5: ${query.name} ===`);
    console.log(`🤖 SQL: ${query.sql}`);
    
    try {
      const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            sql: query.sql,
            dry_run: false
          }
        })
      });
      
      console.log(`📡 HTTP Status: ${executeResponse.status}`);
      
      if (executeResponse.ok) {
        const executeResult = await executeResponse.json();
        console.log(`📋 Response structure:`, Object.keys(executeResult));
        
        const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
        console.log(`🎯 Success: ${executeContent.success}`);
        
        if (!executeContent.success) {
          console.log(`❌ ERROR DETAILS:`);
          console.log(`   Error: ${executeContent.error || 'No error message'}`);
          console.log(`   Details: ${executeContent.details || 'No details'}`);
          console.log(`   Full response:`, JSON.stringify(executeContent, null, 2));
        } else {
          console.log(`✅ Actually succeeded - might be intermittent issue`);
          console.log(`   Row count: ${executeContent.data?.row_count || 'unknown'}`);
        }
      } else {
        const errorText = await executeResponse.text();
        console.log(`❌ HTTP ERROR: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`❌ EXCEPTION: ${error.message}`);
    }
    
    console.log(`\n${'='.repeat(70)}\n`);
  }
  
  console.log('🏁 Execution issue debugging complete!');
};

debugExecutionIssues();