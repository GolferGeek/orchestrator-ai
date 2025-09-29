import { apiService } from './apiService';
import type { AgentTaskResponse } from '@/stores/agentChatStore/types';

export interface AgentExecutionRequest {
  mode: string;
  conversationId: string;
  planId?: string | null;
  orchestrationSlug?: string | null;
  orchestrationRunId?: string | null;
  promptParameters?: Record<string, any>;
  userMessage?: string;
  payload?: Record<string, any>;
}

const normalizeOrgSegment = (orgSlug?: string | null) => {
  if (!orgSlug || orgSlug.trim().length === 0) {
    return 'global';
  }
  return orgSlug;
};

export async function executeAgentTask(
  orgSlug: string | null | undefined,
  agentSlug: string,
  request: AgentExecutionRequest,
): Promise<AgentTaskResponse> {
  const orgSegment = normalizeOrgSegment(orgSlug);
  const url = `/agent-to-agent/${encodeURIComponent(orgSegment)}/${encodeURIComponent(agentSlug)}/tasks`;

  const payload = {
    mode: request.mode,
    conversationId: request.conversationId,
    planId: request.planId ?? undefined,
    orchestrationSlug: request.orchestrationSlug ?? undefined,
    orchestrationRunId: request.orchestrationRunId ?? undefined,
    promptParameters: request.promptParameters ?? undefined,
    userMessage: request.userMessage ?? undefined,
    payload: request.payload ?? undefined,
  };

  return apiService.post(url, payload);
}

export const agentExecutionService = {
  executeAgentTask,
};

export default agentExecutionService;
