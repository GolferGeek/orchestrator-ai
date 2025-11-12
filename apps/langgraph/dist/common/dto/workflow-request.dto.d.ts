export declare class WorkflowRequestDto {
    taskId: string;
    conversationId: string;
    userId: string;
    provider: string;
    model: string;
    prompt: string;
    statusWebhook?: string;
    metadata?: Record<string, unknown>;
}
