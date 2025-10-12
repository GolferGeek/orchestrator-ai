import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { OrchestrationStatusService } from '../services/orchestration-status.service';

@Controller('api/orchestrations')
export class OrchestrationsController {
  constructor(private readonly statusService: OrchestrationStatusService) {}

  @Get(':runId/status')
  async getStatus(@Param('runId') runId: string) {
    const status = await this.statusService.getRunStatus(runId);
    if (!status) {
      throw new NotFoundException('Orchestration run not found');
    }

    return {
      success: true,
      data: status,
    };
  }
}
