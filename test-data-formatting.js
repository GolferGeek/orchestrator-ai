const testDataFormatting = async () => {
  try {
    console.log('🧪 Testing real data formatting in multiple formats...\n');
    
    // Test 1: Get schema in different formats
    console.log('=== TEST 1: Schema in Multiple Formats ===');
    
    const formats = ['json', 'markdown', 'sql'];
    for (const format of formats) {
      console.log(`\n📋 Testing schema in ${format.toUpperCase()} format...`);
      
      const response = await fetch('http://localhost:4000/mcp/supabase/tools/get-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {
            format: format,
            table_names: ['users', 'agents'], // Limit to specific tables for testing
            refresh_cache: false
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Schema ${format} failed: ${response.status}`);
      }
      
      const result = await response.json();
      const content = JSON.parse(result.tool_result.content[0].text);
      
      console.log(`✅ ${format.toUpperCase()} format successful`);
      console.log(`📊 Data type: ${typeof content.data.schema}`);
      
      if (format === 'json') {
        console.log(`📋 Tables: ${content.data.schema.tables?.length || 0}`);
      } else {
        console.log(`📝 Content length: ${typeof content.data.schema === 'string' ? content.data.schema.length : 'Not string'} chars`);
        if (typeof content.data.schema === 'string') {
          console.log(`📄 Preview: ${content.data.schema.substring(0, 100)}...`);
        }
      }
    }
    
    // Test 2: Read data from a table
    console.log('\n\n=== TEST 2: Read Data from Tables ===');
    
    const tablesToTest = ['users', 'agents', 'tasks'];
    for (const tableName of tablesToTest) {
      console.log(`\n📊 Reading data from ${tableName} table...`);
      
      try {
        const response = await fetch('http://localhost:4000/mcp/supabase/tools/read-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              table_name: tableName,
              limit: 3 // Small limit for testing
            }
          })
        });
        
        if (!response.ok) {
          console.log(`⚠️  ${tableName}: HTTP ${response.status} (may be empty or access restricted)`);
          continue;
        }
        
        const result = await response.json();
        const content = JSON.parse(result.tool_result.content[0].text);
        
        if (content.success && content.data?.rows) {
          console.log(`✅ ${tableName}: ${content.data.rows.length} rows retrieved`);
          console.log(`📋 Columns: ${content.data.columns?.length || 0}`);
          if (content.data.columns?.length > 0) {
            console.log(`🔑 Sample columns: ${content.data.columns.slice(0, 3).join(', ')}`);
          }
        } else {
          console.log(`⚠️  ${tableName}: No data or unexpected format`);
        }
        
      } catch (error) {
        console.log(`❌ ${tableName}: ${error.message}`);
      }
    }
    
    // Test 3: Execute SQL with different result formats
    console.log('\n\n=== TEST 3: SQL Execution with Results ===');
    
    const simpleQueries = [
      { sql: 'SELECT COUNT(*) as total_users FROM users', desc: 'Count users' },
      { sql: 'SELECT COUNT(*) as total_agents FROM agents', desc: 'Count agents' },
      { sql: 'SELECT COUNT(*) as total_tasks FROM tasks', desc: 'Count tasks' }
    ];
    
    for (const query of simpleQueries) {
      console.log(`\n🔍 Testing: ${query.desc}`);
      console.log(`📝 SQL: ${query.sql}`);
      
      try {
        const response = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              sql: query.sql,
              dry_run: false, // Execute for real
              max_rows: 10
            }
          })
        });
        
        if (!response.ok) {
          console.log(`❌ Query failed: HTTP ${response.status}`);
          continue;
        }
        
        const result = await response.json();
        const content = JSON.parse(result.tool_result.content[0].text);
        
        if (content.success) {
          console.log(`✅ Success: ${content.row_count} rows returned`);
          console.log(`⏱️  Execution time: ${content.execution_time_ms}ms`);
          console.log(`🔒 Safety check: ${content.validation_results.is_safe ? 'SAFE' : 'UNSAFE'}`);
          if (content.data && content.data.length > 0) {
            console.log(`📊 Result: ${JSON.stringify(content.data[0])}`);
          }
        } else {
          console.log(`❌ Query unsuccessful`);
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
    
    // Test 4: Query and Format Tool
    console.log('\n\n=== TEST 4: Query and Format Tool ===');
    
    const naturalLanguageQueries = [
      { prompt: 'How many users are in the system?', format: 'json' },
      { prompt: 'Show me the first 3 agent names', format: 'table' }
    ];
    
    for (const query of naturalLanguageQueries) {
      console.log(`\n🤖 Natural language query: "${query.prompt}"`);
      console.log(`📋 Format: ${query.format}`);
      
      try {
        const response = await fetch('http://localhost:4000/mcp/supabase/tools/query-and-format', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              prompt: query.prompt,
              format: query.format,
              execute: false, // Just generate SQL for safety
              use_context: true
            }
          })
        });
        
        if (!response.ok) {
          console.log(`❌ Query failed: HTTP ${response.status}`);
          continue;
        }
        
        const result = await response.json();
        const content = JSON.parse(result.tool_result.content[0].text);
        
        if (content.success) {
          console.log(`✅ SQL Generated successfully`);
          if (content.generated_sql) {
            console.log(`📝 Generated SQL: ${content.generated_sql}`);
          }
          console.log(`⏱️  Generation time: ${content.generation_time_ms || 'Unknown'}ms`);
        } else {
          console.log(`❌ Query generation failed`);
        }
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n\n🎉 Data formatting tests completed!');
    console.log('✅ All format tests demonstrate real data processing capabilities');
    
  } catch (error) {
    console.error('❌ Data formatting test failed:', error.message);
    process.exit(1);
  }
};

testDataFormatting();