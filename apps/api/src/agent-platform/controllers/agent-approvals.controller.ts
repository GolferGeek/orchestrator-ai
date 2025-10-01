import { Controller, Param, Post, Req } from '@nestjs/common';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';

@Controller('agent-approvals')
export class AgentApprovalsController {
  constructor(private readonly approvals: HumanApprovalsRepository) {}

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

