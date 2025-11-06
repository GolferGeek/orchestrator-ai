import { LLMNodeExecutor } from '../nodes/llm-node';
import { WebhookStatusService } from '../../services/webhook-status.service';
export interface MarketingSwarmState {
    announcement: string;
    provider: string;
    model: string;
    taskId: string;
    conversationId: string;
    userId: string;
    statusWebhook?: string;
    webPost?: string;
    seoContent?: string;
    socialMedia?: string;
    result?: Record<string, string>;
    errors?: string[];
}
export declare class MarketingSwarmGraph {
    private readonly llmNode;
    private readonly webhookService;
    constructor(llmNode: LLMNodeExecutor, webhookService: WebhookStatusService);
    execute(input: MarketingSwarmState): Promise<MarketingSwarmState>;
}
