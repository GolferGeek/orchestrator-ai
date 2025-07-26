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
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('\n=== SCHEMA DISCOVERY RESULTS ===');
    console.log(`Success: ${result.tool_result ? 'Yes' : 'No'}`);
    console.log(`Total tables: ${result.tool_result?.total_tables || 'Unknown'}`);
    console.log(`Cached: ${result.tool_result?.cached || 'No'}`);
    console.log(`Execution time: ${result.tool_result?.execution_time_ms || 'Unknown'}ms`);
    
    if (result.tool_result?.schema?.tables) {
      const tables = result.tool_result.schema.tables;
      console.log(`\nDISCOVERED TABLES (${tables.length}):`);
      tables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.name} (${table.columns?.length || 0} columns)`);
      });
      
      console.log('\n=== TABLE BREAKDOWN ===');
      console.log(`Tables with 1+ columns: ${tables.filter(t => t.columns?.length >= 1).length}`);
      console.log(`Tables with 5+ columns: ${tables.filter(t => t.columns?.length >= 5).length}`);
      console.log(`Tables with 10+ columns: ${tables.filter(t => t.columns?.length >= 10).length}`);
      
      // Show a few example tables with their columns
      console.log('\n=== SAMPLE TABLE SCHEMAS ===');
      tables.slice(0, 3).forEach(table => {
        console.log(`\n${table.name}:`);
        if (table.columns && table.columns.length > 0) {
          table.columns.slice(0, 5).forEach(col => {
            console.log(`  - ${col.name}: ${col.type}${col.primary_key ? ' (PK)' : ''}`);
          });
          if (table.columns.length > 5) {
            console.log(`  ... and ${table.columns.length - 5} more columns`);
          }
        } else {
          console.log('  (No column information available)');
        }
      });
    }
    
    console.log('\n✅ Schema discovery test completed');
    
  } catch (error) {
    console.error('❌ Schema discovery test failed:', error.message);
    process.exit(1);
  }
};

testSchemaDiscovery();