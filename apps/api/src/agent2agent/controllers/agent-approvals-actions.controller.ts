import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { AgentExecutionGateway } from '../services/agent-execution-gateway.service';
import { HumanApprovalsRepository } from '@/agent-platform/repositories/human-approvals.repository';

@Controller('agent-to-agent')
export class AgentApprovalsActionsController {
  constructor(
    private readonly gateway: AgentExecutionGateway,
    private readonly approvals: HumanApprovalsRepository,
  ) {}

  /**
   * Approve a pending human gate and continue the stored Build request.
   * Optional body may provide overrides merged into the stored request payload (e.g., stream option).
   */
  @Post(':orgSlug/:agentSlug/approvals/:id/continue')
  async approveAndContinue(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body()
    body?: {
      options?: Record<string, any>;
      payload?: Record<string, any>;
      metadata?: Record<string, any>;
    },
  ) {
    const record = await this.approvals.get(id);
    if (!record) {
      throw new NotFoundException('Approval not found');
    }
    if (record.agent_slug !== agentSlug) {
      throw new NotFoundException('Approval does not belong to this agent');
    }
    if (record.organization_slug && record.organization_slug !== orgSlug) {
      throw new NotFoundException(
        'Approval does not belong to this organization',
      );
    }

    const userId = req.user?.sub || req.user?.id || req.user?.userId || null;
    await this.approvals.setStatus(id, 'approved', userId);

    // Rehydrate the stored request and allow minimal overrides
    const stored: any = (record.metadata as any)?.request || {};
    const request: any = {
      mode: 'build',
      conversationId:
        record.conversation_id ?? stored.conversationId ?? undefined,
      userMessage: stored.userMessage ?? undefined,
      payload: {
        ...(stored.payload || {}),
      },
      metadata: {
        ...(body?.metadata || {}),
      },
    };

    if (body?.payload) {
      request.payload = { ...(request.payload || {}), ...body.payload };
    }
    if (body?.options) {
      request.payload = request.payload || {};
      request.payload.options = {
        ...(request.payload.options || {}),
        ...body.options,
      };
    }
    // If caller provided a pre-supplied streamId in metadata, mirror it into payload.metadata for downstream consumers
    if (request.metadata?.streamId) {
      request.metadata.stream = Boolean(
        request.metadata.stream || body?.options?.stream,
      );
      request.payload = request.payload || {};
      request.payload.metadata = {
        ...(request.payload.metadata || {}),
        streamId: request.metadata.streamId,
      };
    }

    const response = await this.gateway.execute(
      record.organization_slug ?? orgSlug ?? null,
      agentSlug,
      request,
    );

    // Attach approval context to response metadata (avoid mutating readonly types)
    const resp = {
      ...response,
      payload: {
        ...(response as any).payload,
        metadata: {
          ...((response as any).payload?.metadata || {}),
          approvalId: id,
          approvalStatus: 'approved',
        },
      },
    };

    return resp as typeof response;
  }
}
