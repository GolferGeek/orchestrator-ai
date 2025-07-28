import { AgentFunctionParams, AgentFunctionResponse } from '@agents/base/implementations/base-services/a2a-base/interfaces';

/**
 * Metrics Agent Function - LangGraph-based implementation with MCP database tools
 * 
 * This agent provides comprehensive business metrics analysis, KPI tracking, and data-driven insights
 * using direct database access through MCP (Model Context Protocol) tools.
 * 
 * Key capabilities:
 * - Real-time KPI analysis from database
 * - Performance tracking and trend analysis  
 * - Dashboard creation and reporting
 * - Data visualization and insights
 */
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, llmService, progressCallback, mcpService, metadata } = params;
  
  console.log('🎯 METRICS AGENT DEBUG: Starting execution');
  console.log('📝 User message:', userMessage);
  console.log('🔧 MCP Service available:', !!mcpService);
  console.log('🔧 LLM Service available:', !!llmService);
  console.log('📊 Metadata:', JSON.stringify(metadata, null, 2));
  
  // MCP Client Service is required for this agent - direct access to Supabase tools
  if (!mcpService) {
    console.log('❌ MCP Service is null/undefined');
    progressCallback?.('MCP Client Service', 0, 'failed', `MCP Client service unavailable - Supabase connection not available`);
    throw new Error('MCP Client service is required for Metrics Agent. Supabase database access not available.');
  }
  
  console.log('✅ MCP Service is available, proceeding with database operations');

  try {
    // Step 1: Get focused KPI schema using MCP Client service (only relevant tables to reduce token usage)
    progressCallback?.('Database connection', 0, 'in_progress', 'Connecting to Supabase via MCP Client...');
    
    // Use MCP Client service directly for schema access - get all tables 
    console.log('🔄 Calling MCP Client for schema...');
    console.log('📡 MCP call: supabase-mcp -> get-schema');
    
    const schemaResult = await mcpService.callTool('supabase-mcp', 'get-schema', {
      format: 'json',
      refresh_cache: false
    });
    
    console.log('📊 Schema result structure:', {
      success: schemaResult.success,
      hasData: !!schemaResult.data,
      dataSuccess: schemaResult.data?.success,
      error: schemaResult.error,
      dataError: schemaResult.data?.error
    });
    console.log('📊 Full schema result (first 500 chars):', JSON.stringify(schemaResult, null, 2).substring(0, 500) + '...');
    
    // Debug the exact structure we're checking
    console.log('🔍 DEBUG: schemaResult.success =', schemaResult.success);
    console.log('🔍 DEBUG: schemaResult.data =', !!schemaResult.data);
    console.log('🔍 DEBUG: schemaResult.data?.success =', schemaResult.data?.success);
    console.log('🔍 DEBUG: schemaResult.error =', schemaResult.error);
    console.log('🔍 DEBUG: schemaResult.data?.error =', schemaResult.data?.error);
    
    if (!schemaResult.success) {
      const error = schemaResult.error || schemaResult.data?.error || 'Unknown error';
      console.log('❌ Schema call failed:', error);
      progressCallback?.('Database connection', 0, 'failed', `Failed to connect to database: ${error}`);
      throw new Error(`Failed to get database schema: ${error}`);
    }
    
    console.log('✅ Schema retrieved successfully');
    
    // Step 1.5: VALIDATE that KPI tables are available in schema
    console.log('🔍 VALIDATING: Checking for required KPI tables in schema...');
    const requiredTables = ['kpi_data', 'kpi_goals', 'kpi_metrics', 'departments', 'companies'];
    
    console.log('🔍 DEBUG: schemaResult.data structure:');
    console.log('🔍 DEBUG: typeof schemaResult.data =', typeof schemaResult.data);
    console.log('🔍 DEBUG: schemaResult.data keys =', schemaResult.data ? Object.keys(schemaResult.data) : 'null');
    
    // Handle the MCP Client response format: schemaResult.data.tool_result.content[0].text
    let schemaData = null;
    
    if (schemaResult.data?.tool_result?.content?.[0]?.text) {
      console.log('🔍 DEBUG: Found tool_result.content[0].text format');
      try {
        schemaData = JSON.parse(schemaResult.data.tool_result.content[0].text);
      } catch (e) {
        console.log('⚠️ Could not parse tool_result text:', e);
      }
    } else if (schemaResult.data?.data) {
      console.log('🔍 DEBUG: Found data.data format');
      schemaData = schemaResult.data.data;
    } else if (schemaResult.data) {
      console.log('🔍 DEBUG: Using direct data format');
      schemaData = schemaResult.data;
    }
    
    console.log('🔍 DEBUG: schemaData type =', typeof schemaData);
    console.log('🔍 DEBUG: schemaData keys =', schemaData ? Object.keys(schemaData) : 'null');
    
    // Extract table names from schema (handle different response formats)
    let availableTables = [];
    if (schemaData && typeof schemaData === 'object') {
      if (schemaData.schema && schemaData.schema.tables) {
        availableTables = schemaData.schema.tables.map((t: any) => t.name);
      } else if (schemaData.data && schemaData.data.schema && schemaData.data.schema.tables) {
        availableTables = schemaData.data.schema.tables.map((t: any) => t.name);
      } else if (Array.isArray(schemaData.tables)) {
        availableTables = schemaData.tables.map((t: any) => t.name);
      }
    }
    
    console.log('📋 Available tables in schema:', availableTables.length);
    console.log('📋 Required KPI tables:', requiredTables);
    
    const missingTables = requiredTables.filter(table => !availableTables.includes(table));
    if (missingTables.length > 0) {
      console.log('❌ MISSING TABLES:', missingTables);
      throw new Error(`Missing required KPI tables: ${missingTables.join(', ')}`);
    }
    
    console.log('✅ All required KPI tables found in schema');
    
    progressCallback?.('Database schema', 0, 'completed', `Connected successfully - validated ${requiredTables.length} KPI tables`);

    // Step 2: Analyze user request and identify relevant metrics
    progressCallback?.('Analyzing request', 1, 'in_progress', 'Understanding metrics requirements...');
    
    const analysisPrompt = `
User request: "${userMessage}"

Available KPI tables: kpi_data, kpi_goals, kpi_metrics, departments, companies

Respond with JSON only:
{
  "intent": "brief description of what the user wants",
  "metrics_needed": ["specific", "metrics", "to", "analyze"],
  "tables_to_query": ["tables", "needed", "from", "the", "5", "available"],
  "sql_approach": "brief description of what SQL queries are needed"
}
`;

    const analysisResponse = await llmService.generateResponse(
      'You are a business intelligence analyst. Analyze user requests for metrics and determine the best approach.',
      analysisPrompt,
      { 
        temperature: 0.1,
        provider: metadata?.providerId,
        modelId: metadata?.modelId,
        maxTokens: 1000
      }
    );

    let analysis;
    try {
      const responseText = typeof analysisResponse === 'string' ? analysisResponse : (analysisResponse.response || JSON.stringify(analysisResponse));
      analysis = JSON.parse(responseText);
      progressCallback?.('Request analysis', 1, 'completed', `${analysis.intent}`);
    } catch (e) {
      console.log('❌ Failed to parse analysis response:', e);
      progressCallback?.('Request analysis', 1, 'failed', 'Failed to understand user request');
      throw new Error('Failed to analyze user request. Please rephrase your question.');
    }

    // Step 2.5: VALIDATE SQL generation and execution
    console.log('🔍 VALIDATING: Testing SQL generation...');
    progressCallback?.('SQL validation', 2, 'in_progress', 'Testing SQL generation and execution...');
    
    const testSQLGeneration = await mcpService.callTool('supabase-mcp', 'generate-sql', {
      prompt: 'Show me the count of KPI metrics',
      query_type: 'SELECT',
      include_explanation: true,
      schema_tables: ['kpi_metrics']
    });
    
    console.log('📊 SQL Generation result:', {
      success: testSQLGeneration.success,
      hasData: !!testSQLGeneration.data,
      error: testSQLGeneration.error
    });
    
    if (testSQLGeneration.success && testSQLGeneration.data) {
      const sqlData = testSQLGeneration.data.data?.data || testSQLGeneration.data.data;
      console.log('✅ SQL Generation working - generated query for KPI metrics count');
      console.log('📄 Generated SQL sample:', sqlData ? JSON.stringify(sqlData).substring(0, 200) + '...' : 'No SQL data');
      
      // Test SQL execution
      console.log('🔍 VALIDATING: Testing SQL execution...');
      const testSQLExecution = await mcpService.callTool('supabase-mcp', 'execute-sql', {
        sql: 'SELECT COUNT(*) as total_metrics FROM kpi_metrics',
        format: 'json',
        max_rows: 1
      });
      
      console.log('📊 SQL Execution result:', {
        success: testSQLExecution.success,
        hasData: !!testSQLExecution.data,
        error: testSQLExecution.error
      });
      
      if (testSQLExecution.success && testSQLExecution.data) {
        const execData = testSQLExecution.data.data?.data || testSQLExecution.data.data;
        console.log('✅ SQL Execution working - got results from kpi_metrics table');
        console.log('📄 Execution result:', execData);
        progressCallback?.('SQL validation', 2, 'completed', 'SQL generation and execution validated');
      } else {
        const error = testSQLExecution.error || testSQLExecution.data?.error || 'Unknown execution error';
        console.log('❌ SQL Execution failed:', error);
        progressCallback?.('SQL validation', 2, 'failed', `SQL execution failed: ${error}`);
      }
    } else {
      const error = testSQLGeneration.error || testSQLGeneration.data?.error || 'Unknown generation error';
      console.log('❌ SQL Generation failed:', error);
      progressCallback?.('SQL validation', 2, 'failed', `SQL generation failed: ${error}`);
    }

    // Step 3: Execute user-specific SQL queries based on their request
    progressCallback?.('Data retrieval', 3, 'in_progress', `Executing queries for: ${analysis.intent}`);

    // Generate SQL for the user's specific question
    console.log('🔍 Generating SQL for user question...');
    const sqlGenResult = await mcpService.callTool('supabase-mcp', 'generate-sql', {
      prompt: userMessage,
      query_type: 'SELECT',
      include_explanation: true,
      schema_tables: analysis.tables_to_query
    });

    let userQueryResult = null;
    if (sqlGenResult.success && sqlGenResult.data) {
      try {
        // Extract the generated SQL - MCPClientService format
        let generatedSQL = '';
        
        // MCPClientService already parses the JSON from tool_result.content[0].text
        if (sqlGenResult.data && typeof sqlGenResult.data === 'object') {
          // Direct access to parsed data
          generatedSQL = sqlGenResult.data.sql || sqlGenResult.data.query || '';
        }
        // Fallback for legacy format
        else if (sqlGenResult.data?.tool_result?.content?.[0]?.text) {
          try {
            const parsed = JSON.parse(sqlGenResult.data.tool_result.content[0].text);
            generatedSQL = parsed.sql || parsed.query || '';
          } catch (e) {
            console.log('⚠️ Could not parse legacy SQL response');
          }
        }
        
        console.log('📄 Generated SQL:', generatedSQL);
        progressCallback?.('SQL Generation', 2.5, 'completed', `SQL Generated: ${generatedSQL}`);
        
        if (generatedSQL) {
          // Execute the user's specific SQL query
          console.log('🔍 Executing user-specific SQL...');
          progressCallback?.('SQL Execution', 2.7, 'in_progress', `Executing SQL query...`);
          
          userQueryResult = await mcpService.callTool('supabase-mcp', 'execute-sql', {
            sql: generatedSQL,
            format: 'json',
            max_rows: 100
          });
          
          console.log('📊 User query result:', userQueryResult.success ? 'SUCCESS' : 'FAILED');
          progressCallback?.('SQL Execution', 2.7, userQueryResult.success ? 'completed' : 'failed', 
            userQueryResult.success ? 'SQL executed successfully' : `SQL execution failed: ${userQueryResult.error || 'Unknown error'}`);
        } else {
          progressCallback?.('SQL Generation', 2.5, 'failed', 'No SQL was generated from the user query');
        }
      } catch (e) {
        console.log('⚠️ Failed to execute generated SQL:', e);
      }
    }

    // Get supporting KPI context data (smaller sample for context)
    const metricsResult = await mcpService.callTool('supabase-mcp', 'read-data', {
      table_name: 'kpi_metrics',
      limit: 5
    });
    
    console.log('🔍 DEBUG: metricsResult FULL structure:', JSON.stringify(metricsResult, null, 2));
    
    if (metricsResult.success && metricsResult.data) {
      // Debug the actual data structure to find where the records are
      console.log('🔍 DEBUG: metricsResult.data keys:', Object.keys(metricsResult.data));
      
      // Try all possible paths to find the actual data
      let metricsData = [];
      let dataPath = 'unknown';
      
      if (metricsResult.data.tool_result?.content?.[0]?.text) {
        console.log('🔍 DEBUG: Found tool_result.content[0].text format');
        try {
          const parsed = JSON.parse(metricsResult.data.tool_result.content[0].text);
          console.log('🔍 DEBUG: parsed tool_result FULL:', JSON.stringify(parsed, null, 2));
          
          // Try different paths in the parsed result - check nested data.data first
          if (parsed.data && parsed.data.data && Array.isArray(parsed.data.data)) {
            metricsData = parsed.data.data;
            dataPath = 'tool_result.content[0].text.data.data';
          } else if (Array.isArray(parsed)) {
            metricsData = parsed;
            dataPath = 'tool_result.content[0].text (direct array)';
          } else if (parsed.data && Array.isArray(parsed.data)) {
            metricsData = parsed.data;
            dataPath = 'tool_result.content[0].text.data';
          } else if (parsed.rows && Array.isArray(parsed.rows)) {
            metricsData = parsed.rows;
            dataPath = 'tool_result.content[0].text.rows';
          } else if (parsed.result && Array.isArray(parsed.result)) {
            metricsData = parsed.result;
            dataPath = 'tool_result.content[0].text.result';
          }
        } catch (e) {
          console.log('⚠️ Could not parse tool_result text:', e);
        }
      } else if (metricsResult.data.data) {
        console.log('🔍 DEBUG: Found data.data format:', JSON.stringify(metricsResult.data.data, null, 2));
        
        if (Array.isArray(metricsResult.data.data)) {
          metricsData = metricsResult.data.data;
          dataPath = 'data.data (direct array)';
        } else if (metricsResult.data.data.data && Array.isArray(metricsResult.data.data.data)) {
          metricsData = metricsResult.data.data.data;
          dataPath = 'data.data.data';
        } else if (metricsResult.data.data.rows && Array.isArray(metricsResult.data.data.rows)) {
          metricsData = metricsResult.data.data.rows;
          dataPath = 'data.data.rows';
        }
      } else if (Array.isArray(metricsResult.data)) {
        metricsData = metricsResult.data;
        dataPath = 'data (direct array)';
      }
      
      console.log('📍 DATA FOUND AT PATH:', dataPath);
      console.log('📄 ACTUAL METRICS DATA LENGTH:', metricsData.length);
      console.log('📄 FIRST RECORD SAMPLE:', metricsData.length > 0 ? JSON.stringify(metricsData[0]) : 'No records');
      
      progressCallback?.('Metrics definitions', 2, 'completed', `Retrieved ${metricsData.length} metric definitions from ${dataPath}`);
    } else {
      const error = metricsResult.error || metricsResult.data?.error || 'Unknown error';
      console.log('❌ metricsResult failed:', {
        success: metricsResult.success,
        hasData: !!metricsResult.data,
        error: error
      });
      progressCallback?.('Metrics definitions', 2, 'failed', `Failed to retrieve metrics: ${error}`);
    }

    // Get recent KPI data summary using MCP Client (very focused to save tokens)
    progressCallback?.('KPI data query', 3, 'in_progress', 'Getting recent KPI summary via MCP Client...');
    
    const kpiDataResult = await mcpService.callTool('supabase-mcp', 'read-data', {
      table_name: 'kpi_data',
      limit: 5
    });
    
    if (kpiDataResult.success && kpiDataResult.data) {
      // Handle MCP Client wrapper: result.data contains the actual MCP server response
      const kpiData = Array.isArray(kpiDataResult.data.data?.data) ? kpiDataResult.data.data.data : [];
      const dataCount = kpiData.length;
      progressCallback?.('KPI data', 3, 'completed', `Retrieved ${dataCount} recent KPI data points`);
    } else {
      const error = kpiDataResult.error || kpiDataResult.data?.error || 'Unknown error';
      progressCallback?.('KPI data', 3, 'failed', `Query execution failed: ${error}`);
    }

    // Get limited KPI goals using MCP Client (small sample to save tokens)
    progressCallback?.('Goals retrieval', 4, 'in_progress', 'Getting KPI goals sample via MCP Client...');
    
    const goalsResult = await mcpService.callTool('supabase-mcp', 'read-data', {
      table_name: 'kpi_goals',
      limit: 5
    });
    
    if (goalsResult.success && goalsResult.data) {
      // Handle MCP Client wrapper: result.data contains the actual MCP server response
      const goalsData = Array.isArray(goalsResult.data.data?.data) ? goalsResult.data.data.data : [];
      const goalsCount = goalsData.length;
      progressCallback?.('Goals data', 4, 'completed', `Retrieved ${goalsCount} KPI goals and targets`);
    } else {
      const error = goalsResult.error || goalsResult.data?.error || 'Unknown error';
      progressCallback?.('Goals data', 4, 'failed', `Failed to retrieve goals: ${error}`);
    }

    // Step 4: Generate comprehensive metrics analysis
    progressCallback?.('Analysis generation', 5, 'in_progress', 'Generating insights from live database data...');

    // Extract actual data arrays from MCP Client responses using comprehensive data extraction
    function extractDataFromMCPResult(result: any, resultName: string): any[] {
      console.log(`🔍 EXTRACTING ${resultName} data...`);
      
      if (!result.success || !result.data) {
        console.log(`❌ ${resultName}: No successful result`);
        return [];
      }
      
      let extractedData = [];
      let dataPath = 'unknown';
      
      // DEBUG: Log the complete structure for USER_QUERY
      if (resultName === 'USER_QUERY') {
        console.log('🔍 COMPLETE USER_QUERY STRUCTURE:');
        console.log('result.success:', result.success);
        console.log('typeof result.data:', typeof result.data);
        console.log('Array.isArray(result.data):', Array.isArray(result.data));
        console.log('result.data keys:', result.data ? Object.keys(result.data) : 'null');
        console.log('First 200 chars of result.data:', JSON.stringify(result.data).substring(0, 200));
      }
      
      // PRIORITY 1: Check for USER_QUERY specific formats (execute-sql tool)
      if (resultName === 'USER_QUERY') {
        // Try multiple extraction paths for execute-sql results - Enhanced SQL Execute tool format
        if (Array.isArray(result.data)) {
          extractedData = result.data;
          dataPath = 'result.data (direct array)';
        } else if (result.data?.data && Array.isArray(result.data.data)) {
          extractedData = result.data.data;
          dataPath = 'result.data.data (wrapped array)';
        } else if (result.data?.data?.data && Array.isArray(result.data.data.data)) {
          extractedData = result.data.data.data;
          dataPath = 'result.data.data.data (double wrapped)';
        }
        // If USER_QUERY didn't find data, fall through to standard tool_result parsing
        if (extractedData.length === 0 && result.data.tool_result?.content?.[0]?.text) {
          try {
            const parsed = JSON.parse(result.data.tool_result.content[0].text);
            if (parsed.data && parsed.data.data && Array.isArray(parsed.data.data)) {
              extractedData = parsed.data.data;
              dataPath = 'USER_QUERY: tool_result.content[0].text.data.data';
            } else if (Array.isArray(parsed.data)) {
              extractedData = parsed.data;
              dataPath = 'USER_QUERY: tool_result.content[0].text.data';
            } else if (Array.isArray(parsed)) {
              extractedData = parsed;
              dataPath = 'USER_QUERY: tool_result.content[0].text (direct array)';
            }
          } catch (e) {
            console.log(`⚠️ ${resultName}: Could not parse tool_result text:`, e);
          }
        }
      }
      // PRIORITY 2: Check for standard tool_result format
      else if (result.data.tool_result?.content?.[0]?.text) {
        try {
          const parsed = JSON.parse(result.data.tool_result.content[0].text);
          if (parsed.data && parsed.data.data && Array.isArray(parsed.data.data)) {
            extractedData = parsed.data.data;
            dataPath = 'tool_result.content[0].text.data.data';
          } else if (Array.isArray(parsed)) {
            extractedData = parsed;
            dataPath = 'tool_result.content[0].text (direct array)';
          } else if (parsed.data && Array.isArray(parsed.data)) {
            extractedData = parsed.data;
            dataPath = 'tool_result.content[0].text.data';
          } else if (parsed.rows && Array.isArray(parsed.rows)) {
            extractedData = parsed.rows;
            dataPath = 'tool_result.content[0].text.rows';
          }
        } catch (e) {
          console.log(`⚠️ ${resultName}: Could not parse tool_result text`);
        }
      }
      // PRIORITY 3: Check for nested data formats
      else if (result.data.data) {
        if (Array.isArray(result.data.data)) {
          extractedData = result.data.data;
          dataPath = 'data.data (direct array)';
        } else if (result.data.data.data && Array.isArray(result.data.data.data)) {
          extractedData = result.data.data.data;
          dataPath = 'data.data.data';
        } else if (result.data.data.rows && Array.isArray(result.data.data.rows)) {
          extractedData = result.data.data.rows;
          dataPath = 'data.data.rows';
        }
      }
      // PRIORITY 4: Check for direct array format
      else if (Array.isArray(result.data)) {
        extractedData = result.data;
        dataPath = 'data (direct array)';
      }
      
      console.log(`✅ ${resultName}: Found ${extractedData.length} records at path: ${dataPath}`);
      return extractedData;
    }
    
    const metricsDefinitions = extractDataFromMCPResult(metricsResult, 'METRICS_DEFINITIONS');
    const currentKpiData = extractDataFromMCPResult(kpiDataResult, 'KPI_DATA');
    const goalsData = extractDataFromMCPResult(goalsResult, 'GOALS_DATA');

    // Create a VERY concise summary to avoid token limits - only include essential info
    const dataStats = {
      metrics_count: metricsDefinitions.length,
      kpi_records: currentKpiData.length,
      goals_count: goalsData.length,
      // Only include essential fields from sample data to minimize tokens
      sample_metrics: metricsDefinitions.slice(0, 2).map((m: any) => ({ 
        name: m.name, 
        type: m.metric_type || m.type,
        unit: m.unit
      })),
      recent_values: currentKpiData.slice(0, 2).map((d: any) => ({
        metric: d.metric_name || d.name,
        value: d.value,
        date: d.date || d.created_at
      })),
      sample_goals: goalsData.slice(0, 1).map((g: any) => ({
        metric: g.metric_name || g.name,
        target: g.target_value || g.target,
        period: g.period
      }))
    };

    // Extract actual query results if available
    let userQueryResults = null;
    let generatedSQLForReport = 'No SQL was generated';
    
    if (userQueryResult && userQueryResult.success && userQueryResult.data) {
      console.log('🔍 DEBUG: userQueryResult structure:', JSON.stringify(userQueryResult, null, 2));
      userQueryResults = extractDataFromMCPResult(userQueryResult, 'USER_QUERY');
      console.log('🔍 DEBUG: Extracted userQueryResults:', userQueryResults);
      console.log('🔍 DEBUG: userQueryResults length:', userQueryResults ? userQueryResults.length : 'null');
    } else {
      console.log('🔍 DEBUG: userQueryResult failed or missing:', {
        exists: !!userQueryResult,
        success: userQueryResult?.success,
        hasData: !!userQueryResult?.data,
        error: userQueryResult?.error
      });
    }
    
    // Extract the SQL that was generated for display - MCPClientService format
    try {
      if (sqlGenResult.success && sqlGenResult.data) {
        // MCPClientService already parses the JSON
        if (typeof sqlGenResult.data === 'object') {
          generatedSQLForReport = sqlGenResult.data.sql || sqlGenResult.data.query || 'No SQL found in response';
        }
        // Fallback for legacy format
        else if (sqlGenResult.data?.tool_result?.content?.[0]?.text) {
          const parsed = JSON.parse(sqlGenResult.data.tool_result.content[0].text);
          generatedSQLForReport = parsed.sql || parsed.query || 'No SQL found in response';
        }
      }
    } catch (e) {
      generatedSQLForReport = 'Failed to extract SQL from generation result';
    }

    const reportPrompt = `
You are a Business Metrics specialist. The user asked: "${userMessage}"

ALWAYS start your response with this exact format:

## Generated SQL Query
\`\`\`sql
${generatedSQLForReport}
\`\`\`

## Query Results
${userQueryResults ? `Found ${userQueryResults.length} results: ${JSON.stringify(userQueryResults, null, 2)}` : 'No results returned from the SQL execution'}

## Analysis
Based on your analysis: ${analysis.intent}
Tables queried: ${analysis.tables_to_query.join(', ')}

Now provide a direct answer to the user's question. If the SQL query returned results, state the exact answer. If it returned 0 results, explain why and what might need to be checked.

Answer the user's specific question directly.
`;

    const finalResponse = await llmService.generateResponse(
      `You are an expert Business Intelligence and Analytics specialist with deep expertise in KPI analysis, performance tracking, and data-driven insights. You communicate insights clearly through structured reports and actionable recommendations.`,
      reportPrompt,
      { 
        temperature: 0.3,
        provider: metadata?.providerId,
        modelId: metadata?.modelId,
        maxTokens: 4000
      }
    );

    // Final completion message with actual data counts
    const totalDataPoints = metricsDefinitions.length + currentKpiData.length + goalsData.length;
    progressCallback?.('Analysis complete', 6, 'completed', `Generated metrics analysis from ${totalDataPoints} data points (${metricsDefinitions.length} definitions, ${currentKpiData.length} records, ${goalsData.length} goals)`);

    return {
      success: true,
      response: typeof finalResponse === 'string' ? finalResponse : (finalResponse.response || JSON.stringify(finalResponse)),
      metadata: {
        agentName: 'Metrics Agent',
        processingTime: Date.now() - (metadata?.timestamp ? new Date(metadata.timestamp).getTime() : Date.now()),
        toolsUsed: ['MCP Client Service', 'Supabase MCP Server', 'KPI Analysis', 'Performance Tracking'],
        responseType: analysis.analysis_type || 'metrics_analysis',
        metricsAnalyzed: analysis.metrics_needed?.length || 0,
        tablesQueried: analysis.tables_to_query?.length || 0,
        dataPoints: totalDataPoints,
        mcpEnabled: true
      }
    };

  } catch (error) {
    console.error('Metrics Agent MCP Error:', error);
    
    // Report error in progress
    progressCallback?.('Analysis failed', 6, 'failed', `Database operation failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // No fallback - MCP connection is required
    return {
      success: false,
      response: `Failed to connect to database for metrics analysis: ${error instanceof Error ? error.message : String(error)}`,
      metadata: {
        agentName: 'Metrics Agent',
        processingTime: Date.now() - (metadata?.timestamp ? new Date(metadata.timestamp).getTime() : Date.now()),
        toolsUsed: ['MCP Client Service (Failed)', 'Supabase MCP Server (Failed)'],
        responseType: 'error',
        mcpEnabled: false,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}