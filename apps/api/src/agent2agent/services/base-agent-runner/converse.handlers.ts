import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import { LLMService } from '@llm/llm.service';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import { TaskRequestDto } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';

export interface ConverseHandlerDependencies {
  llmService: LLMService;
  conversationsService: Agent2AgentConversationsService;
}

/**
 * Executes conversational mode for an agent.
 * @param definition - Agent runtime definition configuration
 * @param request - Incoming task request payload
 * @param organizationSlug - Optional organization identifier
 * @param services - Required service dependencies for execution
 * @returns A task response containing conversation results
 */
export async function executeConverse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: ConverseHandlerDependencies,
): Promise<TaskResponseDto> {
  void definition;
  void request;
  void organizationSlug;
  void services;
  throw new Error('executeConverse not implemented');
}

/**
 * Builds the system prompt used for conversational interactions.
 * @param definition - Agent runtime definition containing prompt templates
 * @param conversationHistory - Ordered list of prior conversation messages
 * @returns A formatted system prompt string
 */
export function buildConversationalPrompt(
  definition: AgentRuntimeDefinition,
  conversationHistory: unknown[],
): string {
  void definition;
  void conversationHistory;
  throw new Error('buildConversationalPrompt not implemented');
}
