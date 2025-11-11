"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MetricsAgentGraph_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsAgentGraph = void 0;
const common_1 = require("@nestjs/common");
const llm_http_client_service_1 = require("../../services/llm-http-client.service");
const webhook_status_service_1 = require("../../services/webhook-status.service");
let MetricsAgentGraph = MetricsAgentGraph_1 = class MetricsAgentGraph {
    constructor(llmClient, webhookService) {
        this.llmClient = llmClient;
        this.webhookService = webhookService;
        this.logger = new common_1.Logger(MetricsAgentGraph_1.name);
    }
    async execute(input) {
        if (input.statusWebhook) {
            await this.webhookService.sendStarted(input.statusWebhook, input.taskId, input.conversationId, input.userId, 2);
        }
        try {
            const state = { ...input };
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'parse_query', 1, 2, 'Analyzing metrics request and identifying required data...');
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
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'generate_report', 2, 2, 'Creating metrics analysis report...');
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
            const sqlMatch = state.report.match(/```sql\n([\s\S]*?)\n```/);
            const extractedSql = sqlMatch ? sqlMatch[1] : undefined;
            let metricsType = 'general';
            try {
                const analysis = JSON.parse(state.queryAnalysis || '{}');
                metricsType = analysis.metrics_type || analysis.metricsType || 'general';
            }
            catch (e) {
            }
            state.result = {
                report: state.report,
                metricsType,
                sql: extractedSql,
            };
            if (input.statusWebhook) {
                await this.webhookService.sendCompleted(input.statusWebhook, input.taskId, input.conversationId, input.userId, state.result);
            }
            return state;
        }
        catch (error) {
            if (input.statusWebhook) {
                await this.webhookService.sendFailed(input.statusWebhook, input.taskId, input.conversationId, input.userId, error.message);
            }
            throw error;
        }
    }
};
exports.MetricsAgentGraph = MetricsAgentGraph;
exports.MetricsAgentGraph = MetricsAgentGraph = MetricsAgentGraph_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [llm_http_client_service_1.LLMHttpClientService,
        webhook_status_service_1.WebhookStatusService])
], MetricsAgentGraph);
//# sourceMappingURL=metrics-agent.graph.js.map