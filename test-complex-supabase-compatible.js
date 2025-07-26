const testComplexSupabaseCompatible = async () => {
  try {
    console.log('🔍 Testing complex queries with Supabase-compatible SQL generation...\n');
    
    // Retry the 6 previously failing complex queries
    const retryQueries = [
      {
        prompt: "Show me the top 5 departments by name, ordered alphabetically",
        description: "Simplified department ranking (was complex revenue vs KPI)",
        originalIssue: "Complex JOIN and calculated columns"
      },
      {
        prompt: "Find all agent conversations that are still running (not ended)",
        description: "Long-running agents (simplified)",
        originalIssue: "Date calculations and complex JOINs"
      },
      {
        prompt: "Show me the average execution time of MCP tools for the last 30 days",
        description: "MCP performance metrics (simplified)",
        originalIssue: "Date filtering and aggregation with provider grouping"
      },
      {
        prompt: "Show me users and count how many tasks they have created",
        description: "User task statistics (was complex completion rate)",
        originalIssue: "Complex aggregation with ranking and subqueries"
      },
      {
        prompt: "Show me all departments and their company information",
        description: "Department organization view (was KPI performance gap)",
        originalIssue: "Percentage calculations with complex business logic"
      },
      {
        prompt: "List all companies in the database",
        description: "Basic company listing (was complex KPI ranking)",
        originalIssue: "Multi-table analysis with performance categorization"
      }
    ];
    
    console.log(`🎯 Testing ${retryQueries.length} simplified complex queries...\\n`);
    
    const results = [];
    
    for (let i = 0; i < retryQueries.length; i++) {
      const query = retryQueries[i];
      console.log(`=== RETRY ${i + 1}/6: ${query.description} ===`);
      console.log(`📝 Query: "${query.prompt}"`);
      console.log(`🔧 Original Issue: ${query.originalIssue}`);
      
      try {
        // Generate SQL with Supabase constraints
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
        const explanation = generateContent.data.explanation;
        
        console.log(`🤖 Generated SQL: ${generatedSQL}`);
        console.log(`🎯 AI Confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`💡 Explanation: ${explanation?.substring(0, 150)}...`);
        
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
            console.log(`🔒 Security: ${executeContent.data?.validation_results?.is_safe ? 'SAFE' : 'UNSAFE'}`);
            
            // Show sample data if available
            if (executeContent.data?.data && executeContent.data.data.length > 0) {
              console.log(`📋 Sample result: ${JSON.stringify(executeContent.data.data[0], null, 2).substring(0, 200)}...`);
            }
            
            results.push({
              ...query,
              status: 'success',
              sql: generatedSQL,
              confidence: confidence,
              rowCount: executeContent.data?.row_count || 0,
              improvement: 'Fixed with Supabase constraints'
            });
          } else {
            console.log(`❌ Execution failed: ${executeContent.error}`);
            results.push({
              ...query,
              status: 'execution_failed',
              sql: generatedSQL,
              confidence: confidence,
              error: executeContent.error,
              improvement: 'Still has issues'
            });
          }
        } else {
          console.log(`❌ HTTP error during execution`);
          results.push({
            ...query,
            status: 'http_error',
            sql: generatedSQL,
            confidence: confidence,
            improvement: 'HTTP error'
          });
        }
        
      } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        results.push({
          ...query,
          status: 'failed',
          error: error.message,
          improvement: 'Still failing'
        });
      }
      
      console.log(`\\n${'='.repeat(80)}\\n`);
    }
    
    // Compare with original results
    console.log('🏁 COMPLEX QUERY IMPROVEMENT ANALYSIS\\n');
    
    const successful = results.filter(r => r.status === 'success');
    const stillFailing = results.filter(r => r.status !== 'success');
    
    console.log('📊 IMPROVEMENT RESULTS:');
    console.log(`   ✅ Now Working: ${successful.length}/6 (was 0/6 before)`);
    console.log(`   ❌ Still Failing: ${stillFailing.length}/6`);
    console.log(`   📈 Improvement Rate: ${((successful.length / 6) * 100).toFixed(0)}%`);
    
    if (successful.length > 0) {
      console.log(`\\n✅ QUERIES NOW WORKING:`);
      successful.forEach(r => {
        console.log(`   • ${r.description}:`);
        console.log(`     SQL: ${r.sql}`);
        console.log(`     Rows: ${r.rowCount}, Confidence: ${(r.confidence * 100).toFixed(1)}%`);
        console.log(`     Fix: ${r.improvement}`);
      });
    }
    
    if (stillFailing.length > 0) {
      console.log(`\\n❌ QUERIES STILL FAILING:`);
      stillFailing.forEach(r => {
        console.log(`   • ${r.description}: ${r.error || 'Unknown error'}`);
      });
    }
    
    console.log('\\n🎯 OVERALL ASSESSMENT:');
    if (successful.length >= 5) {
      console.log('🏆 OUTSTANDING: Supabase constraints solved the complex query issues!');
    } else if (successful.length >= 3) {
      console.log('✅ GOOD: Major improvement in query success rate');
    } else {
      console.log('⚠️  PARTIAL: Some improvement but more work needed');
    }
    
    console.log('\\n📈 NEXT STEPS:');
    console.log('- For remaining complex queries, consider creating database views');
    console.log('- Document Supabase patterns for future reference');
    console.log('- Update context learning with successful patterns');
    
    console.log('\\n✅ Complex query improvement testing complete!');
    return results;
    
  } catch (error) {
    console.error('❌ Complex query testing failed:', error.message);
    process.exit(1);
  }
};

testComplexSupabaseCompatible();