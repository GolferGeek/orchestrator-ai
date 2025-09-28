import { Injectable, Logger } from '@nestjs/common';
import { ConversationPlansRepository } from '../repositories/conversation-plans.repository';
import { ConversationPlanRecord } from '../interfaces/conversation-plan-record.interface';

export interface GeneratePlanInput {
  conversationId: string;
  organizationSlug: string | null;
  agentSlug: string;
  summary?: string | null;
  draftPlan: Record<string, any>;
  createdBy?: string | null;
}

export interface UpdatePlanStatusInput {
  planId: string;
  status: string;
  summary?: string | null;
  updatedPlan?: Record<string, any>;
  approvedBy?: string | null;
}

@Injectable()
export class PlanEngineService {
  private readonly logger = new Logger(PlanEngineService.name);

  constructor(
    private readonly plansRepository: ConversationPlansRepository,
  ) {}

  async generateDraft(input: GeneratePlanInput): Promise<ConversationPlanRecord> {
    this.logger.debug(`Generating plan draft for ${input.agentSlug}`);

    return this.plansRepository.createDraft({
      conversation_id: input.conversationId,
      organization_slug: input.organizationSlug,
      agent_slug: input.agentSlug,
      summary: input.summary ?? null,
      plan_json: input.draftPlan,
      created_by: input.createdBy ?? null,
    });
  }

  async updateStatus(input: UpdatePlanStatusInput): Promise<ConversationPlanRecord> {
    this.logger.debug(`Updating plan ${input.planId} to status ${input.status}`);

    return this.plansRepository.updateStatus(input.planId, {
      status: input.status,
      summary: input.summary,
      plan_json: input.updatedPlan,
      approved_by: input.approvedBy,
    });
  }

  async getPlan(planId: string): Promise<ConversationPlanRecord | null> {
    return this.plansRepository.getById(planId);
  }

  async listPlans(conversationId: string): Promise<ConversationPlanRecord[]> {
    return this.plansRepository.listByConversation(conversationId);
  }
}
