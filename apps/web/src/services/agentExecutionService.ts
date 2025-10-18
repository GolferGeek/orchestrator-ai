import type { JsonObject } from '@orchestrator-ai/transport-types';
import { apiService } from './apiService';
import type { AgentTaskResponse } from '@/stores/agentChatStore/types';

export interface AgentExecutionRequest {
  mode: string;
  conversationId: string;
  planId?: string | null;
  orchestrationSlug?: string | null;
  orchestrationRunId?: string | null;
  promptParameters?: JsonObject;
  userMessage?: string;
  payload?: JsonObject;
  metadata?: JsonObject;
}

interface ApiError extends Error {
  response?: {
    status?: number;
  };
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
  const normalizedAgent = encodeURIComponent(agentSlug);
  const primaryUrl = `/agent-to-agent/${encodeURIComponent(orgSegment)}/${normalizedAgent}/tasks`;
  const fallbackUrl = `/agents/${encodeURIComponent(orgSegment)}/${normalizedAgent}/tasks`;

  const payload = {
    mode: request.mode,
    conversationId: request.conversationId,
    planId: request.planId ?? undefined,
    orchestrationSlug: request.orchestrationSlug ?? undefined,
    orchestrationRunId: request.orchestrationRunId ?? undefined,
    promptParameters: request.promptParameters ?? undefined,
    userMessage: request.userMessage ?? undefined,
    payload: request.payload ?? undefined,
    metadata: request.metadata ?? undefined,
  };

  try {
    return await apiService.post<AgentTaskResponse>(primaryUrl, payload);
  } catch (error) {
    const typedError = error as ApiError;
    const status = typedError.response?.status;
    if (status && status !== 404) {
      throw error;
    }
    return apiService.post<AgentTaskResponse>(fallbackUrl, payload);
  }
}

export const agentExecutionService = {
  executeAgentTask,
};

export default agentExecutionService;
