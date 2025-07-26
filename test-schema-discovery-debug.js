const testSchemaDiscovery = async () => {
  try {
    console.log('Testing schema discovery with debug output...');
    
    const response = await fetch('http://localhost:4000/mcp/supabase/tools/get-schema', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          format: 'json',
          refresh_cache: true
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('\n=== FULL RESPONSE ===');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Schema discovery test failed:', error.message);
    process.exit(1);
  }
};

testSchemaDiscovery();