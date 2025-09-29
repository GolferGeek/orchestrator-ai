import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AgentPoolService } from './agent-pool.service';
import {
  AgentRegistration,
  AgentHeartbeat,
  AgentCapabilitiesDocument,
  PoolStats,
} from './interfaces';

@ApiTags('Agent Pool Management')
@Controller('agent-pool')
export class AgentPoolController {
  private readonly logger = new Logger(AgentPoolController.name);

  constructor(private readonly agentPoolService: AgentPoolService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register an agent with the pool' })
  @ApiBody({ type: Object, description: 'Agent registration data' })
  @ApiResponse({
    status: 201,
    description: 'Agent registered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Agent registered successfully' },
        agentId: { type: 'string', example: 'specialist-blog-post' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async registerAgent(@Body() registration: AgentRegistration) {
    try {
      await this.agentPoolService.registerAgent(registration);

      return {
        success: true,
        message: 'Agent registered successfully',
        agentId: registration.id,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send heartbeat from an agent' })
  @ApiBody({ type: Object, description: 'Agent heartbeat data' })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat received successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Heartbeat received' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async receiveHeartbeat(@Body() heartbeat: AgentHeartbeat) {
    try {
      await this.agentPoolService.receiveHeartbeat(heartbeat);

      return {
        success: true,
        message: 'Heartbeat received',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete('unregister/:agentId')
  @ApiOperation({ summary: 'Unregister an agent from the pool' })
  @ApiResponse({
    status: 200,
    description: 'Agent unregistered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Agent unregistered successfully' },
        agentId: { type: 'string', example: 'specialist-blog-post' },
      },
    },
  })
  async unregisterAgent(@Param('agentId') agentId: string) {
    try {
      await this.agentPoolService.unregisterAgent(agentId);

      return {
        success: true,
        message: 'Agent unregistered successfully',
        agentId,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get all registered agents' })
  @ApiResponse({
    status: 200,
    description: 'List of all registered agents',
    type: [Object],
  })
  getRegisteredAgents(): AgentRegistration[] {
    return this.agentPoolService.getRegisteredAgents();
  }

  @Get('agents/online')
  @ApiOperation({ summary: 'Get all online agents' })
  @ApiResponse({
    status: 200,
    description: 'List of online agents',
    type: [Object],
  })
  getOnlineAgents(): AgentRegistration[] {
    return this.agentPoolService.getOnlineAgents();
  }

  @Get('agents/type/:type')
  @ApiOperation({ summary: 'Get agents by type' })
  @ApiResponse({
    status: 200,
    description: 'List of agents of specified type',
    type: [Object],
  })
  getAgentsByType(@Param('type') type: string): AgentRegistration[] {
    return this.agentPoolService.getAgentsByType(type);
  }

  @Get('agents/:agentId')
  @ApiOperation({ summary: 'Get specific agent by ID' })
  @ApiResponse({
    status: 200,
    description: 'Agent details',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  getAgent(@Param('agentId') agentId: string): AgentRegistration | null {
    const agent = this.agentPoolService.getAgent(agentId);
    if (!agent) {
      return null;
    }
    return agent;
  }

  @Get('capabilities')
  @ApiOperation({
    summary: 'Get comprehensive capabilities document for orchestrator',
  })
  @ApiResponse({
    status: 200,
    description: 'Complete capabilities document',
    type: Object,
  })
  getCapabilitiesDocument(): AgentCapabilitiesDocument {
    return this.agentPoolService.generateCapabilitiesDocument();
  }

  @Get('orchestration/agents')
  @ApiOperation({
    summary: 'Get orchestrator-friendly agent list for LLM prompts',
  })
  @ApiResponse({
    status: 200,
    description: 'Formatted agent list for LLM consumption',
    schema: {
      type: 'object',
      properties: {
        agentList: {
          type: 'string',
          description: 'Formatted agent capabilities for LLM prompts',
        },
        agentCount: { type: 'number', example: 5 },
        generatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getOrchestrationAgentList() {
    const agentList = this.agentPoolService.getOrchestrationAgentList();
    const onlineAgents = this.agentPoolService.getOnlineAgents();

    return {
      agentList,
      agentCount: onlineAgents.length,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get agent pool statistics' })
  @ApiResponse({
    status: 200,
    description: 'Pool statistics and health information',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 10 },
        online: { type: 'number', example: 8 },
        offline: { type: 'number', example: 2 },
        byType: {
          type: 'object',
          properties: {
            orchestrator: { type: 'number', example: 1 },
            specialist: { type: 'number', example: 5 },
            manager: { type: 'number', example: 2 },
            external: { type: 'number', example: 2 },
          },
        },
      },
    },
  })
  getPoolStats(): PoolStats {
    return this.agentPoolService.getPoolStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for agent pool service' })
  @ApiResponse({
    status: 200,
    description: 'Service health information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        poolSize: { type: 'number', example: 10 },
        onlineAgents: { type: 'number', example: 8 },
      },
    },
  })
  getHealth() {
    const stats = this.agentPoolService.getPoolStats();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      poolSize: stats.total,
      onlineAgents: stats.online,
    };
  }
}
