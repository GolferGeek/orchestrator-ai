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

  // MCP is required for this agent - no fallback to simulated data
  // Use the progressCallback to log MCP service state since it's visible in logs
  progressCallback?.('MCP Service Debug', 0, 'in_progress', `MCPService exists: ${!!mcpService}, isAvailable: ${mcpService?.isAvailable()}, methods: ${mcpService ? Object.keys(mcpService).join(',') : 'none'}`);

  if (!mcpService?.isAvailable()) {
    progressCallback?.('MCP Service Debug', 0, 'failed', `MCP service unavailable - this indicates separate MCPClientService instances`);
    throw new Error('MCP service is required for Metrics Agent. Database connection not available.');
  }

  try {
    // Step 1: Get database schema to understand available metrics
    progressCallback?.('Database connection', 0, 'in_progress', 'Connecting to metrics database...');
    
    const schemaResult = await mcpService.getSchema();
    if (!schemaResult.success) {
      progressCallback?.('Database connection', 0, 'failed', `Failed to connect to database: ${schemaResult.error}`);
      throw new Error(`Failed to get database schema: ${schemaResult.error}`);
    }
    
    // Extract schema info for progress reporting
    const schemaInfo = schemaResult.data || {};
    const tablesFound = schemaInfo.database_summary?.total_tables || 'multiple';
    progressCallback?.('Database schema', 0, 'completed', `Connected successfully - discovered ${tablesFound} tables including KPI infrastructure`);

    // Step 2: Analyze user request and identify relevant metrics
    progressCallback?.('Analyzing request', 1, 'in_progress', 'Understanding metrics requirements...');
    
    const analysisPrompt = `
Based on this user request: "${userMessage}"

And this database schema containing KPI and metrics tables:
${JSON.stringify(schemaResult.data, null, 2)}

Determine what specific metrics analysis is needed. Focus on these key areas:
- KPI data analysis (kpi_data table)  
- KPI goals tracking (kpi_goals table)
- Metrics definitions (kpi_metrics table)
- Department performance (departments table)
- Company-wide metrics (companies table)

Respond with a JSON object containing:
{
  "intent": "description of what the user wants",
  "metrics_needed": ["list", "of", "specific", "metrics"],
  "tables_to_query": ["table1", "table2"],
  "analysis_type": "dashboard|trend_analysis|performance_report|kpi_monitoring"
}
`;

    const analysisResponse = await llmService.generateResponse(
      'You are a business intelligence analyst. Analyze user requests for metrics and determine the best approach.',
      analysisPrompt,
      { temperature: 0.1 }
    );

    let analysis;
    try {
      analysis = JSON.parse(analysisResponse.response || analysisResponse);
      progressCallback?.('Request analysis', 1, 'completed', `Identified ${analysis.analysis_type} analysis: ${analysis.intent}`);
    } catch (e) {
      analysis = {
        intent: "Provide general metrics overview",
        metrics_needed: ["revenue", "customer_metrics", "performance"],
        tables_to_query: ["kpi_data", "kpi_goals", "kpi_metrics"],
        analysis_type: "dashboard"
      };
      progressCallback?.('Request analysis', 1, 'completed', 'Using fallback analysis: general metrics dashboard');
    }

    // Step 3: Query the database for actual metrics data
    progressCallback?.('Data retrieval', 2, 'in_progress', 'Retrieving KPI metrics definitions...');

    // Get KPI metrics definitions
    const metricsResult = await mcpService.readData({
      table_name: 'kpi_metrics',
      format: 'json',
      limit: 50
    });
    
    if (metricsResult.success) {
      // MCP response structure: result.data contains the parsed JSON with nested data array
      // The actual records are in result.data.data, not result.data directly
      const metricsData = Array.isArray(metricsResult.data?.data) ? metricsResult.data.data : [];
      const metricsCount = metricsData.length;
      progressCallback?.('Metrics definitions', 2, 'completed', `Retrieved ${metricsCount} metric definitions from database`);
      progressCallback?.('Debug metrics structure', 2, 'in_progress', `Metrics data structure: ${JSON.stringify(metricsResult.data, null, 2)?.substring(0, 300)}...`);
    } else {
      progressCallback?.('Metrics definitions', 2, 'failed', `Failed to retrieve metrics: ${metricsResult.error}`);
    }

    // Get recent KPI data using intelligent query
    progressCallback?.('KPI data query', 3, 'in_progress', 'Executing intelligent query for recent KPI data...');
    
    const kpiDataResult = await mcpService.queryAndFormat({
      user_prompt: `Get the most recent KPI data values with their metric names and departments. 
      Join kpi_data with kpi_metrics and departments to show:
      - Metric name and description
      - Current value and date
      - Department name
      - Target/goal comparison if available
      Order by date_recorded DESC, limit to 20 most recent entries.`,
      output_format: 'json',
      max_rows: 20,
      include_explanation: false
    });
    
    if (kpiDataResult.success) {
      // Handle different response structures from queryAndFormat vs readData
      // Look for the actual data in nested structures
      let kpiData = [];
      if (Array.isArray(kpiDataResult.data?.data)) {
        // readData format: result.data.data contains the array
        kpiData = kpiDataResult.data.data;
      } else if (Array.isArray(kpiDataResult.data?.results)) {
        // queryAndFormat format: result.data.results contains the array
        kpiData = kpiDataResult.data.results;
      } else if (Array.isArray(kpiDataResult.data)) {
        // Direct array format (fallback)
        kpiData = kpiDataResult.data;
      }
      const dataCount = kpiData.length;
      progressCallback?.('KPI data', 3, 'completed', `Retrieved ${dataCount} recent KPI data points via SQL query`);
      progressCallback?.('Debug KPI structure', 3, 'in_progress', `KPI data structure: ${JSON.stringify(kpiDataResult.data, null, 2)?.substring(0, 300)}...`);
    } else {
      progressCallback?.('KPI data', 3, 'failed', `Query execution failed: ${kpiDataResult.error}`);
    }

    // Get KPI goals for comparison
    progressCallback?.('Goals retrieval', 4, 'in_progress', 'Retrieving KPI goals and targets...');
    
    const goalsResult = await mcpService.readData({
      table_name: 'kpi_goals',
      format: 'json',
      limit: 20
    });
    
    if (goalsResult.success) {
      // Goals data structure: look for nested data array
      const goalsData = Array.isArray(goalsResult.data?.data) ? goalsResult.data.data : [];
      const goalsCount = goalsData.length;
      progressCallback?.('Goals data', 4, 'completed', `Retrieved ${goalsCount} KPI goals and targets`);
      progressCallback?.('Debug goals structure', 4, 'in_progress', `Goals data structure: ${JSON.stringify(goalsResult.data, null, 2)?.substring(0, 300)}...`);
    } else {
      progressCallback?.('Goals data', 4, 'failed', `Failed to retrieve goals: ${goalsResult.error}`);
    }

    // Step 4: Generate comprehensive metrics analysis
    progressCallback?.('Analysis generation', 5, 'in_progress', 'Generating insights from live database data...');

    // Extract actual data arrays from MCP responses with correct nested structure
    const metricsDefinitions = metricsResult.success && Array.isArray(metricsResult.data?.data) ? metricsResult.data.data : [];
    
    let currentKpiData = [];
    if (kpiDataResult.success) {
      if (Array.isArray(kpiDataResult.data?.data)) {
        // readData format: result.data.data contains the array
        currentKpiData = kpiDataResult.data.data;
      } else if (Array.isArray(kpiDataResult.data?.results)) {
        // queryAndFormat format: result.data.results contains the array
        currentKpiData = kpiDataResult.data.results;
      } else if (Array.isArray(kpiDataResult.data)) {
        // Direct array format (fallback)
        currentKpiData = kpiDataResult.data;
      }
    }
    
    const goalsData = goalsResult.success && Array.isArray(goalsResult.data?.data) ? goalsResult.data.data : [];

    const metricsData = {
      metrics_definitions: metricsDefinitions,
      current_kpi_data: currentKpiData,
      goals: goalsData,
      analysis_intent: analysis.intent,
      analysis_type: analysis.analysis_type
    };

    const reportPrompt = `
You are a Business Metrics and Analytics specialist. Create a comprehensive metrics analysis based on this real database data:

**User Request**: ${userMessage}
**Analysis Intent**: ${analysis.intent}
**Analysis Type**: ${analysis.analysis_type}

**Available Metrics Definitions**:
${JSON.stringify(metricsData.metrics_definitions, null, 2)}

**Current KPI Data**:  
${JSON.stringify(metricsData.current_kpi_data, null, 2)}

**KPI Goals**:
${JSON.stringify(metricsData.goals, null, 2)}

Create a professional metrics analysis report with:

1. **Executive Summary** - Key insights and performance overview
2. **Current Performance** - Actual metrics with goal comparisons
3. **Trend Analysis** - Performance patterns and changes
4. **Department Breakdown** - Performance by department
5. **Key Insights** - Important findings and anomalies
6. **Recommendations** - Actionable next steps
7. **Metrics Dashboard** - Formatted data visualization

Use professional tone, data-driven insights, and clear formatting with emojis for visual appeal.
Focus on actionable business intelligence that drives decision-making.

If the data shows no records, explain that this is a new system and provide framework for metrics tracking.
`;

    const finalResponse = await llmService.generateResponse(
      `You are an expert Business Intelligence and Analytics specialist with deep expertise in KPI analysis, performance tracking, and data-driven insights. You communicate insights clearly through structured reports and actionable recommendations.`,
      reportPrompt,
      { temperature: 0.3 }
    );

    // Final completion message with actual data counts
    const totalDataPoints = metricsDefinitions.length + currentKpiData.length + goalsData.length;
    progressCallback?.('Analysis complete', 6, 'completed', `Generated comprehensive metrics analysis from ${totalDataPoints} live data points (${metricsDefinitions.length} definitions, ${currentKpiData.length} KPI records, ${goalsData.length} goals)`);

    return {
      success: true,
      response: finalResponse.response || finalResponse,
      metadata: {
        agentName: 'Metrics Agent',
        processingTime: Date.now() - (metadata?.timestamp ? new Date(metadata.timestamp).getTime() : Date.now()),
        toolsUsed: ['MCP Database Access', 'KPI Analysis', 'Performance Tracking'],
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
        toolsUsed: ['MCP Database Access (Failed)'],
        responseType: 'error',
        mcpEnabled: false,
        error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}