const testDirectKPITables = async () => {
  try {
    console.log('🎯 Testing direct access to KPI tables...\n');
    
    const directKPIQueries = [
      {
        sql: "SELECT COUNT(*) FROM kpi_data",
        description: "Count records in kpi_data table"
      },
      {
        sql: "SELECT * FROM kpi_data LIMIT 5",
        description: "Sample data from kpi_data table"
      },
      {
        sql: "SELECT COUNT(*) FROM kpi_metrics", 
        description: "Count records in kpi_metrics table"
      },
      {
        sql: "SELECT * FROM kpi_metrics LIMIT 5",
        description: "Sample data from kpi_metrics table"
      },
      {
        sql: "SELECT COUNT(*) FROM kpi_goals",
        description: "Count records in kpi_goals table"
      },
      {
        sql: "SELECT * FROM kpi_goals LIMIT 5",
        description: "Sample data from kpi_goals table"
      }
    ];
    
    console.log(`🔍 Testing ${directKPIQueries.length} direct KPI table queries...\n`);
    
    for (let i = 0; i < directKPIQueries.length; i++) {
      const query = directKPIQueries[i];
      console.log(`=== DIRECT KPI TEST ${i + 1}: ${query.description} ===`);
      console.log(`📝 SQL: ${query.sql}`);
      
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
        
        if (!executeResponse.ok) {
          console.log(`❌ Execution failed: HTTP ${executeResponse.status}`);
          const errorText = await executeResponse.text();
          console.log(`🚨 Error: ${errorText.substring(0, 300)}...`);
          continue;
        }
        
        const executeResult = await executeResponse.json();
        const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
        
        if (executeContent.success && executeContent.data) {
          const innerData = executeContent.data;
          console.log(`✅ Query executed successfully!`);
          console.log(`📊 Rows returned: ${innerData.row_count}`);
          console.log(`⏱️  Execution time: ${innerData.execution_time_ms}ms`);
          
          if (innerData.data && innerData.data.length > 0) {
            console.log(`\n📋 KPI TABLE RESULTS:`);
            innerData.data.forEach((row, index) => {
              console.log(`   ${index + 1}. ${JSON.stringify(row)}`);
            });
            
            console.log(`\n✅ KPI Table Status: Contains ${innerData.data.length} records`);
          } else {
            console.log(`📋 KPI Table Status: Empty (0 records)`);
          }
          
        } else {
          console.log(`❌ Query failed`);
          if (executeContent.error) {
            console.log(`🚨 Error: ${executeContent.error}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
      }
      
      console.log(`\n${'='.repeat(60)}\n`);
    }
    
    // Test a natural language query specifically targeting KPI tables
    console.log('=== NATURAL LANGUAGE TEST: Force KPI Table Usage ===');
    console.log('📝 Testing AI query with explicit KPI table mention...');
    
    try {
      const forcedKPIPrompt = "SELECT * FROM kpi_data table to show me KPI values";
      
      const generateResponse = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            prompt: forcedKPIPrompt,
            use_context: true
          }
        })
      });
      
      if (generateResponse.ok) {
        const generateResult = await generateResponse.json();
        const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
        
        if (generateContent.success && generateContent.data?.sql) {
          console.log(`✅ AI Generated SQL: ${generateContent.data.sql}`);
          console.log(`🎯 Confidence: ${(generateContent.data.confidence * 100).toFixed(1)}%`);
          
          const sqlLower = generateContent.data.sql.toLowerCase();
          if (sqlLower.includes('kpi_data')) {
            console.log(`🎯 ✅ Successfully targeted kpi_data table!`);
          } else {
            console.log(`⚠️  AI still didn't use kpi_data table explicitly`);
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Natural language test failed: ${error.message}`);
    }
    
    console.log('\n🏁 DIRECT KPI TABLE TESTING SUMMARY');
    console.log('🔍 Tested direct access to all three KPI tables');
    console.log('📊 Verified table existence and data content');
    console.log('💡 Identified whether KPI tables are populated with data');
    console.log('🤖 Tested AI ability to target specific KPI tables');
    
  } catch (error) {
    console.error('❌ Direct KPI testing failed:', error.message);
    process.exit(1);
  }
};

testDirectKPITables();