import { Injectable, Logger } from '@nestjs/common';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import {
  CreateDeliverableDto,
  DeliverableFormat,
  DeliverableType,
  DeliverableVersionCreationType,
} from '@/deliverables/dto';
import { AgentTaskMode, TaskRequestDto } from '@agent2agent/dto/task-request.dto';

export interface BuildDeliverableInput {
  organizationSlug: string | null;
  agentSlug: string;
  mode: AgentTaskMode;
  conversationId?: string;
  userId?: string | null;
  title?: string | null;
  content?: string | null;
}

@Injectable()
export class AgentRuntimeDeliverablesAdapter {
  private readonly logger = new Logger(AgentRuntimeDeliverablesAdapter.name);

  constructor(private readonly deliverables: DeliverablesService) {}

  async maybeCreateFromBuild(
    ctx: BuildDeliverableInput,
    request: TaskRequestDto,
  ): Promise<any | null> {
    try {
      if (ctx.mode !== AgentTaskMode.BUILD) return null;
      const userId = this.resolveUserId(request);
      const conversationId = ctx.conversationId;
      if (!userId || !conversationId) {
        return null;
      }

      const title =
        ctx.title || `Build output from ${ctx.agentSlug}`;
      const content = ctx.content || (request.payload as any)?.output || '';
      const dto: CreateDeliverableDto = {
        title,
        type: DeliverableType.DOCUMENT,
        conversationId,
        agentName: ctx.agentSlug,
        initialContent: content || undefined,
        initialFormat: DeliverableFormat.TEXT,
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: (request as any).taskId,
        initialMetadata: {
          organizationSlug: ctx.organizationSlug,
          agentSlug: ctx.agentSlug,
          mode: ctx.mode,
        },
      };

      const created = await this.deliverables.create(dto, userId);
      return created;
    } catch (error) {
      this.logger.warn(
        `Failed to auto-create deliverable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private resolveUserId(request: TaskRequestDto): string | null {
    // prefer top-level metadata, then payload.metadata
    const fromTop = request.metadata?.userId || request.metadata?.createdBy;
    const fromPayload = request.payload?.metadata?.userId || request.payload?.metadata?.createdBy;
    return (fromTop as string) || (fromPayload as string) || null;
  }
}

