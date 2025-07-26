/**
 * MCP Pool Controller
 * 
 * REST API endpoints for MCP (Model Context Protocol) pool management,
 * discovery, and orchestration. Mirrors AgentPoolController architecture.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MCPPoolService } from './mcp-pool.service';
import {
  MCPRegistration,
  MCPHeartbeat,
  MCPCapabilitiesDocument,
  MCPPoolStats,
  MCPDiscoveryResult,
  MCPExecutionRequest,
  MCPExecutionResult,
} from './interfaces';

@ApiTags('MCP Pool Management')
@Controller('mcp-pool')
export class MCPPoolController {
  private readonly logger = new Logger(MCPPoolController.name);

  constructor(private readonly mcpPoolService: MCPPoolService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register an MCP service with the pool' })
  @ApiBody({ type: Object, description: 'MCP registration data' })
  @ApiResponse({
    status: 201,
    description: 'MCP service registered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'MCP service registered successfully' },
        mcpId: { type: 'string', example: 'supabase-mcp' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async registerMCP(@Body() registration: MCPRegistration) {
    try {
      await this.mcpPoolService.registerMCP(registration);

      this.logger.log(`MCP ${registration.id} registered via API`);

      return {
        success: true,
        message: 'MCP service registered successfully',
        mcpId: registration.id,
      };
    } catch (error) {
      this.logger.error(`Error registering MCP ${registration.id}:`, error);
      throw error;
    }
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send heartbeat from an MCP service' })
  @ApiBody({ type: Object, description: 'MCP heartbeat data' })
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
  @ApiResponse({ status: 404, description: 'MCP service not found' })
  async receiveHeartbeat(@Body() heartbeat: MCPHeartbeat) {
    try {
      await this.mcpPoolService.receiveHeartbeat(heartbeat);

      this.logger.debug(`Heartbeat received from ${heartbeat.mcpId} via API`);

      return {
        success: true,
        message: 'Heartbeat received',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error processing heartbeat from ${heartbeat.mcpId}:`,
        error,
      );
      throw error;
    }
  }

  @Delete('unregister/:mcpId')
  @ApiOperation({ summary: 'Unregister an MCP service from the pool' })
  @ApiParam({ name: 'mcpId', description: 'MCP service identifier' })
  @ApiResponse({
    status: 200,
    description: 'MCP service unregistered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'MCP service unregistered successfully' },
        mcpId: { type: 'string', example: 'supabase-mcp' },
      },
    },
  })
  async unregisterMCP(@Param('mcpId') mcpId: string) {
    try {
      await this.mcpPoolService.unregisterMCP(mcpId);

      this.logger.log(`MCP ${mcpId} unregistered via API`);

      return {
        success: true,
        message: 'MCP service unregistered successfully',
        mcpId,
      };
    } catch (error) {
      this.logger.error(`Error unregistering MCP ${mcpId}:`, error);
      throw error;
    }
  }

  @Get('mcps')
  @ApiOperation({ summary: 'Get all registered MCP services' })
  @ApiResponse({
    status: 200,
    description: 'List of all registered MCP services',
    type: [Object],
  })
  getRegisteredMCPs(): MCPRegistration[] {
    return this.mcpPoolService.getRegisteredMCPs();
  }

  @Get('mcps/online')
  @ApiOperation({ summary: 'Get all online MCP services' })
  @ApiResponse({
    status: 200,
    description: 'List of online MCP services',
    type: [Object],
  })
  getOnlineMCPs(): MCPRegistration[] {
    return this.mcpPoolService.getOnlineMCPs();
  }

  @Get('mcps/type/:type')
  @ApiOperation({ summary: 'Get MCP services by type' })
  @ApiParam({ name: 'type', description: 'MCP service type (database, api, file, etc.)' })
  @ApiResponse({
    status: 200,
    description: 'List of MCP services of specified type',
    type: [Object],
  })
  getMCPsByType(@Param('type') type: string): MCPRegistration[] {
    return this.mcpPoolService.getMCPsByType(type);
  }

  @Get('mcps/provider/:provider')
  @ApiOperation({ summary: 'Get MCP services by provider' })
  @ApiParam({ name: 'provider', description: 'MCP service provider (supabase, google, etc.)' })
  @ApiResponse({
    status: 200,
    description: 'List of MCP services from specified provider',
    type: [Object],
  })
  getMCPsByProvider(@Param('provider') provider: string): MCPRegistration[] {
    return this.mcpPoolService.getMCPsByProvider(provider);
  }

  @Get('mcps/:mcpId')
  @ApiOperation({ summary: 'Get specific MCP service by ID' })
  @ApiParam({ name: 'mcpId', description: 'MCP service identifier' })
  @ApiResponse({
    status: 200,
    description: 'MCP service details',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'MCP service not found' })
  getMCP(@Param('mcpId') mcpId: string): MCPRegistration | null {
    const mcp = this.mcpPoolService.getMCP(mcpId);
    if (!mcp) {
      return null;
    }
    return mcp;
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute a tool on an MCP service' })
  @ApiBody({ type: Object, description: 'MCP tool execution request' })
  @ApiResponse({
    status: 200,
    description: 'Tool execution result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'object', description: 'Tool execution result data' },
        executionTime: { type: 'number', example: 1250 },
        mcpId: { type: 'string', example: 'supabase-mcp' },
        toolName: { type: 'string', example: 'generate-sql' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        executionId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid execution request' })
  @ApiResponse({ status: 404, description: 'MCP service or tool not found' })
  @ApiResponse({ status: 503, description: 'MCP service unavailable' })
  async executeMCPTool(@Body() request: MCPExecutionRequest): Promise<MCPExecutionResult> {
    try {
      const result = await this.mcpPoolService.executeMCPTool(request);
      
      this.logger.log(
        `MCP tool executed: ${request.mcpId}:${request.toolName} (${result.success ? 'success' : 'failed'}) in ${result.executionTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error executing MCP tool ${request.mcpId}:${request.toolName}:`,
        error,
      );
      throw error;
    }
  }

  @Post('discover')
  @ApiOperation({ summary: 'Trigger MCP service discovery' })
  @ApiResponse({
    status: 200,
    description: 'Discovery results',
    schema: {
      type: 'object',
      properties: {
        discovered: { type: 'array', items: { type: 'object' } },
        errors: { type: 'array', items: { type: 'object' } },
        discoveredAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        totalFound: { type: 'number', example: 3 },
        successfulRegistrations: { type: 'number', example: 2 },
      },
    },
  })
  async discoverMCPServices(): Promise<MCPDiscoveryResult> {
    try {
      const result = await this.mcpPoolService.discoverMCPServices();
      
      this.logger.log(
        `MCP discovery triggered via API: ${result.totalFound} found, ${result.successfulRegistrations} registered`,
      );

      return result;
    } catch (error) {
      this.logger.error('Error during MCP service discovery:', error);
      throw error;
    }
  }

  @Get('capabilities')
  @ApiOperation({
    summary: 'Get comprehensive capabilities document for orchestrator',
  })
  @ApiResponse({
    status: 200,
    description: 'Complete MCP capabilities document',
    type: Object,
  })
  getCapabilitiesDocument(): MCPCapabilitiesDocument {
    return this.mcpPoolService.generateCapabilitiesDocument();
  }

  @Get('orchestration/mcps')
  @ApiOperation({
    summary: 'Get orchestrator-friendly MCP list for LLM prompts',
  })
  @ApiResponse({
    status: 200,
    description: 'Formatted MCP list for LLM consumption',
    schema: {
      type: 'object',
      properties: {
        mcpList: {
          type: 'string',
          description: 'Formatted MCP capabilities for LLM prompts',
        },
        mcpCount: { type: 'number', example: 3 },
        toolCount: { type: 'number', example: 12 },
        generatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getOrchestrationMCPList() {
    const mcpList = this.mcpPoolService.getOrchestrationMCPList();
    const stats = this.mcpPoolService.getPoolStats();

    return {
      mcpList,
      mcpCount: stats.online,
      toolCount: stats.totalTools,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get MCP pool statistics' })
  @ApiResponse({
    status: 200,
    description: 'Pool statistics and health information',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 5 },
        online: { type: 'number', example: 4 },
        offline: { type: 'number', example: 1 },
        discovering: { type: 'number', example: 0 },
        byType: {
          type: 'object',
          properties: {
            database: { type: 'number', example: 2 },
            api: { type: 'number', example: 1 },
            file: { type: 'number', example: 1 },
            communication: { type: 'number', example: 1 },
            computation: { type: 'number', example: 0 },
            external: { type: 'number', example: 0 },
          },
        },
        byProvider: {
          type: 'object',
          additionalProperties: { type: 'number' },
          example: { supabase: 1, google: 1, internal: 3 },
        },
        totalTools: { type: 'number', example: 23 },
        totalCapabilities: { type: 'number', example: 15 },
        healthScore: { type: 'number', example: 80 },
      },
    },
  })
  getPoolStats(): MCPPoolStats {
    return this.mcpPoolService.getPoolStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for MCP pool service' })
  @ApiResponse({
    status: 200,
    description: 'Service health information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        poolSize: { type: 'number', example: 5 },
        onlineMCPs: { type: 'number', example: 4 },
        healthScore: { type: 'number', example: 80 },
        discovery: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', example: true },
            lastRun: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  getHealth() {
    const stats = this.mcpPoolService.getPoolStats();

    return {
      status: stats.healthScore >= 70 ? 'healthy' : stats.healthScore >= 40 ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      poolSize: stats.total,
      onlineMCPs: stats.online,
      healthScore: stats.healthScore,
      discovery: {
        enabled: true, // This would come from config in real implementation
        lastRun: new Date().toISOString(), // This would be tracked in the service
      },
    };
  }

  @Get('tools')
  @ApiOperation({ summary: 'Get all available tools across all MCP services' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by MCP type' })
  @ApiQuery({ name: 'provider', required: false, description: 'Filter by provider' })
  @ApiResponse({
    status: 200,
    description: 'List of all available MCP tools',
    schema: {
      type: 'object',
      properties: {
        tools: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'generate-sql' },
              mcpId: { type: 'string', example: 'supabase-mcp' },
              mcpName: { type: 'string', example: 'Supabase Database MCP' },
              description: { type: 'string', example: 'Generate SQL queries from natural language' },
              parameters: { type: 'object' },
              category: { type: 'string', example: 'data' },
            },
          },
        },
        totalTools: { type: 'number', example: 23 },
        mcpsIncluded: { type: 'number', example: 4 },
      },
    },
  })
  getAllTools(
    @Query('type') type?: string,
    @Query('provider') provider?: string,
  ) {
    let mcps = this.mcpPoolService.getOnlineMCPs();

    // Apply filters
    if (type) {
      mcps = mcps.filter(mcp => mcp.type === type);
    }
    if (provider) {
      mcps = mcps.filter(mcp => mcp.provider === provider);
    }

    // Flatten all tools with MCP context
    const tools = mcps.flatMap(mcp =>
      mcp.tools.map(tool => ({
        name: tool.name,
        mcpId: mcp.id,
        mcpName: mcp.name,
        description: tool.description,
        parameters: tool.parameters,
        category: mcp.capabilities.find(cap => cap.tools.includes(tool.name))?.category || 'other',
      }))
    );

    return {
      tools,
      totalTools: tools.length,
      mcpsIncluded: mcps.length,
    };
  }
}