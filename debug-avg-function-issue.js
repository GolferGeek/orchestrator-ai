const debugAvgFunctionIssue = async () => {
  try {
    console.log('🔍 Debugging the AVG function issue with MCP executions...\n');
    
    // Test the specific failing SQL
    const failingSQL = "SELECT AVG(execution_time_ms) FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 1";
    
    console.log('=== TESTING FAILING QUERY ===');
    console.log(`📝 SQL: ${failingSQL}`);
    
    const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          sql: failingSQL,
          dry_run: false
        }
      })
    });
    
    if (executeResponse.ok) {
      const executeResult = await executeResponse.json();
      const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
      
      console.log(`🎯 Success: ${executeContent.success}`);
      if (!executeContent.success) {
        console.log(`❌ Error: ${executeContent.error}`);
        console.log(`📋 Full response:`, JSON.stringify(executeContent, null, 2));
      }
    }
    
    // Test alternative approaches
    console.log('\\n=== TESTING ALTERNATIVE APPROACHES ===');
    
    const alternatives = [
      {
        name: "Simple COUNT without AVG",
        sql: "SELECT COUNT(*) FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 1"
      },
      {
        name: "Basic table query",
        sql: "SELECT execution_time_ms FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 10"
      },
      {
        name: "COUNT with GROUP BY",
        sql: "SELECT status, COUNT(*) FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY status LIMIT 10"
      },
      {
        name: "Simple aggregation without WHERE",
        sql: "SELECT COUNT(*) FROM mcp_executions LIMIT 1"
      }
    ];
    
    for (let i = 0; i < alternatives.length; i++) {
      const alt = alternatives[i];
      console.log(`\\n--- ${alt.name} ---`);
      console.log(`📝 SQL: ${alt.sql}`);
      
      try {
        const response = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              sql: alt.sql,
              dry_run: false
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          const content = JSON.parse(result.tool_result.content[0].text);
          
          if (content.success) {
            console.log(`✅ SUCCESS: ${content.data?.row_count || 0} rows`);
            if (content.data?.data && content.data.data.length > 0) {
              console.log(`📊 Sample: ${JSON.stringify(content.data.data[0], null, 2)}`);
            }
          } else {
            console.log(`❌ FAILED: ${content.error}`);
          }
        } else {
          console.log(`❌ HTTP ERROR: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ EXCEPTION: ${error.message}`);
      }
    }
    
    // Test if the issue is with AVG specifically
    console.log('\\n=== TESTING AVG FUNCTION SPECIFICALLY ===');
    
    const avgTests = [
      {
        name: "AVG without WHERE clause",
        sql: "SELECT AVG(execution_time_ms) FROM mcp_executions LIMIT 1"
      },
      {
        name: "MAX instead of AVG",
        sql: "SELECT MAX(execution_time_ms) FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 1"
      },
      {
        name: "MIN instead of AVG", 
        sql: "SELECT MIN(execution_time_ms) FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 1"
      }
    ];
    
    for (let i = 0; i < avgTests.length; i++) {
      const test = avgTests[i];
      console.log(`\\n--- ${test.name} ---`);
      console.log(`📝 SQL: ${test.sql}`);
      
      try {
        const response = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              sql: test.sql,
              dry_run: false
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          const content = JSON.parse(result.tool_result.content[0].text);
          
          if (content.success) {
            console.log(`✅ SUCCESS: Got result`);
            if (content.data?.data && content.data.data.length > 0) {
              console.log(`📊 Result: ${JSON.stringify(content.data.data[0], null, 2)}`);
            }
          } else {
            console.log(`❌ FAILED: ${content.error}`);
          }
        } else {
          console.log(`❌ HTTP ERROR: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ EXCEPTION: ${error.message}`);
      }
    }
    
    console.log('\\n🏁 AVG function debugging complete!');
    console.log('\\n💡 ANALYSIS:');
    console.log('- Testing different aggregation patterns');
    console.log('- Checking if AVG specifically is the issue');
    console.log('- Finding alternative approaches for aggregation');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  }
};

debugAvgFunctionIssue();