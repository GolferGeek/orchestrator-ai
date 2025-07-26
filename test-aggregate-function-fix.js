const testAggregateFunctionFix = async () => {
  try {
    console.log('🔍 Testing aggregate function fix for Supabase limitations...\n');
    
    const aggregateTests = [
      {
        name: "AVG function with date filter",
        sql: "SELECT AVG(execution_time_ms) FROM mcp_executions WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 1",
        expected: "Should now work with manual calculation"
      },
      {
        name: "MAX function",
        sql: "SELECT MAX(execution_time_ms) FROM mcp_executions LIMIT 1",
        expected: "Should work"
      },
      {
        name: "MIN function", 
        sql: "SELECT MIN(execution_time_ms) FROM mcp_executions LIMIT 1",
        expected: "Should work"
      },
      {
        name: "SUM function",
        sql: "SELECT SUM(execution_time_ms) FROM mcp_executions LIMIT 1",
        expected: "Should work"
      },
      {
        name: "COUNT still works",
        sql: "SELECT COUNT(*) FROM mcp_executions LIMIT 1",
        expected: "Should still work as before"
      }
    ];
    
    console.log(`🎯 Testing ${aggregateTests.length} aggregate functions...\\n`);
    
    const results = [];
    
    for (let i = 0; i < aggregateTests.length; i++) {
      const test = aggregateTests[i];
      console.log(`=== TEST ${i + 1}/5: ${test.name} ===`);
      console.log(`📝 SQL: ${test.sql}`);
      console.log(`🎯 Expected: ${test.expected}`);
      
      try {
        const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              sql: test.sql,
              dry_run: false
            }
          })
        });
        
        if (executeResponse.ok) {
          const executeResult = await executeResponse.json();
          const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
          
          if (executeContent.success) {
            console.log(`✅ SUCCESS!`);
            console.log(`📊 Result: ${JSON.stringify(executeContent.data?.data || [], null, 2)}`);
            console.log(`🔒 Security: ${executeContent.data?.validation_results?.is_safe ? 'SAFE' : 'UNSAFE'}`);
            
            results.push({
              ...test,
              status: 'success',
              result: executeContent.data?.data?.[0] || null
            });
          } else {
            console.log(`❌ FAILED: ${executeContent.error}`);
            results.push({
              ...test,
              status: 'failed',
              error: executeContent.error
            });
          }
        } else {
          console.log(`❌ HTTP ERROR: ${executeResponse.status}`);
          results.push({
            ...test,
            status: 'http_error'
          });
        }
        
      } catch (error) {
        console.log(`❌ EXCEPTION: ${error.message}`);
        results.push({
          ...test,
          status: 'exception',
          error: error.message
        });
      }
      
      console.log(`\\n${'='.repeat(70)}\\n`);
    }
    
    // Test the originally failing query
    console.log('=== TESTING ORIGINAL FAILING QUERY ===');
    console.log('📝 Query: "Show me the average execution time of MCP tools for the last 30 days"');
    
    try {
      const generateResponse = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            prompt: "Show me the average execution time of MCP tools for the last 30 days",
            use_context: true
          }
        })
      });
      
      if (generateResponse.ok) {
        const generateResult = await generateResponse.json();
        const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
        
        if (generateContent.success && generateContent.data?.sql) {
          const generatedSQL = generateContent.data.sql;
          console.log(`🤖 Generated SQL: ${generatedSQL}`);
          console.log(`🎯 Confidence: ${(generateContent.data.confidence * 100).toFixed(1)}%`);
          
          // Test execution
          const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              arguments: {
                sql: generatedSQL,
                dry_run: false
              }
            })
          });
          
          if (executeResponse.ok) {
            const executeResult = await executeResponse.json();
            const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
            
            if (executeContent.success) {
              console.log(`🏆 ORIGINALLY FAILING QUERY NOW WORKS!`);
              console.log(`📊 Result: ${JSON.stringify(executeContent.data?.data?.[0] || {}, null, 2)}`);
              
              results.push({
                name: "Original failing complex query",
                status: 'success',
                result: executeContent.data?.data?.[0] || null,
                improvement: 'Fixed!'
              });
            } else {
              console.log(`❌ Still failing: ${executeContent.error}`);
            }
          }
        }
      }
    } catch (error) {
      console.log(`❌ Original query test failed: ${error.message}`);
    }
    
    // Analyze results
    console.log(`\\n${'='.repeat(70)}\\n`);
    console.log('🏁 AGGREGATE FUNCTION TEST RESULTS\\n');
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status !== 'success');
    
    console.log('📊 RESULTS BREAKDOWN:');
    console.log(`   ✅ Working: ${successful.length}/${results.length} (${(successful.length / results.length * 100).toFixed(0)}%)`);
    console.log(`   ❌ Failed: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
      console.log(`\\n✅ WORKING AGGREGATE FUNCTIONS:`);
      successful.forEach(r => {
        console.log(`   • ${r.name}: ${JSON.stringify(r.result)}`);
      });
    }
    
    if (failed.length > 0) {
      console.log(`\\n❌ STILL FAILING:`);
      failed.forEach(r => {
        console.log(`   • ${r.name}: ${r.error || 'Unknown error'}`);
      });
    }
    
    console.log('\\n🎯 ASSESSMENT:');
    if (successful.length >= 4) {
      console.log('🏆 EXCELLENT: Aggregate functions are now working!');
    } else if (successful.length >= 2) {
      console.log('✅ GOOD: Most aggregate functions working');
    } else {
      console.log('⚠️  PARTIAL: Some improvement but more work needed');
    }
    
    console.log('\\n✅ Aggregate function fix testing complete!');
    return results;
    
  } catch (error) {
    console.error('❌ Testing failed:', error.message);
    process.exit(1);
  }
};

testAggregateFunctionFix();