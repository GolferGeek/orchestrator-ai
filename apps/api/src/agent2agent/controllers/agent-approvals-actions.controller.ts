import { Body, Controller, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AgentExecutionGateway } from '../services/agent-execution-gateway.service';
import { HumanApprovalsRepository } from '@/agent-platform/repositories/human-approvals.repository';
import { ApiKeyGuard } from '../guards/api-key.guard';

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
  @UseGuards(ApiKeyGuard)
  async approveAndContinue(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() body?: { options?: Record<string, any>; payload?: Record<string, any> },
  ) {
    const record = await this.approvals.get(id);
    if (!record) {
      throw new NotFoundException('Approval not found');
    }
    if (record.agent_slug !== agentSlug) {
      throw new NotFoundException('Approval does not belong to this agent');
    }
    if (record.organization_slug && record.organization_slug !== orgSlug) {
      throw new NotFoundException('Approval does not belong to this organization');
    }

    const userId = req.user?.sub || req.user?.id || req.user?.userId || null;
    await this.approvals.setStatus(id, 'approved', userId);

    // Rehydrate the stored request and allow minimal overrides
    const stored: any = (record.metadata as any)?.request || {};
    const request: any = {
      mode: 'build',
      conversationId: record.conversation_id ?? stored.conversationId ?? undefined,
      userMessage: stored.userMessage ?? undefined,
      payload: {
        ...(stored.payload || {}),
      },
    };

    if (body?.payload) {
      request.payload = { ...(request.payload || {}), ...body.payload };
    }
    if (body?.options) {
      request.payload = request.payload || {};
      request.payload.options = { ...(request.payload.options || {}), ...body.options };
    }

    const response = await this.gateway.execute(
      record.organization_slug ?? orgSlug ?? null,
      agentSlug,
      request,
    );

    // Attach approval context to response metadata for client convenience
    response.payload = response.payload || {};
    response.payload.metadata = {
      ...(response.payload.metadata || {}),
      approvalId: id,
      approvalStatus: 'approved',
    };

    return response;
  }
}
