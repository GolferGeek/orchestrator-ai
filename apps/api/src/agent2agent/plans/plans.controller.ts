import {
  Controller,
  Get,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlansService } from './services/plans.service';
import { PlanVersionsService } from './services/plan-versions.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly planVersionsService: PlanVersionsService,
  ) {}

  @Get('conversation/:conversationId')
  @ApiOperation({
    summary: 'Get plans by conversation ID',
    description:
      'Retrieves plan and all versions associated with a specific conversation',
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Plan retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid conversation ID format',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByConversation(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Req()
    req: {
      user?: { sub?: string; id?: string; userId?: string };
    },
  ): Promise<unknown> {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const plan = await this.plansService.findByConversationId(
      conversationId,
      userId,
    );

    if (!plan) {
      return null;
    }

    // Get all versions for the plan
    const versions = await this.planVersionsService.getVersionHistory(
      plan.id,
      userId,
    );

    return {
      ...plan,
      versions,
    };
  }
}
