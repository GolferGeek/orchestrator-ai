import { Injectable, Logger } from '@nestjs/common';
import { DeliverablesService } from '@/deliverables/deliverables.service';
import { DeliverableVersionsService } from '@/deliverables/deliverable-versions.service';
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
  titleTemplate?: string | null;
  deliverableType?: DeliverableType | string | null;
  deliverableFormat?: DeliverableFormat | string | null;
}

@Injectable()
export class AgentRuntimeDeliverablesAdapter {
  private readonly logger = new Logger(AgentRuntimeDeliverablesAdapter.name);

  constructor(
    private readonly deliverables: DeliverablesService,
    private readonly versions: DeliverableVersionsService,
  ) {}

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

      const baseTitle = ctx.title || `Build output from ${ctx.agentSlug}`;
      const content = ctx.content || (request.payload as any)?.output || '';
      const title = this.computeTitle(baseTitle, ctx);

      // Enhancement path: if a target deliverableId is provided, create a new version instead
      const targetDeliverableId =
        (request.payload as any)?.deliverableId ||
        (request.payload as any)?.metadata?.deliverableId;
      if (targetDeliverableId) {
        const version = await this.versions.createVersion(targetDeliverableId, {
          content,
          format: this.coerceDeliverableFormat(ctx.deliverableFormat) ?? DeliverableFormat.TEXT,
          createdByType: DeliverableVersionCreationType.AI_ENHANCEMENT,
          taskId: (request as any).taskId,
          metadata: {
            organizationSlug: ctx.organizationSlug,
            agentSlug: ctx.agentSlug,
            mode: ctx.mode,
          },
        }, userId);
        return { kind: 'version', deliverableId: targetDeliverableId, version };
      }
      const dto: CreateDeliverableDto = {
        title,
        type: this.coerceDeliverableType(ctx.deliverableType) ?? DeliverableType.DOCUMENT,
        conversationId,
        agentName: ctx.agentSlug,
        initialContent: content || undefined,
        initialFormat: this.coerceDeliverableFormat(ctx.deliverableFormat) ?? DeliverableFormat.TEXT,
        initialCreationType: DeliverableVersionCreationType.AI_RESPONSE,
        initialTaskId: (request as any).taskId,
        initialMetadata: {
          organizationSlug: ctx.organizationSlug,
          agentSlug: ctx.agentSlug,
          mode: ctx.mode,
        },
      };

      const deliverable = await this.deliverables.create(dto, userId);
      return { kind: 'deliverable', deliverable };
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

  private computeTitle(defaultTitle: string, ctx: BuildDeliverableInput): string {
    const template = ctx.titleTemplate?.trim();
    if (!template) {
      return defaultTitle;
    }
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return template
      .replaceAll('{agent}', ctx.agentSlug)
      .replaceAll('{date}', date)
      .replaceAll('{conversation}', String(ctx.conversationId ?? ''))
      .replaceAll('{title}', defaultTitle);
  }

  private coerceDeliverableType(value?: DeliverableType | string | null): DeliverableType | undefined {
    if (!value) return undefined;
    if (Object.values(DeliverableType).includes(value as DeliverableType)) return value as DeliverableType;
    const s = String(value).toLowerCase();
    switch (s) {
      case 'document':
        return DeliverableType.DOCUMENT;
      case 'analysis':
        return DeliverableType.ANALYSIS;
      case 'report':
        return DeliverableType.REPORT;
      case 'plan':
        return DeliverableType.PLAN;
      case 'requirements':
        return DeliverableType.REQUIREMENTS;
      default:
        return undefined;
    }
  }

  private coerceDeliverableFormat(value?: DeliverableFormat | string | null): DeliverableFormat | undefined {
    if (!value) return undefined;
    if (Object.values(DeliverableFormat).includes(value as DeliverableFormat)) return value as DeliverableFormat;
    const s = String(value).toLowerCase();
    switch (s) {
      case 'markdown':
        return DeliverableFormat.MARKDOWN;
      case 'text':
        return DeliverableFormat.TEXT;
      case 'json':
        return DeliverableFormat.JSON;
      case 'html':
        return DeliverableFormat.HTML;
      default:
        return undefined;
    }
  }
}
