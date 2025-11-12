export declare class WorkflowResponseDto {
    success: boolean;
    taskId: string;
    conversationId: string;
    data: Record<string, unknown>;
    metadata?: {
        executionTime?: number;
        stepsCompleted?: number;
        provider?: string;
        model?: string;
    };
}
