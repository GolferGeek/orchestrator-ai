import { Controller, Param, Post, Req, Get, Query } from '@nestjs/common';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';

@Controller('api/agent-approvals')
export class AgentApprovalsController {
  constructor(private readonly approvals: HumanApprovalsRepository) {}

  @Get()
  async list(
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
    @Query('conversationId') conversationId?: string,
    @Query('agentSlug') agentSlug?: string,
  ) {
    const client = (this.approvals as any).client?.() || null;
    // Fallback to repository direct query pattern
    const c = (this.approvals as any).client();
    let q = c.from('human_approvals').select('*');
    if (status) q = q.eq('status', status);
    if (conversationId) q = q.eq('conversation_id', conversationId);
    if (agentSlug) q = q.eq('agent_slug', agentSlug);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw new Error(`Failed to list approvals: ${error.message}`);
    return { success: true, data: data || [] };
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId || null;
    const record = await this.approvals.setStatus(id, 'approved', userId);
    return { success: true, data: record };
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId || null;
    const record = await this.approvals.setStatus(id, 'rejected', userId);
    return { success: true, data: record };
  }
}
