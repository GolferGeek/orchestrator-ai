import { apiService } from './apiService';

export interface HumanApprovalRecord {
  id: string;
  organization_slug: string | null;
  agent_slug: string;
  conversation_id: string | null;
  task_id: string | null;
  mode: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  decision_at?: string | null;
  metadata?: unknown;
  created_at?: string;
}

export const approvalsService = {
  async list(params?: { status?: 'pending' | 'approved' | 'rejected'; conversationId?: string; agentSlug?: string }) {
    const search = new URLSearchParams();
    if (params?.status) search.append('status', params.status);
    if (params?.conversationId) search.append('conversationId', params.conversationId);
    if (params?.agentSlug) search.append('agentSlug', params.agentSlug);
    const url = search.toString() ? `/agent-approvals?${search.toString()}` : '/agent-approvals';
    const res = await apiService.get(url);
    return res?.data ?? res ?? [];
  },
  async approve(id: string) {
    const res = await apiService.post(`/agent-approvals/${id}/approve`);
    return res?.data ?? res;
  },
  async reject(id: string) {
    const res = await apiService.post(`/agent-approvals/${id}/reject`);
    return res?.data ?? res;
  },
  async approveAndContinue(
    orgSlug: string | null | undefined,
    agentSlug: string,
    id: string,
    body?: { options?: Record<string, unknown>; payload?: Record<string, unknown> },
  ) {
    const org = !orgSlug || orgSlug.trim().length === 0 ? 'global' : orgSlug;
    const url = `/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(agentSlug)}/approvals/${encodeURIComponent(id)}/continue`;
    return apiService.post(url, body ?? {});
  },
};

export default approvalsService;
