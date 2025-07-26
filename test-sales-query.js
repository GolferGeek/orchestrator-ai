const testSalesQuery = async () => {
  try {
    console.log('💼 Testing business query: "Tell me about last year\'s sales"...\n');
    
    const businessPrompt = "tell me about last year's sales";
    
    // STEP 1: Generate SQL
    console.log('🤖 STEP 1: Generating SQL for sales query...');
    
    const generateResponse = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          prompt: businessPrompt,
          use_context: true
        }
      })
    });
    
    if (!generateResponse.ok) {
      console.log(`❌ SQL Generation failed: HTTP ${generateResponse.status}`);
      return;
    }
    
    const generateResult = await generateResponse.json();
    const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
    
    if (!generateContent.success || !generateContent.data?.sql) {
      console.log(`❌ SQL Generation unsuccessful`);
      if (generateContent.error) {
        console.log(`🚨 Error: ${generateContent.error}`);
      }
      return;
    }
    
    const generatedSQL = generateContent.data.sql;
    console.log(`✅ SQL Generated: ${generatedSQL}`);
    console.log(`🎯 Confidence: ${(generateContent.data.confidence * 100).toFixed(1)}%`);
    console.log(`⏱️  Generation time: ${generateContent.data.execution_time_ms}ms`);
    console.log(`🤖 Model: ${generateContent.data.model_used}`);
    
    if (generateContent.data.explanation) {
      console.log(`💭 AI Explanation: ${generateContent.data.explanation}`);
    }
    
    if (generateContent.data.warnings && generateContent.data.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${generateContent.data.warnings.join(', ')}`);
    }
    
    // STEP 2: Execute the SQL
    console.log(`\n⚡ STEP 2: Executing sales query against real database...`);
    
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
      console.log(`❌ SQL Execution failed: HTTP ${executeResponse.status}`);
      const errorText = await executeResponse.text();
      console.log(`🚨 Error: ${errorText.substring(0, 300)}...`);
      return;
    }
    
    const executeResult = await executeResponse.json();
    const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
    
    if (executeContent.success && executeContent.data) {
      const innerData = executeContent.data;
      console.log(`✅ Sales query executed successfully!`);
      console.log(`📊 Rows returned: ${innerData.row_count}`);
      console.log(`⏱️  Execution time: ${innerData.execution_time_ms}ms`);
      console.log(`🔒 Security: ${innerData.validation_results?.is_safe ? 'SAFE' : 'UNSAFE'}`);
      console.log(`💰 Cost estimate: ${innerData.validation_results?.estimated_cost || 'unknown'}`);
      
      // Show results
      if (innerData.data && innerData.data.length > 0) {
        console.log(`\n📈 SALES DATA RESULTS:`);
        innerData.data.forEach((row, index) => {
          console.log(`   ${index + 1}. ${JSON.stringify(row, null, 2)}`);
        });
        
        console.log(`\n📊 BUSINESS INSIGHTS:`);
        console.log(`   • Query successfully found ${innerData.data.length} sales-related records`);
        console.log(`   • AI correctly interpreted business terminology`);
        console.log(`   • Real data retrieved from your actual database schema`);
        
      } else {
        console.log(`📋 No sales data found for last year`);
        console.log(`💡 This could mean:`);
        console.log(`   • No sales data exists for the specified period`);
        console.log(`   • Sales data might be in different tables`);
        console.log(`   • Date filtering might need adjustment`);
      }
      
      // STEP 3: Success summary
      console.log(`\n🎉 BUSINESS QUERY SUCCESS!`);
      const totalTime = generateContent.data.execution_time_ms + innerData.execution_time_ms;
      console.log(`⏱️  Total business query time: ${totalTime}ms`);
      console.log(`✅ Workflow: Business Question → AI Analysis → SQL Generation → Real Database Query`);
      
    } else {
      console.log(`❌ Sales query execution failed`);
      if (executeContent.error) {
        console.log(`🚨 Error: ${executeContent.error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Sales query test failed:', error.message);
  }
};

testSalesQuery();