import { IsString, IsUUID, IsOptional, IsUrl, IsObject } from 'class-validator';

export class WorkflowRequestDto {
  @IsUUID()
  taskId: string;

  @IsUUID()
  conversationId: string;

  @IsUUID()
  userId: string;

  @IsString()
  provider: string; // e.g., 'openai', 'anthropic'

  @IsString()
  model: string; // e.g., 'gpt-4', 'claude-3-opus'

  @IsString()
  prompt: string; // Main user prompt/announcement

  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  statusWebhook?: string; // Webhook URL for progress updates

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>; // Additional workflow-specific data
}
