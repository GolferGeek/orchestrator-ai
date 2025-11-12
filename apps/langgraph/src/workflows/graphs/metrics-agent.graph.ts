import { Injectable, Logger } from '@nestjs/common';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';

export interface MetricsAgentState {
  prompt: string;
  provider: string;
  model: string;
  taskId: string;
  conversationId: string;
  userId: string;
  statusWebhook?: string;

  // Intermediate results
  queryAnalysis?: string;
  report?: string;

  // Final output
  result?: {
    report: string;
    metricsType?: string;
    sql?: string;
  };
}

@Injectable()
export class MetricsAgentGraph {
  private readonly logger = new Logger(MetricsAgentGraph.name);

  constructor(
    private readonly llmClient: LLMHttpClientService,
    private readonly webhookService: WebhookStatusService,
  ) {}

  async execute(input: MetricsAgentState): Promise<MetricsAgentState> {
    // Send start webhook
    if (input.statusWebhook) {
      await this.webhookService.sendStarted(
        input.statusWebhook,
        input.taskId,
        input.conversationId,
        input.userId,
        2, // totalSteps
      );
    }

    try {
      const state: MetricsAgentState = { ...input };

      // Step 1: Parse query
      if (state.statusWebhook) {
        await this.webhookService.sendProgress(
          state.statusWebhook,
          state.taskId,
          state.conversationId,
          state.userId,
          'parse_query',
          1,
          2,
          'Analyzing metrics request and identifying required data...',
        );
      }

      const parseResult = await this.llmClient.callLLM({
        provider: state.provider,
        model: state.model,
        systemMessage: 'You are a business metrics analyst. Analyze this metrics request and identify: metrics type (financial/customer/product/operational), required data sources, and analysis approach. Return as JSON.',
        userMessage: state.prompt,
        callerName: 'metrics-parse',
        userId: state.userId,
      });
      state.queryAnalysis = parseResult.text;

      // Step 2: Generate report
      if (state.statusWebhook) {
        await this.webhookService.sendProgress(
          state.statusWebhook,
          state.taskId,
          state.conversationId,
          state.userId,
          'generate_report',
          2,
          2,
          'Creating metrics analysis report...',
        );
      }

      const systemPrompt = 'You are a Business Metrics and Analytics specialist. Create comprehensive metrics reports with data-driven insights.\n\nIMPORTANT DATABASE NOTES:\n- All tables are in the PUBLIC schema in Supabase\n- Database may be empty in development\n- Always check for data availability first\n- If tables are empty, provide setup instructions\n\nAvailable Tables:\n- companies (id, name, industry, founded_year)\n- departments (id, company_id, name, head_of_department, budget)\n- kpi_metrics (id, name, metric_type, unit, description)\n- kpi_data (id, department_id, metric_id, value, date_recorded)\n\nCanonical Metric Names:\n- Use "Revenue" not "Sales" for top-line amounts\n- CAC, LTV, Churn Rate %, Retention Rate %, NPS, CSAT %\n- DAU/WAU/MAU, Feature Adoption %\n- Tasks Completed, On-Time Delivery %, Bug Count\n\nWhen database is empty, provide this setup guidance:\n1. Create sample company\n2. Add departments\n3. Define KPI metrics (Revenue, Customer Count, etc.)\n4. Add sample KPI data\n\nGenerate a markdown report with:\n1. Executive Summary\n2. Key Findings\n3. Data Analysis (with note about database availability)\n4. Recommendations\n5. SQL Query (if applicable)';

      const reportResult = await this.llmClient.callLLM({
        provider: state.provider,
        model: state.model,
        systemMessage: systemPrompt,
        userMessage: `Generate a metrics report for: ${state.prompt}\n\nQuery Analysis: ${state.queryAnalysis}`,
        temperature: 0.2,
        maxTokens: 3500,
        callerName: 'metrics-generate',
        userId: state.userId,
      });

      state.report = reportResult.text;

      // Try to extract SQL if present in the report
      const sqlMatch = state.report.match(/```sql\n([\s\S]*?)\n```/);
      const extractedSql = sqlMatch ? sqlMatch[1] : undefined;

      let metricsType = 'general';
      try {
        const analysis = JSON.parse(state.queryAnalysis || '{}');
        metricsType = analysis.metrics_type || analysis.metricsType || 'general';
      } catch (e) {
        // Use default
      }

      state.result = {
        report: state.report,
        metricsType,
        sql: extractedSql,
      };

      // Send completion webhook
      if (input.statusWebhook) {
        await this.webhookService.sendCompleted(
          input.statusWebhook,
          input.taskId,
          input.conversationId,
          input.userId,
          state.result,
        );
      }

      return state;
    } catch (error) {
      // Send failure webhook
      if (input.statusWebhook) {
        await this.webhookService.sendFailed(
          input.statusWebhook,
          input.taskId,
          input.conversationId,
          input.userId,
          error.message,
        );
      }
      throw error;
    }
  }
}
