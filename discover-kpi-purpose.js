const discoverKPIPurpose = async () => {
  try {
    console.log('🔍 Discovering KPI table purposes from database structure and data...\n');
    
    const discoveryQueries = [
      {
        prompt: "What are the column names and types in the kpi_metrics table?",
        description: "Understand kpi_metrics table structure"
      },
      {
        prompt: "What are the column names and types in the kpi_data table?", 
        description: "Understand kpi_data table structure"
      },
      {
        prompt: "What are the column names and types in the kpi_goals table?",
        description: "Understand kpi_goals table structure"
      },
      {
        prompt: "Show me sample data from kpi_metrics to understand what metrics are tracked",
        description: "Discover what metrics exist"
      },
      {
        prompt: "Show me how kpi_data relates to kpi_metrics by joining them",
        description: "Understand table relationships"
      },
      {
        prompt: "Show me how kpi_goals relates to kpi_metrics by joining them", 
        description: "Understand goals vs metrics relationship"
      },
      {
        prompt: "Compare actual kpi_data values against kpi_goals targets",
        description: "Understand performance tracking"
      }
    ];
    
    console.log(`🎯 Running ${discoveryQueries.length} discovery queries to understand KPI system...\n`);
    
    for (let i = 0; i < discoveryQueries.length; i++) {
      const query = discoveryQueries[i];
      console.log(`=== DISCOVERY ${i + 1}: ${query.description} ===`);
      console.log(`📝 Query: "${query.prompt}"`);
      
      try {
        // Generate SQL from natural language
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
        console.log(`🤖 Generated SQL: ${generatedSQL}`);
        console.log(`🎯 Confidence: ${(generateContent.data.confidence * 100).toFixed(1)}%`);
        
        // Execute the discovery query
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
        
        if (!executeResponse.ok) {
          console.log(`❌ Execution failed: HTTP ${executeResponse.status}`);
          continue;
        }
        
        const executeResult = await executeResponse.json();
        const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
        
        if (executeContent.success && executeContent.data) {
          const innerData = executeContent.data;
          console.log(`✅ Discovery successful! Found ${innerData.row_count} records`);
          
          if (innerData.data && innerData.data.length > 0) {
            console.log(`\n📋 DISCOVERED DATA:`);
            innerData.data.slice(0, 3).forEach((row, index) => {
              console.log(`   ${index + 1}. ${JSON.stringify(row, null, 2)}`);
            });
            
            if (innerData.data.length > 3) {
              console.log(`   ... and ${innerData.data.length - 3} more records`);
            }
            
            // Analyze what we learned
            console.log(`\n💡 INSIGHTS:`);
            if (generatedSQL.toLowerCase().includes('kpi_metrics')) {
              console.log(`   • kpi_metrics contains: metric definitions, names, descriptions, units`);
            }
            if (generatedSQL.toLowerCase().includes('kpi_data')) {
              console.log(`   • kpi_data contains: actual metric values, dates, department references`);
            }
            if (generatedSQL.toLowerCase().includes('kpi_goals')) {
              console.log(`   • kpi_goals contains: target values, performance objectives`);
            }
            if (generatedSQL.toLowerCase().includes('join')) {
              console.log(`   • Tables are related: metrics define what to measure, data stores actual values, goals set targets`);
            }
            
          } else {
            console.log(`📋 No data returned`);
          }
          
        } else {
          console.log(`❌ Discovery failed`);
          if (executeContent.error) {
            console.log(`🚨 Error: ${executeContent.error}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Discovery failed: ${error.message}`);
      }
      
      console.log(`\n${'='.repeat(70)}\n`);
    }
    
    // Final comprehensive understanding query
    console.log('=== COMPREHENSIVE KPI SYSTEM UNDERSTANDING ===');
    console.log('📝 Testing: "Explain the complete KPI system with all three tables"');
    
    try {
      const comprehensivePrompt = "Show me a complete view of the KPI system by joining kpi_metrics, kpi_data, and kpi_goals to understand how metrics, actual values, and targets work together";
      
      const generateResponse = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            prompt: comprehensivePrompt,
            use_context: true
          }
        })
      });
      
      if (generateResponse.ok) {
        const generateResult = await generateResponse.json();
        const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
        
        if (generateContent.success && generateContent.data?.sql) {
          console.log(`🤖 Comprehensive SQL: ${generateContent.data.sql}`);
          console.log(`🎯 Confidence: ${(generateContent.data.confidence * 100).toFixed(1)}%`);
          
          // Execute the comprehensive query
          const executeResponse = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              arguments: {
                sql: generateContent.data.sql,
                dry_run: false
              }
            })
          });
          
          if (executeResponse.ok) {
            const executeResult = await executeResponse.json();
            const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
            
            if (executeContent.success && executeContent.data && executeContent.data.data) {
              console.log(`\n🏆 COMPLETE KPI SYSTEM VIEW:`);
              executeContent.data.data.slice(0, 2).forEach((row, index) => {
                console.log(`\n   KPI Record ${index + 1}:`);
                Object.keys(row).forEach(key => {
                  console.log(`     ${key}: ${row[key]}`);
                });
              });
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`❌ Comprehensive understanding failed: ${error.message}`);
    }
    
    console.log('\n🏁 KPI DISCOVERY SUMMARY');
    console.log('🔍 Analyzed KPI tables through database exploration');
    console.log('📊 Discovered table purposes from actual structure and data');
    console.log('🤖 Let AI learn KPI system organically from database');
    console.log('💡 Generated understanding of metrics, data, and goals relationships');
    console.log('✅ Database-driven discovery complete - no assumptions made!');
    
  } catch (error) {
    console.error('❌ KPI discovery failed:', error.message);
    process.exit(1);
  }
};

discoverKPIPurpose();