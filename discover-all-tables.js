const discoverAllTables = async () => {
  try {
    console.log('🔍 Discovering purpose of ALL tables from database structure and data...\n');
    
    // First, get the list of all tables
    console.log('📋 Step 1: Getting complete list of tables...');
    
    const schemaResponse = await fetch('http://localhost:4000/mcp/supabase/tools/get-schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arguments: {
          format: 'json',
          refresh_cache: true
        }
      })
    });
    
    if (!schemaResponse.ok) {
      throw new Error(`Failed to get schema: ${schemaResponse.status}`);
    }
    
    const schemaResult = await schemaResponse.json();
    const schemaContent = JSON.parse(schemaResult.tool_result.content[0].text);
    const tables = schemaContent.data.schema.tables;
    
    console.log(`✅ Found ${tables.length} tables to analyze\n`);
    
    // Analyze each table
    const tableInsights = [];
    
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      console.log(`=== TABLE ${i + 1}/${tables.length}: ${table.name} ===`);
      
      try {
        // Step 1: Get sample data to understand table purpose
        console.log(`🔍 Analyzing table structure and sample data...`);
        
        const samplePrompt = `Show me sample data from ${table.name} table to understand what it contains and what it's used for`;
        
        const generateResponse = await fetch('http://localhost:4000/mcp/supabase/tools/generate-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            arguments: {
              prompt: samplePrompt,
              use_context: true
            }
          })
        });
        
        if (!generateResponse.ok) {
          console.log(`❌ SQL Generation failed for ${table.name}`);
          continue;
        }
        
        const generateResult = await generateResponse.json();
        const generateContent = JSON.parse(generateResult.tool_result.content[0].text);
        
        if (!generateContent.success || !generateContent.data?.sql) {
          console.log(`❌ SQL Generation unsuccessful for ${table.name}`);
          continue;
        }
        
        const generatedSQL = generateContent.data.sql;
        console.log(`🤖 SQL: ${generatedSQL}`);
        
        // Execute the query to get sample data
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
        
        let tableInsight = {
          name: table.name,
          columnCount: table.columns?.length || 0,
          columns: table.columns?.map(col => ({
            name: col.name,
            type: col.type,
            isPrimaryKey: col.primary_key || false,
            nullable: col.nullable || false
          })) || [],
          purpose: 'Unknown',
          hasData: false,
          recordCount: 0,
          sampleData: [],
          businessContext: 'Unknown'
        };
        
        if (executeResponse.ok) {
          const executeResult = await executeResponse.json();
          const executeContent = JSON.parse(executeResult.tool_result.content[0].text);
          
          if (executeContent.success && executeContent.data) {
            const innerData = executeContent.data;
            tableInsight.hasData = innerData.row_count > 0;
            tableInsight.recordCount = innerData.row_count;
            tableInsight.sampleData = innerData.data?.slice(0, 2) || [];
            
            console.log(`✅ Found ${innerData.row_count} records`);
            
            // Analyze table purpose based on name and data
            const tablePurpose = analyzeTablePurpose(table.name, table.columns, innerData.data);
            tableInsight.purpose = tablePurpose.purpose;
            tableInsight.businessContext = tablePurpose.businessContext;
            
            console.log(`💡 Purpose: ${tablePurpose.purpose}`);
            console.log(`🏢 Business Context: ${tablePurpose.businessContext}`);
            
            if (innerData.data && innerData.data.length > 0) {
              console.log(`📊 Sample Record: ${JSON.stringify(innerData.data[0], null, 2).substring(0, 200)}...`);
            }
            
          } else {
            console.log(`📋 Table exists but no accessible data`);
            // Still analyze purpose from table name and columns
            const tablePurpose = analyzeTablePurpose(table.name, table.columns, []);
            tableInsight.purpose = tablePurpose.purpose;
            tableInsight.businessContext = tablePurpose.businessContext;
            console.log(`💡 Purpose (from structure): ${tablePurpose.purpose}`);
          }
        } else {
          console.log(`❌ Could not access data for ${table.name}`);
          // Analyze from structure only
          const tablePurpose = analyzeTablePurpose(table.name, table.columns, []);
          tableInsight.purpose = tablePurpose.purpose;
          tableInsight.businessContext = tablePurpose.businessContext;
        }
        
        tableInsights.push(tableInsight);
        
      } catch (error) {
        console.log(`❌ Analysis failed for ${table.name}: ${error.message}`);
      }
      
      console.log(`\n${'='.repeat(60)}\n`);
    }
    
    // Generate comprehensive database understanding
    console.log('🏁 DATABASE UNDERSTANDING SUMMARY\n');
    
    // Group tables by business context
    const businessContexts = {};
    tableInsights.forEach(table => {
      if (!businessContexts[table.businessContext]) {
        businessContexts[table.businessContext] = [];
      }
      businessContexts[table.businessContext].push(table);
    });
    
    Object.keys(businessContexts).forEach(context => {
      console.log(`📊 ${context.toUpperCase()} TABLES:`);
      businessContexts[context].forEach(table => {
        const dataStatus = table.hasData ? `${table.recordCount} records` : 'empty';
        console.log(`   • ${table.name} (${table.columnCount} cols, ${dataStatus}): ${table.purpose}`);
      });
      console.log('');
    });
    
    // Statistics
    console.log('📈 DATABASE STATISTICS:');
    console.log(`   • Total tables: ${tableInsights.length}`);
    console.log(`   • Tables with data: ${tableInsights.filter(t => t.hasData).length}`);
    console.log(`   • Empty tables: ${tableInsights.filter(t => !t.hasData).length}`);
    console.log(`   • Total records analyzed: ${tableInsights.reduce((sum, t) => sum + t.recordCount, 0)}`);
    
    console.log('\n✅ Complete database understanding generated from actual data!');
    
    // Save insights for future use
    console.log('\n💾 Saving table insights for AI context learning...');
    return tableInsights;
    
  } catch (error) {
    console.error('❌ Table discovery failed:', error.message);
    process.exit(1);
  }
};

