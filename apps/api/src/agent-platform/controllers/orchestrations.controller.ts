import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrchestrationStatusService } from '../services/orchestration-status.service';
import { OrchestrationDashboardService } from '../services/orchestration-dashboard.service';
import {
  ListOrchestrationApprovalsQueryDto,
  ListOrchestrationsQueryDto,
  ResolveOrchestrationApprovalDto,
  RetryOrchestrationStepDto,
  SkipOrchestrationStepDto,
  AbortOrchestrationRunDto,
} from '../dto/orchestrations.dto';

@ApiTags('orchestrations')
@ApiBearerAuth('JWT-auth')
@Controller('api/orchestrations')
export class OrchestrationsController {
  constructor(
    private readonly statusService: OrchestrationStatusService,
    private readonly dashboardService: OrchestrationDashboardService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List orchestration runs for dashboard consumption.',
  })
  @ApiOkResponse({
    description: 'Paginated orchestration runs with summary metadata.',
  })
  async listRuns(@Query() query: ListOrchestrationsQueryDto) {
    const result = await this.dashboardService.listRuns({
      organizationSlug: query.organizationSlug ?? undefined,
      lifecycle: query.lifecycle,
      definitionId: query.definitionId ?? undefined,
      parentRunId: query.parentRunId ?? undefined,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
      startedAfter: query.startedAfter,
      startedBefore: query.startedBefore,
    });

    return {
      success: true,
      data: result,
    };
  }

  @Get('approvals')
  @ApiOperation({
    summary: 'List orchestration checkpoint approvals.',
  })
  @ApiOkResponse({
    description: 'Paginated orchestration approvals with run context.',
  })
  async listApprovals(@Query() query: ListOrchestrationApprovalsQueryDto) {
    const result = await this.dashboardService.listApprovals({
      organizationSlug: query.organizationSlug ?? undefined,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
      sortDirection: query.sortDirection,
    });

    return {
      success: true,
      data: result,
    };
  }

  @Post('approvals/:approvalId/decision')
  @ApiOperation({
    summary: 'Resolve an orchestration checkpoint approval.',
  })
  @ApiOkResponse({
    description: 'Updated approval and orchestration run summary.',
  })
  async resolveApproval(
    @Param('approvalId') approvalId: string,
    @Body() body: ResolveOrchestrationApprovalDto,
    @Req() req: any,
  ) {
    const actor =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId ??
      req.user?.user_id ??
      null;

    const result = await this.dashboardService.resolveApproval({
      approvalId,
      decision: body.decision,
      notes: body.notes ?? null,
      modifications: body.modifications,
      actorId: actor,
    });

    return {
      success: true,
      data: result,
    };
  }

  @Post(':runId/actions/retry')
  @ApiOperation({
    summary: 'Manually retry the most recent failed orchestration step.',
  })
  @ApiOkResponse({
    description:
      'Updated orchestration run summary after scheduling the retry.',
  })
  async retryFailedStep(
    @Param('runId') runId: string,
    @Body() body: RetryOrchestrationStepDto,
    @Req() req: any,
  ) {
    const actor =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId ??
      req.user?.user_id ??
      null;

    const summary = await this.dashboardService.retryStep({
      runId,
      stepRecordId: body.stepRecordId,
      delaySeconds: body.delaySeconds,
      modifications: body.modifications,
      note: body.note ?? null,
      actorId: actor,
    });

    return {
      success: true,
      data: summary,
    };
  }

  @Post(':runId/actions/skip')
  @ApiOperation({
    summary:
      'Manually skip a failed orchestration step and continue execution.',
  })
  @ApiOkResponse({
    description: 'Updated orchestration summary reflecting the skipped step.',
  })
  async skipFailedStep(
    @Param('runId') runId: string,
    @Body() body: SkipOrchestrationStepDto,
    @Req() req: any,
  ) {
    const actor =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId ??
      req.user?.user_id ??
      null;

    const summary = await this.dashboardService.skipStep({
      runId,
      stepRecordId: body.stepRecordId,
      note: body.note ?? null,
      replacementOutput: body.replacementOutput ?? undefined,
      actorId: actor,
    });

    return {
      success: true,
      data: summary,
    };
  }

  @Post(':runId/actions/abort')
  @ApiOperation({
    summary: 'Abort an orchestration run and mark it as terminated.',
  })
  @ApiOkResponse({
    description: 'Updated orchestration summary after aborting the run.',
  })
  async abortRun(
    @Param('runId') runId: string,
    @Body() body: AbortOrchestrationRunDto,
    @Req() req: any,
  ) {
    const actor =
      req.user?.sub ??
      req.user?.id ??
      req.user?.userId ??
      req.user?.user_id ??
      null;

    const summary = await this.dashboardService.abortRun({
      runId,
      note: body.note ?? null,
      actorId: actor,
    });

    return {
      success: true,
      data: summary,
    };
  }

  @Get(':runId/replay')
  @ApiOperation({
    summary: 'Retrieve replay payload for a completed orchestration run.',
  })
  @ApiOkResponse({
    description: 'Replay context containing parameters, plan, and results.',
  })
  async getReplayContext(@Param('runId') runId: string) {
    const context = await this.dashboardService.getReplayContext(runId);
    if (!context) {
      throw new NotFoundException('Orchestration run not found');
    }

    return {
      success: true,
      data: context,
    };
  }

  @Get(':runId')
  @ApiOperation({
    summary: 'Get full orchestration run detail including steps and approvals.',
  })
  @ApiOkResponse({
    description: 'Orchestration run detail payload.',
  })
  async getRun(@Param('runId') runId: string) {
    const detail = await this.dashboardService.getRunDetail(runId);
    if (!detail) {
      throw new NotFoundException('Orchestration run not found');
    }

    return {
      success: true,
      data: detail,
    };
  }

  @Get(':runId/status')
  @ApiOperation({
    summary: 'Get an orchestration run status snapshot.',
  })
  @ApiOkResponse({
    description: 'Current orchestration run status information.',
  })
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
