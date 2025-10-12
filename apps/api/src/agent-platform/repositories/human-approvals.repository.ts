import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

export interface HumanApprovalRecord {
  id: string;
  organization_slug: string | null;
  agent_slug: string;
  conversation_id: string | null;
  task_id: string | null;
  orchestration_run_id: string | null;
  orchestration_step_id: string | null;
  mode: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  decision_at?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class HumanApprovalsRepository {
  private readonly logger = new Logger(HumanApprovalsRepository.name);
  private readonly table = 'human_approvals';

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async create(input: {
    organizationSlug: string | null;
    agentSlug: string;
    conversationId?: string | null;
    taskId?: string | null;
    orchestrationRunId?: string | null;
    orchestrationStepId?: string | null;
    mode: string;
    metadata?: Record<string, any>;
  }): Promise<HumanApprovalRecord> {
    const { data, error } = await this.client()
      .from(this.table)
      .insert({
        organization_slug: input.organizationSlug,
        agent_slug: input.agentSlug,
        conversation_id: input.conversationId ?? null,
        task_id: input.taskId ?? null,
        orchestration_run_id: input.orchestrationRunId ?? null,
        orchestration_step_id: input.orchestrationStepId ?? null,
        mode: input.mode,
        status: 'pending',
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw new Error(`Failed to create approval: ${error.message}`);
    return data as HumanApprovalRecord;
  }

  async setStatus(
    id: string,
    status: 'approved' | 'rejected',
    approvedBy?: string | null,
    metadata?: Record<string, any>,
  ): Promise<HumanApprovalRecord> {
    const payload: Record<string, any> = {
      status,
      approved_by: approvedBy ?? null,
      decision_at: new Date().toISOString(),
    };
    if (metadata) {
      payload.metadata = metadata;
    }
    const { data, error } = await this.client()
      .from(this.table)
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`Failed to update approval: ${error.message}`);
    return data as HumanApprovalRecord;
  }

  async get(id: string): Promise<HumanApprovalRecord | null> {
    const { data, error } = await this.client()
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to fetch approval: ${error.message}`);
    return (data as HumanApprovalRecord) || null;
  }
}
