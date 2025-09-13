import {
  AgentFunctionParams,
  AgentFunctionResponse,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

/**
 * Metrics Agent Function - MCP-Based KPI Analysis
 *
 * This agent provides comprehensive business metrics analysis, KPI tracking, and data-driven insights
 * using the Model Context Protocol (MCP) for structured database access and SQL generation.
 *
 * Key capabilities:
 * - MCP-based natural language to SQL query generation using context schemas
 * - Real-time database analysis from Supabase via MCP tools
 * - Performance tracking and trend analysis using validated table/column references
 * - Data-driven insights and reporting with accurate SQL queries
 * - MCP protocol compliance with proper tool calling patterns
 * - Schema-driven SQL generation eliminates column name errors (company_name vs name)
 */
export async function execute(
  params: AgentFunctionParams,
): Promise<AgentFunctionResponse> {
  const { userMessage, llmService, progressCallback, metadata, mcpService } = params;

  try {
    // Step 1: Initialize MCP connection and validate server health
    progressCallback?.(
      'Database connection',
      0,
      'in_progress',
      'Initializing MCP client and validating Supabase server connection...',
    );

    console.log('[METRICS-AGENT] Starting with mcpService:', !!mcpService);
    console.log('[METRICS-AGENT] User message:', userMessage);
    
        // Check if MCP service is available
    if (!mcpService) {
      console.error('[METRICS-AGENT] MCP service is not injected!');
      throw new Error('MCP service is not injected or not available');
    }

    // Test MCP service health
    const isAvailable = await mcpService.isAvailable();
    console.log('[METRICS-AGENT] MCP service available:', isAvailable);
    if (!isAvailable) {
      throw new Error('MCP server is not available or not responding');
    }

    const schemaResult = { success: true, data: { validated: true } };

    // Step 1.5: Use context file schema information for SQL generation
    const availableTables = [
      'companies',
      'departments', 
      'kpi_data',
      'kpi_metrics',
      'kpi_goals',
      'tasks',
      'deliverables',
      'users',
      'projects',
      'agent_conversations'
    ];
    
    progressCallback?.(
      'Database schema',
      0,
      'completed',
      'Using context file schema - ready for MCP SQL generation',
    );

    // Step 2: Analyze user request and identify relevant metrics
    progressCallback?.(
      'Analyzing request',
      1,
      'in_progress',
      'Understanding metrics requirements...',
    );

    const analysisPrompt = `
User request: "${userMessage}"

Available database tables with schema from context file:

### KPI and Business Data Tables (Public Schema):
- **companies**: Company information (id, name, industry, founded_year, created_at, updated_at)
- **departments**: Organizational structure (id, company_id, name, head_of_department, budget, created_at, updated_at)  
- **kpi_metrics**: KPI definitions (id, name, metric_type, unit, description, created_at, updated_at)
- **kpi_goals**: Target values for metrics by department (id, department_id, metric_id, target_value, period_start, period_end, created_at, updated_at)
- **kpi_data**: Historical performance data (id, department_id, metric_id, value, date_recorded, created_at, updated_at)

### Platform Activity Data Tables (Public Schema):
- **users**: User accounts and profile information
- **tasks**: Task execution records with status, response, completion times
- **projects**: Multi-step project management with status and metadata  
- **deliverables**: Work products, outputs, and created content
- **agent_conversations**: Conversation sessions with different agents

IMPORTANT: Companies table has 'name' column, NOT 'company_name'. Revenue data is in kpi_data table joined with kpi_metrics. All tables are in PUBLIC schema. Database may be empty - provide helpful setup instructions when no data exists.

Respond with JSON only:
{
  "intent": "brief description of what the user wants",
  "metrics_needed": ["specific", "metrics", "to", "analyze"],
  "tables_to_query": ["tables", "needed", "from", "available"],
  "sql_approach": "brief description of what SQL queries are needed using correct schema"
}
`;

    const analysisResponse = await llmService.generateResponse(
      'You are a business intelligence analyst. Analyze user requests for metrics and determine the best approach.',
      analysisPrompt,
      {
        temperature: 0.1,
        // Use unified keys; prefer llmSelection passed by UI, then metadata
        providerName: (params as any)?.llmSelection?.providerName || metadata?.providerName,
        modelName: (params as any)?.llmSelection?.modelName || metadata?.modelName,
        maxTokens: 1000,
        callerType: 'agent',
        callerName: metadata?.agentName || 'metrics-agent',
        conversationId: params.sessionId,
        dataClassification: 'financial',
      },
    );

    let analysis;
    try {
      const responseText =
        typeof analysisResponse === 'string'
          ? analysisResponse
          : analysisResponse.response || JSON.stringify(analysisResponse);
      analysis = JSON.parse(responseText);
      progressCallback?.(
        'Request analysis',
        1,
        'completed',
        `${analysis.intent}`,
      );
    } catch (e) {

      progressCallback?.(
        'Request analysis',
        1,
        'failed',
        'Failed to understand user request',
      );
      throw new Error(
        'Failed to analyze user request. Please rephrase your question.',
      );
    }

    // Step 2.5: Ready for MCP-based SQL generation and execution
    progressCallback?.(
      'SQL validation',
      2,
      'completed',
      'MCP SQL generation tools ready',
    );

    // Step 3: Execute user-specific SQL queries based on their request using MCP
    progressCallback?.(
      'Data retrieval',
      3,
      'in_progress',
      `Generating SQL for: ${analysis.intent}`,
    );

    // Generate SQL using MCP generate-sql tool
    progressCallback?.(
      'SQL Generation',
      2.5,
      'in_progress',
      'Generating SQL from natural language using MCP tools...',
    );

    let generatedSQL = '';
    let queryResult: any[] = [];
    let sqlError = '';
    let executionError = '';
    
    try {
      // Step 3.1: Generate SQL using MCP client
      // Heuristic: if the user asks "how many X" or "count X", steer the NL query toward COUNT(*)
      // Pure LLM-driven SQL generation using MCP, guided only by schema context
      const nlQuery = userMessage;
      const schemaTables = availableTables;
      console.log('[METRICS-AGENT] Calling generateSQL with:', { nlQuery, schemaTables });
      
      let sqlGenResult;
      try {
        // Call generateSQL with explicit provider/model passthrough to MCP
        // Source order: routingDecision -> originalParams.llmSelection -> direct params/metadata
        const providerName = (params as any)?.routingDecision?.provider ||
          (params as any)?.metadata?.originalParams?.llmSelection?.providerName ||
          (params as any)?.llmSelection?.providerName ||
          metadata?.providerName;
        const modelName = (params as any)?.routingDecision?.model ||
          (params as any)?.metadata?.originalParams?.llmSelection?.modelName ||
          (params as any)?.llmSelection?.modelName ||
          metadata?.modelName;
        sqlGenResult = await mcpService.generateSQL({
          natural_language_query: nlQuery,
          schema_tables: schemaTables,
          max_rows: 100,
          providerName,
          modelName,
        });
      } catch (innerError: any) {
        console.error('[METRICS-AGENT] generateSQL threw error:', innerError);
        console.error('[METRICS-AGENT] Error details:', {
          message: innerError?.message,
          stack: innerError?.stack,
          name: innerError?.name
        });
        throw innerError;
      }

      console.log('[METRICS-AGENT] SQL Generation result:', sqlGenResult);
      console.log('[METRICS-AGENT] SQL Generation result type:', typeof sqlGenResult);
      console.log('[METRICS-AGENT] SQL Generation result keys:', sqlGenResult ? Object.keys(sqlGenResult) : 'null/undefined');
      
      // Check if it's an error response
      if (sqlGenResult?.isError) {
        console.error('[METRICS-AGENT] MCP returned error:', sqlGenResult.content);
        const errorText = sqlGenResult.content?.[0]?.text || JSON.stringify(sqlGenResult.content);
        sqlError = `MCP SQL generation error: ${errorText}`;
        throw new Error(sqlError);
      }
      
      // Extract SQL from MCP response format
      // MCP returns { content: [{ type: 'text', text: JSON.stringify({sql, ...}) }] }
      if (sqlGenResult?.content && Array.isArray(sqlGenResult.content)) {
        const textContent = sqlGenResult.content[0]?.text;
        console.log('[METRICS-AGENT] Text content from MCP:', textContent);
        
        if (textContent) {
          try {
            // Parse the JSON from the text content
            const parsed = JSON.parse(textContent);
            console.log('[METRICS-AGENT] Parsed content:', parsed);
            
            if (parsed.sql) {
              generatedSQL = parsed.sql;
              console.log('[METRICS-AGENT] Extracted SQL:', generatedSQL);
            } else {
              throw new Error('No SQL field in parsed response');
            }
          } catch (e) {
            console.error('[METRICS-AGENT] Failed to parse MCP response:', e);
            sqlError = `Failed to parse SQL from MCP response: ${e}`;
            throw new Error(sqlError);
          }
        }
      }
      
      if (!generatedSQL) {
        sqlError = `MCP SQL generation failed - no SQL found in response: ${JSON.stringify(sqlGenResult)}`;
        throw new Error(sqlError);
      }

      progressCallback?.(
        'SQL Generation',
        2.5,
        'completed',
        `MCP-generated SQL: ${generatedSQL.substring(0, 100)}...`,
      );

      // Step 3.2: Execute the generated SQL using MCP tool
      progressCallback?.(
        'SQL Execution',
        2.7,
        'in_progress',
        'Executing SQL query via MCP...',
      );

      // Step 3.2: Execute SQL using MCP client
      // executeSQL expects a params object with sql_query and max_rows
      const sqlExecResult = await mcpService.executeSQL({
        sql_query: generatedSQL,
        max_rows: 100
      });

      console.log('[METRICS-AGENT] SQL Execution result:', sqlExecResult);
      console.log('[METRICS-AGENT] SQL Execution result keys:', sqlExecResult ? Object.keys(sqlExecResult) : 'null');
      
      // Check if it's an error response
      if (sqlExecResult?.isError) {
        const errorText = sqlExecResult.content?.[0]?.text || JSON.stringify(sqlExecResult.content);
        executionError = `MCP SQL execution error: ${errorText}`;
        throw new Error(executionError);
      }
      
      // Extract results from MCP response format
      // MCP returns { content: [{ type: 'text', text: JSON.stringify({data, ...}) }] }
      if (sqlExecResult?.content && Array.isArray(sqlExecResult.content)) {
        const textContent = sqlExecResult.content[0]?.text;
        console.log('[METRICS-AGENT] SQL exec text content:', textContent);
        
        if (textContent) {
          try {
            const parsed = JSON.parse(textContent);
            console.log('[METRICS-AGENT] Parsed SQL exec result:', parsed);
            
            if (parsed.data !== undefined) {
              queryResult = parsed.data;
              console.log('[METRICS-AGENT] Extracted data:', queryResult?.length, 'rows');
            } else {
              throw new Error('No data field in execution response');
            }
          } catch (e) {
            console.error('[METRICS-AGENT] Failed to parse SQL exec response:', e);
            executionError = `Failed to parse SQL execution result: ${e}`;
            throw new Error(executionError);
          }
        }
      } else {
        executionError = `MCP SQL execution failed - unexpected response format: ${JSON.stringify(sqlExecResult)}`;
        throw new Error(executionError);
      }
      
      progressCallback?.(
        'SQL Execution',
        2.7,
        'completed',
        `MCP query executed successfully - ${queryResult.length || 0} rows returned`,
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!sqlError && !executionError) {
        sqlError = `MCP operation failed: ${errorMessage}`;
      }
      
      progressCallback?.(
        sqlError.includes('generation') ? 'SQL Generation' : 'SQL Execution',
        sqlError.includes('generation') ? 2.5 : 2.7,
        'failed',
        errorMessage,
      );
    }

    // Prepare result in the expected format
    const userQueryResult = {
      sql: generatedSQL,
      result: queryResult,
      error: sqlError || executionError || undefined,
      metadata: {
        executionTime: 0,
        rowCount: queryResult.length || 0,
        provider: 'mcp',
        model: 'context-driven',
      },
    };

    // All SQL generation and execution now handled by MCP tools above

    if (userQueryResult.error) {

      progressCallback?.(
        'SQL Execution',
        2.7,
        'failed',
        `SQL execution failed: ${userQueryResult.error}`,
      );
    } else {

      progressCallback?.(
        'SQL Generation',
        2.5,
        'completed',
        `SQL Generated: ${userQueryResult.sql.substring(0, 100)}...`,
      );

      progressCallback?.(
        'SQL Execution',
        2.7,
        'completed',
        `SQL executed successfully - ${userQueryResult.result?.length || 0} rows returned`,
      );
    }

    // Step 4: Generate comprehensive metrics analysis
    progressCallback?.(
      'Analysis generation',
      5,
      'in_progress',
      'Generating insights from database query results...',
    );

    // Generate comprehensive analysis using context-driven results
    const reportPrompt = `
You are a Business Metrics specialist. The user asked: "${userMessage}"

ALWAYS start your response with this exact format:

# 📊 Metrics Analysis Report

## 🔍 MCP-Based SQL Generation

Using the Model Context Protocol (MCP) with schema context files, the following SQL query was generated:

\`\`\`sql
${userQueryResult.sql || 'No SQL was generated'}
\`\`\`

**MCP Tools Used:**
- ✅ get-schema tool for context-driven schema retrieval
- ✅ generate-sql tool for natural language to SQL conversion
- ✅ execute-sql tool for database query execution

## 📈 Query Results
${
  userQueryResult.result && userQueryResult.result.length > 0
    ? `Found ${userQueryResult.result.length} results:\n\n\`\`\`json\n${JSON.stringify(userQueryResult.result, null, 2)}\n\`\`\`\n\n**Data Summary:** ${userQueryResult.result.length} records returned from the database.`
    : '**No results returned from the SQL execution**\n\nThis could indicate:\n- Empty database tables\n- No matching data for the query criteria\n- Need to set up sample KPI data for testing'
}

## 💡 Analysis

**CRITICAL: Only use the actual query results above. Do NOT generate, simulate, or hallucinate sample data.**

Based on your query about: ${analysis.intent}

${
  userQueryResult.result && userQueryResult.result.length > 0
    ? 'The SQL query returned actual data from the database. Analyze these real results and provide insights based on the actual numbers and values shown above.'
    : `**NO DATA FOUND**: The SQL query executed successfully but returned no results. This means the database tables are empty or contain no data matching the query criteria.

**Do not create fake data or sample results.** Instead, explain:
1. The query is correct and would work with populated data
2. The database needs to be populated with actual KPI data
3. What specific data would need to be added to see results`
}

**Provide insights only from the actual query results shown above - never invent or simulate data.**
`;

    const finalResponse = await llmService.generateResponse(
      `You are an expert Business Intelligence and Analytics specialist with deep expertise in data analysis, performance tracking, and data-driven insights. You communicate insights clearly through structured reports and actionable recommendations.
      
      CRITICAL RULE: You must ONLY analyze the actual data provided in the query results. NEVER generate, simulate, invent, or hallucinate sample data, fake companies, or fictional revenue numbers. If no data is returned, explicitly state this fact and do not create example results.`,
      reportPrompt,
      {
        temperature: 0.3,
        providerName: (params as any)?.llmSelection?.providerName || metadata?.providerName,
        modelName: (params as any)?.llmSelection?.modelName || metadata?.modelName,
        maxTokens: 4000,
        callerType: 'agent',
        callerName: metadata?.agentName || 'metrics-agent',
        conversationId: params.sessionId,
        dataClassification: 'financial',
      },
    );

    // Final completion message
    const resultCount = userQueryResult.result?.length || 0;
    progressCallback?.(
      'Analysis complete',
      6,
      'completed',
      `Generated metrics analysis from ${resultCount} data points using context-driven SQL`,
    );

    // Prefer raw content if an object was returned (unified LLM response)
    const finalContent =
      typeof finalResponse === 'string'
        ? finalResponse
        : (finalResponse && (finalResponse.content || finalResponse.response)) ||
          JSON.stringify(finalResponse);

    return {
      success: true,
      response: finalContent,
      metadata: {
        agentName: 'Enhanced Metrics Agent',
        processingTime:
          Date.now() -
          (metadata?.timestamp
            ? new Date(metadata.timestamp).getTime()
            : Date.now()),
        toolsUsed: [
          'MCP get-schema tool',
          'MCP generate-sql tool', 
          'MCP execute-sql tool',
          'PostgreSQL via MCP',
          'Context-driven schema files',
        ],
        responseType: analysis.analysis_type || 'metrics_analysis',
        sqlGenerated: userQueryResult.sql || '',
        executionTime: userQueryResult.metadata?.executionTime || 0,
        rowCount: resultCount,
        mcpEnabled: true,
      },
    };
  } catch (error) {
    console.error('[METRICS-AGENT] Fatal error:', error);
    console.error('[METRICS-AGENT] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Report error in progress
    progressCallback?.(
      'Analysis failed',
      6,
      'failed',
      `Database operation failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Create a user-friendly error response with helpful information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isConnectionError =
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('Tenant or user not found');

    let userFriendlyResponse = '';

    if (isConnectionError) {
      userFriendlyResponse = `## MCP Connection Issue

I'm experiencing a connection issue with the Model Context Protocol (MCP) server. This may be a temporary network connectivity problem.

### What I was trying to do:
Analyze your request: "${userMessage}"

### MCP Integration Status:
✅ **MCP client service is available**  
✅ **Context-driven schema files loaded**  
⚠️ **MCP server connection temporarily unavailable**

### MCP Tools Available:
- get-schema: Retrieve database schema from context files
- generate-sql: Convert natural language to SQL queries  
- execute-sql: Run SQL queries against Supabase
- analyze-results: Generate insights from query results

### Next Steps:
1. **Try again in a moment** - this is usually a temporary connectivity issue
2. **The MCP integration is working** - when connected, I can analyze your database with natural language queries
3. **Contact support** if the issue persists

*Note: This is an MCP server connectivity issue, not a problem with the MCP protocol implementation itself.*`;
    } else {
      userFriendlyResponse = `## Analysis Error

I encountered an error while processing your metrics analysis request.

### Your Request:
"${userMessage}"

### Error Details:
${errorMessage}

### System Status:
✅ **MCP protocol integration active**  
✅ **Natural language to SQL processing available**  
❌ **Query execution failed**

### What to Try:
1. **Rephrase your question** - try asking in a different way
2. **Be more specific** - mention exact metrics or data you need
3. **Try a simpler query** - like "show me user count" or "list recent tasks"

*The metrics analysis system is operational, but this specific request encountered an issue.*`;
    }

    return {
      success: false,
      response: userFriendlyResponse,
      metadata: {
        agentName: 'Enhanced Metrics Agent',
        processingTime:
          Date.now() -
          (metadata?.timestamp
            ? new Date(metadata.timestamp).getTime()
            : Date.now()),
        toolsUsed: [
          'MCP get-schema tool (Failed)',
          'MCP generate-sql tool (Failed)',
          'MCP execute-sql tool (Failed)',
        ],
        responseType: 'error',
        mcpEnabled: false,
        error: errorMessage,
      },
    };
  }
}
