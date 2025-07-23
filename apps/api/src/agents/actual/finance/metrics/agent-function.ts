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
  if (!mcpService?.isAvailable()) {
    throw new Error('MCP service is required for Metrics Agent. Database connection not available.');
  }

  try {
    // Step 1: Get database schema to understand available metrics
    progressCallback?.('Discovering available metrics', 0, 'in_progress', 'Analyzing database schema...');
    
    const schemaResult = await mcpService.getSchema();
    if (!schemaResult.success) {
      throw new Error(`Failed to get database schema: ${schemaResult.error}`);
    }

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
    } catch (e) {
      analysis = {
        intent: "Provide general metrics overview",
        metrics_needed: ["revenue", "customer_metrics", "performance"],
        tables_to_query: ["kpi_data", "kpi_goals", "kpi_metrics"],
        analysis_type: "dashboard"
      };
    }

    // Step 3: Query the database for actual metrics data
    progressCallback?.('Retrieving metrics data', 2, 'in_progress', 'Querying database for current KPIs...');

    // Get KPI metrics definitions
    const metricsResult = await mcpService.readData({
      table_name: 'kpi_metrics',
      format: 'json',
      limit: 50
    });

    // Get recent KPI data
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

    // Get KPI goals for comparison
    const goalsResult = await mcpService.readData({
      table_name: 'kpi_goals',
      format: 'json',
      limit: 20
    });

    // Step 4: Generate comprehensive metrics analysis
    progressCallback?.('Generating insights', 3, 'in_progress', 'Creating metrics analysis and recommendations...');

    const metricsData = {
      metrics_definitions: metricsResult.success ? metricsResult.data : [],
      current_kpi_data: kpiDataResult.success ? kpiDataResult.data : [],
      goals: goalsResult.success ? goalsResult.data : [],
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
        dataPoints: (metricsData.current_kpi_data?.length || 0) + (metricsData.goals?.length || 0),
        mcpEnabled: true
      }
    };

  } catch (error) {
    console.error('Metrics Agent MCP Error:', error);
    
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