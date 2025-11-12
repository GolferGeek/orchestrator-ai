import { Controller, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowRequestDto } from '../common/dto/workflow-request.dto';
import { WorkflowResponseDto } from '../common/dto/workflow-response.dto';

@Controller('workflows')
export class WorkflowsController {
  private readonly logger = new Logger(WorkflowsController.name);

  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('marketing-swarm')
  @HttpCode(HttpStatus.OK)
  async executeMarketingSwarm(@Body() request: WorkflowRequestDto): Promise<WorkflowResponseDto> {
    this.logger.log(`Executing marketing-swarm workflow for task ${request.taskId}`);

    const startTime = Date.now();
    const result = await this.workflowsService.executeMarketingSwarm(request);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      taskId: request.taskId,
      conversationId: request.conversationId,
      data: result.result!,
      metadata: {
        executionTime,
        stepsCompleted: 3,
        provider: request.provider,
        model: request.model,
      },
    };
  }

  @Post('requirements-writer')
  @HttpCode(HttpStatus.OK)
  async executeRequirementsWriter(@Body() request: WorkflowRequestDto): Promise<WorkflowResponseDto> {
    this.logger.log(`Executing requirements-writer workflow for task ${request.taskId}`);

    const startTime = Date.now();
    const result = await this.workflowsService.executeRequirementsWriter(request);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      taskId: request.taskId,
      conversationId: request.conversationId,
      data: result.result!,
      metadata: {
        executionTime,
        stepsCompleted: 6,
        provider: request.provider,
        model: request.model,
      },
    };
  }

  @Post('metrics-agent')
  @HttpCode(HttpStatus.OK)
  async executeMetricsAgent(@Body() request: WorkflowRequestDto): Promise<WorkflowResponseDto> {
    this.logger.log(`Executing metrics-agent workflow for task ${request.taskId}`);

    const startTime = Date.now();
    const result = await this.workflowsService.executeMetricsAgent(request);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      taskId: request.taskId,
      conversationId: request.conversationId,
      data: result.result!,
      metadata: {
        executionTime,
        stepsCompleted: 2,
        provider: request.provider,
        model: request.model,
      },
    };
  }
}
