import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { WebhookStatusService } from '../../services/webhook-status.service';
export declare class LLMNodeExecutor {
    private readonly llmClient;
    private readonly webhookService;
    constructor(llmClient: LLMHttpClientService, webhookService: WebhookStatusService);
    execute(state: Record<string, unknown>, config: {
        systemMessage: string;
        userMessageField: string;
        outputField: string;
        stepName: string;
        sequence: number;
        totalSteps: number;
    }): Promise<Partial<Record<string, unknown>>>;
}