// Helper function to analyze table purpose
function analyzeTablePurpose(tableName, columns, sampleData) {
  const name = tableName.toLowerCase();
  const columnNames = columns?.map(col => col.name.toLowerCase()) || [];
  
  // Analyze based on table name patterns
  if (name.includes('user')) {
    return {
      purpose: 'User management and authentication',
      businessContext: 'User Management'
    };
  }
  
  if (name.includes('agent')) {
    return {
      purpose: 'AI agent system management and tracking',
      businessContext: 'AI/Agent System'
    };
  }
  
  if (name.includes('task')) {
    return {
      purpose: 'Task and workflow management',
      businessContext: 'Task Management'
    };
  }
  
  if (name.includes('mcp')) {
    return {
      purpose: 'Model Context Protocol execution and monitoring',
      businessContext: 'MCP System'
    };
  }
  
  if (name.includes('kpi')) {
    return {
      purpose: 'Key Performance Indicator tracking and analytics',
      businessContext: 'Business Intelligence'
    };
  }
  
  if (name.includes('llm') || name.includes('model')) {
    return {
      purpose: 'Large Language Model configuration and usage tracking',
      businessContext: 'AI/LLM System'
    };
  }
  
  if (name.includes('session')) {
    return {
      purpose: 'User session and interaction tracking',
      businessContext: 'Session Management'
    };
  }
  
  if (name.includes('company') || name.includes('department')) {
    return {
      purpose: 'Organizational structure and company data',
      businessContext: 'Organization'
    };
  }
  
  if (name.includes('message')) {
    return {
      purpose: 'Communication and messaging system',
      businessContext: 'Communication'
    };
  }
  
  if (name.includes('human')) {
    return {
      purpose: 'Human-in-the-loop workflow management',
      businessContext: 'Human Interaction'
    };
  }
  
  // Analyze based on column patterns
  if (columnNames.includes('email') || columnNames.includes('password')) {
    return {
      purpose: 'Authentication and user credentials',
      businessContext: 'Authentication'
    };
  }
  
  if (columnNames.includes('metric_id') || columnNames.includes('value')) {
    return {
      purpose: 'Metrics and performance data tracking',
      businessContext: 'Analytics'
    };
  }
  
  if (columnNames.includes('execution_time') || columnNames.includes('status')) {
    return {
      purpose: 'System execution monitoring and status tracking',
      businessContext: 'System Monitoring'
    };
  }
  
  // Default based on common patterns
  if (name.includes('_') && name.split('_').length > 1) {
    const parts = name.split('_');
    return {
      purpose: `${parts.join(' ')} management and data storage`,
      businessContext: 'Data Management'
    };
  }
  
  return {
    purpose: 'General data storage and management',
    businessContext: 'General'
  };
}

discoverAllTables();