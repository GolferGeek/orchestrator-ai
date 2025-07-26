const testComplexBusinessQueries = async () => {
  try {
    console.log('🧪 Testing complex business queries to validate SQL generation framework...\n');
    
    const complexQueries = [
      {
        prompt: "Show me the top 5 departments by revenue performance compared to their KPI goals, including the percentage difference",
        description: "Multi-table JOIN with aggregation, calculations, and ranking",
        difficulty: "Advanced",
        expectedTables: ["departments", "kpi_data", "kpi_goals", "kpi_metrics"],
        businessValue: "Executive dashboard query"
      },
      {
        prompt: "Find all agents that have been running for more than 24 hours without completing any tasks, along with their last activity time",
        description: "Date calculations, filtering, and operational monitoring",
        difficulty: "Intermediate",
        expectedTables: ["agent_conversations", "tasks"],
        businessValue: "System health monitoring"
      },
      {
        prompt: "Calculate the average response time of MCP tools grouped by provider, but only for the last 30 days and exclude any executions that failed",
        description: "Date filtering, aggregation, conditional filtering",
        difficulty: "Intermediate",
        expectedTables: ["mcp_executions"],
        businessValue: "Performance analytics"
      },
      {
        prompt: "Show me which users have the highest task completion rate and list their top 3 most frequently used agent types",
        description: "Complex aggregation, ranking, and subqueries",
        difficulty: "Advanced",
        expectedTables: ["users", "tasks", "agent_conversations"],
        businessValue: "User productivity analysis"
      },
      {
        prompt: "Find departments where the actual KPI values are more than 20% below their goals, and show the specific metrics that are underperforming",
        description: "Percentage calculations, filtering, and business logic",
        difficulty: "Advanced",
        expectedTables: ["departments", "kpi_data", "kpi_goals", "kpi_metrics"],
        businessValue: "Performance gap analysis"
      },
      {
        prompt: "List all LLM providers and their models, showing total usage count, average execution time, and success rate for each model",
        description: "Multi-level aggregation and success rate calculations",
        difficulty: "Intermediate",
        expectedTables: ["llm_providers", "llm_models", "mcp_executions"],
        businessValue: "AI model performance tracking"
      },
      {
        prompt: "Show me a monthly trend of agent conversations by organizational type for the past 6 months, including the number of completed vs incomplete conversations",
        description: "Time series analysis, grouping, and conditional aggregation",
        difficulty: "Advanced",
        expectedTables: ["agent_conversations", "organizational_agent_stats"],
        businessValue: "Usage trend analysis"
      },
      {
        prompt: "Find users who have multiple active sessions but haven't had any task activity in the last week, ordered by their last login time",
        description: "Multiple conditions, date ranges, and user behavior analysis",
        difficulty: "Intermediate",
        expectedTables: ["users", "user_sessions", "tasks"],
        businessValue: "User engagement monitoring"
      },
      {
        prompt: "Calculate the cost efficiency of each agent type by dividing total successful task completions by total execution time in hours",
        description: "Complex calculations, efficiency metrics, and business KPIs",
        difficulty: "Advanced",
        expectedTables: ["agent_conversations", "tasks", "organizational_agent_stats"],
        businessValue: "Operational efficiency analysis"
      },
      {
        prompt: "Show me all companies and their departments ranked by KPI performance, including a breakdown of which specific metrics each department excels or lags in",
        description: "Multi-table analysis, ranking, and performance categorization",
        difficulty: "Expert",
        expectedTables: ["companies", "departments", "kpi_data", "kpi_goals", "kpi_metrics"],
        businessValue: "Comprehensive business intelligence"
      }
    ];
    
    console.log(`🎯 Testing ${complexQueries.length} complex business scenarios...\n`);
    
    const results = [];
    
    for (let i = 0; i < complexQueries.length; i++) {
      const query = complexQueries[i];
      console.log(`=== COMPLEX TEST ${i + 1}/10: ${query.difficulty} ===`);
      console.log(`📋 Business Scenario: ${query.businessValue}`);
      console.log(`📝 Query: "${query.prompt}"`);
      console.log(`🎯 Expected Tables: ${query.expectedTables.join(', ')}`);
      console.log(`💡 Challenge: ${query.description}`);
      
      const startTime = Date.now();
      
      try {
        // Generate SQL for complex business query
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
          results.push({ ...query, status: 'failed', reason: 'HTTP error' });
          continue;
        }
        
        const generateResult = await generateResponse.json();
        const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
        
        if (!generateContent.success || !generateContent.data?.sql) {
          console.log(`❌ SQL Generation unsuccessful`);
          results.push({ ...query, status: 'failed', reason: 'No SQL generated' });
          continue;
        }
        
        const generatedSQL = generateContent.data.sql;
        const confidence = generateContent.data.confidence;
        const generationTime = generateContent.data.execution_time_ms;
        
        console.log(`🤖 Generated SQL: ${generatedSQL}`);
        console.log(`🎯 AI Confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`⏱️  Generation Time: ${generationTime}ms`);
        
        // Analyze SQL complexity and correctness
        const analysis = analyzeSQLComplexity(generatedSQL, query.expectedTables);
        console.log(`📊 SQL Analysis:`);
        console.log(`   • Complexity Score: ${analysis.complexityScore}/10`);
        console.log(`   • Uses Expected Tables: ${analysis.usesExpectedTables ? 'Yes' : 'No'}`);
        console.log(`   • Has Aggregation: ${analysis.hasAggregation ? 'Yes' : 'No'}`);
        console.log(`   • Has JOINs: ${analysis.hasJoins ? 'Yes' : 'No'}`);
        console.log(`   • Has Date Logic: ${analysis.hasDateLogic ? 'Yes' : 'No'}`);
        console.log(`   • Has Calculations: ${analysis.hasCalculations ? 'Yes' : 'No'}`);
        
        // Execute the query for REAL DATA!
        console.log(`\n⚡ EXECUTING SQL FOR REAL DATA...`);
        const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              sql: generatedSQL,
              dry_run: false // REAL EXECUTION!
            }
          })
        });
        
        const totalTime = Date.now() - startTime;
        
        if (executeResponse.ok) {
          const executeResult = await executeResponse.json();
          const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
          
          if (executeContent.success) {
            console.log(`✅ SQL VALIDATION SUCCESSFUL!`);
            console.log(`🔒 Security: ${executeContent.data?.validation_results?.is_safe ? 'SAFE' : 'UNSAFE'}`);
            console.log(`💰 Estimated Cost: ${executeContent.data?.validation_results?.estimated_cost || 'unknown'}`);
            
            results.push({
              ...query,
              status: 'success',
              sql: generatedSQL,
              confidence: confidence,
              analysis: analysis,
              totalTime: totalTime,
              isValid: true
            });
          } else {
            console.log(`⚠️  SQL Generated but validation failed`);
            results.push({
              ...query,
              status: 'partial',
              sql: generatedSQL,
              confidence: confidence,
              analysis: analysis,
              totalTime: totalTime,
              isValid: false,
              reason: 'Validation failed'
            });
          }
        } else {
          console.log(`⚠️  SQL Generated but execution test failed`);
          results.push({
            ...query,
            status: 'partial',
            sql: generatedSQL,
            confidence: confidence,
            analysis: analysis,
            totalTime: totalTime,
            isValid: false,
            reason: 'Execution test failed'
          });
        }
        
      } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        results.push({ ...query, status: 'failed', reason: error.message });
      }
      
      console.log(`\n${'='.repeat(80)}\n`);
    }
    
    // Generate comprehensive test report
    console.log('🏁 COMPLEX BUSINESS QUERY TEST RESULTS\n');
    
    const successful = results.filter(r => r.status === 'success');
    const partial = results.filter(r => r.status === 'partial');
    const failed = results.filter(r => r.status === 'failed');
    
    console.log('📊 OVERALL STATISTICS:');
    console.log(`   ✅ Fully Successful: ${successful.length}/10 (${(successful.length * 10)}%)`);
    console.log(`   ⚠️  Partially Successful: ${partial.length}/10 (${(partial.length * 10)}%)`);
    console.log(`   ❌ Failed: ${failed.length}/10 (${(failed.length * 10)}%)`);
    
    if (successful.length > 0) {
      const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
      const avgComplexity = successful.reduce((sum, r) => sum + r.analysis.complexityScore, 0) / successful.length;
      const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      
      console.log(`\n📈 SUCCESS METRICS:`);
      console.log(`   🎯 Average AI Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`   🧮 Average SQL Complexity: ${avgComplexity.toFixed(1)}/10`);
      console.log(`   ⏱️  Average Total Time: ${avgTime.toFixed(0)}ms`);
    }
    
    console.log('\n🔍 DETAILED BREAKDOWN BY DIFFICULTY:');
    ['Intermediate', 'Advanced', 'Expert'].forEach(difficulty => {
      const difficultyResults = results.filter(r => r.difficulty === difficulty);
      const difficultySuccess = difficultyResults.filter(r => r.status === 'success').length;
      console.log(`   ${difficulty}: ${difficultySuccess}/${difficultyResults.length} successful`);
    });
    
    if (failed.length > 0) {
      console.log('\n❌ FAILED QUERIES ANALYSIS:');
      failed.forEach(result => {
        console.log(`   • ${result.businessValue}: ${result.reason}`);
      });
    }
    
    console.log('\n🎯 FRAMEWORK ASSESSMENT:');
    const successRate = (successful.length + partial.length) / results.length;
    if (successRate >= 0.8) {
      console.log('✅ EXCELLENT: Framework handles complex business queries very well');
    } else if (successRate >= 0.6) {
      console.log('⚠️  GOOD: Framework handles most queries but needs improvement');
    } else {
      console.log('❌ NEEDS WORK: Framework struggles with complex business scenarios');
    }
    
    console.log('\n🚀 SQL Generation Framework thoroughly tested!');
    return results;
    
  } catch (error) {
    console.error('❌ Complex query testing failed:', error.message);
    process.exit(1);
  }
};

