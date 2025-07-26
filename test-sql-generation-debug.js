const testSQLGenerationDebug = async () => {
  try {
    console.log('🔍 Debugging SQL generation issues...\n');
    
    // Start with a simple test
    const testPrompt = "Count all users in the system";
    console.log(`📝 Testing simple prompt: "${testPrompt}"`);
    
    const response = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          prompt: testPrompt,
          use_context: true
        }
      })
    });
    
    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ HTTP Error Response: ${errorText}`);
      return;
    }
    
    const result = await response.json();
    console.log(`\n📋 Full Response Structure:`);
    console.log(JSON.stringify(result, null, 2));
    
    // Try to parse the content
    if (result.tool_result && result.tool_result.content && result.tool_result.content[0]) {
      console.log(`\n📄 Content Text:`);
      console.log(result.tool_result.content[0].text);
      
      try {
        const content = JSON.parse(result.tool_result.content[0].text);
        console.log(`\n✅ Parsed Content:`);
        console.log(JSON.stringify(content, null, 2));
        
        if (content.error) {
          console.log(`\n🚨 Error in content: ${content.error}`);
        }
        
      } catch (parseError) {
        console.log(`\n❌ Failed to parse content as JSON: ${parseError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }
};

testSQLGenerationDebug();