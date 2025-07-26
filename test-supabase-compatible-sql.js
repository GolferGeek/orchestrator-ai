const testSupabaseCompatibleSQL = async () => {
  try {
    console.log('🔍 Testing updated SQL generation with Supabase constraints...\n');
    
    const testQueries = [
      {
        prompt: "Show me the top 5 departments by name",
        description: "Simple query that should work"
      },
      {
        prompt: "Count how many departments we have",
        description: "Simple count query"
      },
      {
        prompt: "Show me all agent conversations from the last 7 days",
        description: "Date filtering test"
      },
      {
        prompt: "List the first 10 tasks with their status",
        description: "Basic table query with limit"
      },
      {
        prompt: "Show me MCP executions that succeeded",
        description: "Filtering by status"
      }
    ];
    
    console.log(`🎯 Testing ${testQueries.length} queries with updated SQL generation...\\n`);
    
    const results = [];
    
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`=== TEST ${i + 1}/5: ${query.description} ===`);
      console.log(`📝 Prompt: "${query.prompt}"`);
      
      try {
        // Generate SQL with updated constraints
        const generateResponse = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              prompt: query.prompt,
              use_context: true
            }
          })
        });
        
        if (!generateResponse.ok) {
          console.log(`❌ SQL Generation failed: HTTP ${generateResponse.status}`);
          continue;
        }
        
        const generateResult = await generateResponse.json();
        const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
        
        if (!generateContent.success || !generateContent.data?.sql) {
          console.log(`❌ SQL Generation unsuccessful`);
          continue;
        }
        
        const generatedSQL = generateContent.data.sql;
        const confidence = generateContent.data.confidence;
        
        console.log(`🤖 Generated SQL: ${generatedSQL}`);
        console.log(`🎯 AI Confidence: ${(confidence * 100).toFixed(1)}%`);
        
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
            console.log(`✅ EXECUTION SUCCESSFUL!`);
            console.log(`📊 Rows returned: ${executeContent.data?.row_count || 0}`);
            
            results.push({
              ...query,
              status: 'success',
              sql: generatedSQL,
              confidence: confidence,
              rowCount: executeContent.data?.row_count || 0
            });
          } else {
            console.log(`❌ Execution failed: ${executeContent.error}`);
            results.push({
              ...query,
              status: 'execution_failed',
              sql: generatedSQL,
              confidence: confidence,
              error: executeContent.error
            });
          }
        } else {
          console.log(`❌ HTTP error during execution`);
          results.push({
            ...query,
            status: 'http_error',
            sql: generatedSQL,
            confidence: confidence
          });
        }
        
      } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        results.push({
          ...query,
          status: 'failed',
          error: error.message
        });
      }
      
      console.log(`\\n${'='.repeat(70)}\\n`);
    }
    
    // Analyze results
    console.log('🏁 SUPABASE-COMPATIBLE SQL TEST RESULTS\\n');
    
    const successful = results.filter(r => r.status === 'success');
    const executionFailed = results.filter(r => r.status === 'execution_failed');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log('📊 RESULTS BREAKDOWN:');
    console.log(`   ✅ Fully Successful: ${successful.length}/${results.length} (${(successful.length / results.length * 100).toFixed(0)}%)`);
    console.log(`   ⚠️  Generated but Failed Execution: ${executionFailed.length}/${results.length}`);
    console.log(`   ❌ Complete Failures: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
      console.log(`\\n✅ SUCCESSFUL QUERIES:`);
      successful.forEach(r => {
        console.log(`   • ${r.description}: ${r.sql}`);
        console.log(`     Confidence: ${(r.confidence * 100).toFixed(1)}%, Rows: ${r.rowCount}`);
      });
    }
    
    if (executionFailed.length > 0) {
      console.log(`\\n❌ EXECUTION FAILURES:`);
      executionFailed.forEach(r => {
        console.log(`   • ${r.description}: ${r.error}`);
        console.log(`     SQL: ${r.sql}`);
      });
    }
    
    console.log('\\n🎯 ASSESSMENT:');
    const successRate = successful.length / results.length;
    if (successRate >= 0.8) {
      console.log('✅ EXCELLENT: Supabase constraints properly implemented');
    } else if (successRate >= 0.6) {
      console.log('⚠️  GOOD: Most queries work, some refinement needed');
    } else {
      console.log('❌ NEEDS WORK: Supabase constraints not fully addressed');
    }
    
    console.log('\\n✅ Supabase-compatible SQL testing complete!');
    return results;
    
  } catch (error) {
    console.error('❌ Testing failed:', error.message);
    process.exit(1);
  }
};

testSupabaseCompatibleSQL();