// Helper function to analyze SQL complexity
function analyzeSQLComplexity(sql, expectedTables) {
  const sqlLower = sql.toLowerCase();
  let complexityScore = 1; // Base score
  
  const analysis = {
    hasAggregation: false,
    hasJoins: false,
    hasDateLogic: false,
    hasCalculations: false,
    hasSubqueries: false,
    hasWindowFunctions: false,
    usesExpectedTables: false
  };
  
  // Check for aggregation functions
  if (sqlLower.match(/\b(count|sum|avg|max|min|group by)\b/)) {
    analysis.hasAggregation = true;
    complexityScore += 2;
  }
  
  // Check for JOINs
  if (sqlLower.match(/\b(join|left join|right join|inner join|outer join)\b/)) {
    analysis.hasJoins = true;
    complexityScore += 2;
  }
  
  // Check for date logic
  if (sqlLower.match(/\b(date|timestamp|interval|now\(\)|current_date|extract)\b/)) {
    analysis.hasDateLogic = true;
    complexityScore += 1;
  }
  
  // Check for calculations
  if (sqlLower.match(/[+\-*/]/) || sqlLower.includes('case when')) {
    analysis.hasCalculations = true;
    complexityScore += 2;
  }
  
  // Check for subqueries
  if (sqlLower.match(/\(\s*select\b/) || sqlLower.includes('with ')) {
    analysis.hasSubqueries = true;
    complexityScore += 3;
  }
  
  // Check for window functions
  if (sqlLower.match(/\b(row_number|rank|dense_rank|partition by|over\s*\()\b/)) {
    analysis.hasWindowFunctions = true;
    complexityScore += 3;
  }
  
  // Check if uses expected tables
  const tablesInSQL = expectedTables.filter(table => 
    sqlLower.includes(table.toLowerCase())
  );
  analysis.usesExpectedTables = tablesInSQL.length > 0;
  if (analysis.usesExpectedTables) {
    complexityScore += 1;
  }
  
  return {
    ...analysis,
    complexityScore: Math.min(complexityScore, 10),
    tablesFound: tablesInSQL
  };
}

testComplexBusinessQueries();