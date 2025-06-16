import { Controller, Post, Get, Body, Param, Logger, NotFoundException, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { SessionsService } from '../sessions/sessions.service';

@Controller('agents')
export class DynamicAgentsController {
  private readonly logger = new Logger(DynamicAgentsController.name);

  constructor(
    private readonly agentDiscovery: AgentDiscoveryService,
    private readonly sessionsService: SessionsService
  ) {}

  /**
   * Handle tasks for any discovered agent
   * Route: POST /agents/:agentType/:agentName/tasks
   */
  @Post(':agentType/:agentName/tasks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async handleTasks(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string,
    @Body() taskRequest: any,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any
  ) {
    this.logger.debug(`Processing task for ${agentType}/${agentName} for user ${currentUser.id}`);
    
    // Extract auth token from request
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    this.logger.debug(`Auth context: userId=${currentUser.id}, hasToken=${!!token}`);
    
    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Add user context to the task request
    const authenticatedTaskRequest = {
      ...taskRequest,
      currentUser,
      authToken: token
    };

    this.logger.debug(`Passing auth context to agent: currentUser=${!!authenticatedTaskRequest.currentUser}, authToken=${!!authenticatedTaskRequest.authToken}`);

    console.log(`🎯 CONTROLLER found agent instance for ${agentType}/${agentName}:`, agentInstance.constructor.name);
    console.log(`🎯 CONTROLLER calling processTask with request:`, JSON.stringify(authenticatedTaskRequest, null, 2));
    
    // Process the task using the agent's processTask method
    const result = await agentInstance.processTask(authenticatedTaskRequest);
    console.log(`🎯 CONTROLLER received result from processTask:`, JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Get agent card for any discovered agent
   * Route: GET /agents/:agentType/:agentName/.well-known/agent.json
   */
  @Get(':agentType/:agentName/.well-known/agent.json')
  async getAgentCard(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string
  ) {
    this.logger.debug(`Getting agent card for ${agentType}/${agentName}`);
    
    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the agent card
    return agentInstance.getAgentCard();
  }

  /**
   * Health check for any discovered agent
   * Route: GET /agents/:agentType/:agentName/health
   */
  @Get(':agentType/:agentName/health')
  async getAgentHealth(
    @Param('agentType') agentType: string,
    @Param('agentName') agentName: string
  ) {
    this.logger.debug(`Getting health status for ${agentType}/${agentName}`);
    
    // Find the agent instance
    const agentInstance = this.findAgentInstance(agentType, agentName);
    if (!agentInstance) {
      throw new NotFoundException(`Agent ${agentType}/${agentName} not found`);
    }

    // Get the health status if available
    if (agentInstance.getHealthStatus) {
      return agentInstance.getHealthStatus();
    }
    
    return { status: 'healthy', message: 'Agent is running' };
  }

  /**
   * Find an agent instance by type and name
   */
  private findAgentInstance(agentType: string, agentName: string): any {
    const discoveredAgents = this.agentDiscovery.getDiscoveredAgents();
    
    // Match the agent by type and name logic
    const agent = discoveredAgents.find(a => {
      const expectedName = this.normalizeAgentName(a.name);
      const providedName = this.normalizeAgentName(agentName);
      return a.type === agentType && expectedName === providedName;
    });
    
    return agent?.serviceInstance;
  }

  /**
   * Normalize agent name for comparison (handle underscores, spaces, etc.)
   */
  private normalizeAgentName(name: string): string {
    return name.toLowerCase().replace(/[\\s_-]+/g, '_');
  }
} 