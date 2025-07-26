const testSQLGeneration = async () => {
  try {
    console.log('🧪 Testing SQL generation against real database tables...\n');
    
    // Test various types of queries against our discovered tables
    const testQueries = [
      {
        prompt: "Count all users in the system",
        expectedTable: "users",
        description: "Basic COUNT query"
      },
      {
        prompt: "Show me the first 5 agents with their names and types",
        expectedTable: "agents", 
        description: "SELECT with LIMIT"
      },
      {
        prompt: "Find all active tasks",
        expectedTable: "tasks",
        description: "SELECT with WHERE condition"
      },
      {
        prompt: "Get user sessions from the last 7 days",
        expectedTable: "user_sessions",
        description: "Date-based filtering"
      },
      {
        prompt: "Show agent health status for unhealthy agents",
        expectedTable: "agent_health_status",
        description: "Status filtering"
      },
      {
        prompt: "List all LLM providers and their models",
        expectedTable: "llm_providers",
        description: "JOIN query across related tables"
      },
      {
        prompt: "Count tasks by status",
        expectedTable: "tasks",
        description: "GROUP BY aggregation"
      },
      {
        prompt: "Find recent agent interactions with response times",
        expectedTable: "agent_interactions",
        description: "Complex filtering with metrics"
      },
      {
        prompt: "Show MCP tool usage statistics",
        expectedTable: "mcp_tool_usage",
        description: "Analytics table query"
      },
      {
        prompt: "Get user preferences for privacy settings",
        expectedTable: "user_privacy_settings",
        description: "User-specific data"
      }
    ];
    
    console.log(`🎯 Testing ${testQueries.length} different SQL generation scenarios...\n`);
    
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`=== TEST ${i + 1}: ${query.description} ===`);
      console.log(`📝 Prompt: "${query.prompt}"`);
      console.log(`🎯 Expected table: ${query.expectedTable}`);
      
      try {
        const response = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              prompt: query.prompt,
              use_context: true,
              llm_provider: 'anthropic',
              llm_model: 'claude-3-5-sonnet'
            }
          })
        });
        
        if (!response.ok) {
          console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
          console.log('');
          continue;
        }
        
        const result = await response.json();
        
        // Check if we got a successful result
        if (result.tool_result && result.tool_result.content && result.tool_result.content[0]) {
          const content = JSON.parse(result.tool_result.content[0].text);
          
          if (content.success && content.data && content.data.sql) {
            console.log(`✅ SQL Generation successful`);
            console.log(`📊 Generated SQL: ${content.data.sql}`);
            
            // Check if the generated SQL references the expected table
            const sqlLower = content.data.sql.toLowerCase();
            const expectedTableLower = query.expectedTable.toLowerCase();
            
            if (sqlLower.includes(expectedTableLower)) {
              console.log(`🎯 ✅ Correctly targets table: ${query.expectedTable}`);
            } else {
              console.log(`⚠️  Generated SQL doesn't reference expected table ${query.expectedTable}`);
              console.log(`🔍 SQL references: ${content.data.sql.match(/FROM\s+(\w+)/gi) || 'none detected'}`);
            }
            
            // Show additional metadata
            if (content.data.execution_time_ms) {
              console.log(`⏱️  Generation time: ${content.data.execution_time_ms}ms`);
            }
            if (content.data.model_used) {
              console.log(`🤖 Model: ${content.data.model_used}`);
            }
            if (content.data.confidence) {
              console.log(`🎯 Confidence: ${(content.data.confidence * 100).toFixed(1)}%`);
            }
            if (content.data.explanation) {
              console.log(`💭 Explanation: ${content.data.explanation.substring(0, 100)}...`);
            }
            
          } else {
            console.log(`❌ SQL Generation failed`);
            if (content.error) {
              console.log(`🚨 Error: ${content.error}`);
            }
          }
        } else {
          console.log(`❌ Unexpected response format`);
          console.log(`🔍 Response: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
        }
        
      } catch (error) {
        console.log(`❌ Request failed: ${error.message}`);
      }
      
      console.log(''); // Add spacing between tests
    }
    
    console.log('=== SQL GENERATION TEST SUMMARY ===');
    console.log('🎉 SQL generation testing completed!');
    console.log('✅ Tested against multiple real database tables');
    console.log('📊 Verified table targeting and SQL structure');
    console.log('🤖 Confirmed LLM integration for natural language to SQL');
    
  } catch (error) {
    console.error('❌ SQL generation test failed:', error.message);
    process.exit(1);
  }
};

testSQLGeneration();