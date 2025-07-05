import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  Request,
} from '@nestjs/common';
import { OrchestratorService } from './agent-service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';

@Controller('orchestrator/ui')
@UseGuards(JwtAuthGuard)
export class OrchestratorController {
  private readonly logger = new Logger(OrchestratorController.name);

  constructor(private readonly orchestratorService: OrchestratorService) {}

  /**
   * Get available agents list for modal display
   * GET /orchestrator/ui/agents-list
   */
  @Get('agents-list')
  async getAgentsList(@CurrentUser() user: any, @Request() req: any) {
    this.logger.log('UI request for agents list modal');

    try {
      // Extract auth token from request
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.replace('Bearer ', '');

      // Refresh agents with current auth token
      await this.orchestratorService.initializeAvailableAgents(authToken);

      // Get structured agent list data for modal
      return this.orchestratorService.getAgentListForModal();
    } catch (error) {
      this.logger.error('Error getting agents list:', error);
      throw error;
    }
  }

  /**
   * Get specific agent capabilities for modal display
   * GET /orchestrator/ui/agent-capabilities/:agentName
   */
  @Get('agent-capabilities/:agentName')
  async getAgentCapabilities(
    @Param('agentName') agentName: string,
    @CurrentUser() user: any,
    @Request() req: any,
  ) {
    this.logger.log(`UI request for ${agentName} capabilities modal`);

    try {
      // Extract auth token from request
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.replace('Bearer ', '');

      // Refresh agents with current auth token
      await this.orchestratorService.initializeAvailableAgents(authToken);

      // Get structured agent capabilities data for modal
      return this.orchestratorService.getAgentCapabilitiesForModal(agentName);
    } catch (error) {
      this.logger.error(`Error getting capabilities for ${agentName}:`, error);
      throw error;
    }
  }
}
