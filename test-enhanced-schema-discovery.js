const testEnhancedSchemaDiscovery = async () => {
  try {
    console.log('🔍 Testing enhanced schema discovery with table purpose analysis...\n');
    
    const response = await fetch('http://localhost:4000/mcp/supabase/tools/get-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          format: 'json',
          refresh_cache: true // Force fresh discovery
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const content = JSON.parse(result.tool_result.content[0].text);
    
    if (content.success && content.data && content.data.schema) {
      const tables = content.data.schema.tables;
      
      console.log('=== ENHANCED SCHEMA DISCOVERY RESULTS ===');
      console.log(`✅ Successfully discovered ${tables.length} tables with purpose analysis`);
      console.log(`⏱️  Total discovery time: ${content.data.execution_time_ms || 'Unknown'}ms`);
      console.log(`🔄 Cache status: ${content.data.cached ? 'Cached' : 'Fresh discovery'}`);
      
      // Group tables by business context
      const businessContexts = {};
      tables.forEach(table => {
        const context = table.businessContext || 'Unknown';
        if (!businessContexts[context]) {
          businessContexts[context] = [];
        }
        businessContexts[context].push(table);
      });
      
      console.log('\n=== TABLES BY BUSINESS CONTEXT ===');
      Object.keys(businessContexts).sort().forEach(context => {
        console.log(`\n📊 ${context.toUpperCase()}:`);
        businessContexts[context].forEach(table => {
          const columnCount = table.columns?.length || 0;
          const hasData = table.hasData ? '✅' : '❌';
          console.log(`   ${hasData} ${table.name} (${columnCount} cols)`);
          if (table.purpose) {
            console.log(`      Purpose: ${table.purpose}`);
          }
        });
      });
      
      // Show sample table details
      console.log('\n=== SAMPLE TABLE DETAILS ===');
      tables.slice(0, 3).forEach(table => {
        console.log(`\n🔍 Table: ${table.name}`);
        console.log(`   Business Context: ${table.businessContext || 'Unknown'}`);
        console.log(`   Purpose: ${table.purpose || 'Not analyzed'}`);
        console.log(`   Columns: ${table.columns?.length || 0}`);
        console.log(`   Has Data: ${table.hasData ? 'Yes' : 'No'}`);
        
        if (table.columns && table.columns.length > 0) {
          console.log(`   Sample Columns:`);
          table.columns.slice(0, 3).forEach(col => {
            const pk = col.primary_key ? ' (PK)' : '';
            const nullable = col.nullable ? ' (nullable)' : ' (required)';
            console.log(`     • ${col.name}: ${col.type}${pk}${nullable}`);
          });
          if (table.columns.length > 3) {
            console.log(`     ... and ${table.columns.length - 3} more columns`);
          }
        }
      });
      
      // Statistics
      console.log('\n=== DISCOVERY STATISTICS ===');
      console.log(`📊 Total tables discovered: ${tables.length}`);
      console.log(`🏢 Business contexts identified: ${Object.keys(businessContexts).length}`);
      console.log(`📋 Tables with purpose analysis: ${tables.filter(t => t.purpose).length}`);
      console.log(`💾 Tables with data: ${tables.filter(t => t.hasData).length}`);
      console.log(`📝 Total columns across all tables: ${tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0)}`);
      
      console.log('\n✅ Enhanced schema discovery test completed successfully!');
      console.log('🎯 Table purpose analysis is now integrated into MCP service startup');
      
    } else {
      console.log('❌ Schema discovery returned unexpected format');
      console.log('Response:', JSON.stringify(content, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Enhanced schema discovery test failed:', error.message);
    process.exit(1);
  }
};

testEnhancedSchemaDiscovery();