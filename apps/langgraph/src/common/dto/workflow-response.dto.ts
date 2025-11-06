export class WorkflowResponseDto {
  success: boolean;
  taskId: string;
  conversationId: string;
  data: Record<string, unknown>; // Workflow-specific output
  metadata?: {
    executionTime?: number;
    stepsCompleted?: number;
    provider?: string;
    model?: string;
  };
}
