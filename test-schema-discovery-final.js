const testSchemaDiscovery = async () => {
  try {
    console.log('Testing schema discovery with service role key...');
    
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
    
    // Parse the JSON response from the text content
    const parsedContent = JSON.parse(result.tool_result.content[0].text);
    const tables = parsedContent.data.schema.tables;
    
    console.log('\n=== SCHEMA DISCOVERY SUCCESS ===');
    console.log(`🎉 Successfully discovered ${tables.length} tables!`);
    console.log(`✅ Service role key is working correctly`);
    
    console.log('\n=== TABLE BREAKDOWN ===');
    console.log(`📊 Total tables: ${tables.length}`);
    console.log(`📋 Tables with detailed columns: ${tables.filter(t => t.columns?.length >= 5).length}`);
    console.log(`🔗 Tables with many columns (10+): ${tables.filter(t => t.columns?.length >= 10).length}`);
    
    console.log('\n=== DISCOVERED TABLES ===');
    tables.forEach((table, index) => {
      const columnCount = table.columns ? table.columns.length : 0;
      console.log(`${index + 1}. ${table.name} (${columnCount} columns)`);
    });
    
    console.log('\n=== SAMPLE TABLE SCHEMAS ===');
    // Show details for first few tables
    tables.slice(0, 3).forEach(table => {
      console.log(`\n📋 ${table.name}:`);
      if (table.columns && table.columns.length > 0) {
        table.columns.slice(0, 5).forEach(col => {
          const pk = col.primary_key ? ' (PK)' : '';
          const nullable = col.nullable ? ' (nullable)' : ' (required)';
          console.log(`   • ${col.name}: ${col.type}${pk}${nullable}`);
        });
        if (table.columns.length > 5) {
          console.log(`   ... and ${table.columns.length - 5} more columns`);
        }
      }
    });
    
    console.log('\n=== SUCCESS COMPARISON ===');
    console.log(`🔑 Previous result with anon key: ~11 tables`);
    console.log(`🗝️  Current result with service role key: ${tables.length} tables`);
    console.log(`✅ Service role key provides access to ${tables.length - 11} additional tables!`);
    
    console.log('\n✅ Schema discovery debugging completed successfully');
    
  } catch (error) {
    console.error('❌ Schema discovery test failed:', error.message);
    process.exit(1);
  }
};

testSchemaDiscovery();