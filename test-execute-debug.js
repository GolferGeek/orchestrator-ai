const testExecuteDebug = async () => {
  try {
    console.log('🔍 Debugging SQL execution response format...\n');
    
    const testSQL = "SELECT COUNT(*) AS user_count FROM users;";
    console.log(`📝 Testing SQL: ${testSQL}`);
    
    const response = await fetch('http://localhost:4000/mcp/supabase/tools/execute-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          sql: testSQL,
          dry_run: false
        }
      })
    });
    
    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ HTTP Error: ${errorText}`);
      return;
    }
    
    const result = await response.json();
    console.log(`\n📋 Full Response Structure:`);
    console.log(JSON.stringify(result, null, 2));
    
    if (result.tool_result && result.tool_result.content && result.tool_result.content[0]) {
      console.log(`\n📄 Content Text:`);
      console.log(result.tool_result.content[0].text);
      
      try {
        const content = JSON.parse(result.tool_result.content[0].text);
        console.log(`\n✅ Parsed Content:`);
        console.log(JSON.stringify(content, null, 2));
        
      } catch (parseError) {
        console.log(`\n❌ Failed to parse content: ${parseError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }
};

testExecuteDebug();