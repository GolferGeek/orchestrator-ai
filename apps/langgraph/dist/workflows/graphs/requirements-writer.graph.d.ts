import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';
export interface RequirementsWriterState {
    prompt: string;
    provider: string;
    model: string;
    taskId: string;
    conversationId: string;
    userId: string;
    statusWebhook?: string;
    metadata?: Record<string, unknown>;
    analysis?: string;
    documentType?: string;
    features?: string;
    complexity?: string;
    document?: string;
    result?: {
        document: string;
        documentType: string;
        analysis: Record<string, unknown>;
        features: string[];
        complexity: Record<string, unknown>;
    };
}
export declare class RequirementsWriterGraph {
    private readonly llmClient;
    private readonly webhookService;
    private readonly logger;
    constructor(llmClient: LLMHttpClientService, webhookService: WebhookStatusService);
    execute(input: RequirementsWriterState): Promise<RequirementsWriterState>;
}
