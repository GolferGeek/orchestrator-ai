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
    queryAnalysis?: string;
    report?: string;
    result?: {
        report: string;
        metricsType?: string;
        sql?: string;
    };
}
export declare class MetricsAgentGraph {
    private readonly llmClient;
    private readonly webhookService;
    private readonly logger;
    constructor(llmClient: LLMHttpClientService, webhookService: WebhookStatusService);
    execute(input: MetricsAgentState): Promise<MetricsAgentState>;
}
