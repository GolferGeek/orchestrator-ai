import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ObservabilityGateway } from './observability.gateway';
import { ObservabilityService } from './observability.service';
import type { HookEvent, HumanInTheLoopResponse } from '../types';

@Controller()
export class ObservabilityController {
  private readonly logger = new Logger(ObservabilityController.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly gateway: ObservabilityGateway,
    private readonly observabilityService: ObservabilityService,
  ) {}

  @Get()
  getRoot() {
    return 'Multi-Agent Observability Server';
  }

  @Post('hooks')
  @HttpCode(HttpStatus.OK)
  async handleHook(@Body() hookData: any) {
    try {
      const event: HookEvent = {
        source_app: hookData.source_app || hookData.sourceApp || 'unknown',
        session_id:
          hookData.session_id ||
          hookData.sessionId ||
          hookData.payload?.session_id ||
          'unknown',
        hook_event_type:
          hookData.event_type ||
          hookData.hook_event_type ||
          hookData.eventType ||
          'Unknown',
        payload: hookData.payload || hookData,
        timestamp: hookData.timestamp || Date.now(),
        summary: hookData.summary,
        chat: hookData.chat,
        model_name: hookData.model_name || hookData.modelName,
      };

      const savedEvent = await this.databaseService.insertEvent(event);
      this.gateway.broadcastEvent(savedEvent);

      return { success: true, id: savedEvent.id };
    } catch (error) {
      this.logger.error('Error processing hook:', error);
      // Always return 200 to not block hooks
      return { success: false, error: 'Failed to process hook' };
    }
  }

  @Post('events')
  async createEvent(@Body() event: HookEvent) {
    if (
      !event.source_app ||
      !event.session_id ||
      !event.hook_event_type ||
      !event.payload
    ) {
      throw new BadRequestException('Missing required fields');
    }

    const savedEvent = await this.databaseService.insertEvent(event);
    this.gateway.broadcastEvent(savedEvent);

    return savedEvent;
  }

  @Get('events/filter-options')
  async getFilterOptions() {
    return this.databaseService.getFilterOptions();
  }

  @Get('events/recent')
  async getRecentEvents(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 300;
    return this.databaseService.getRecentEvents(limitNum);
  }

  @Post('events/:id/respond')
  async respondToEvent(
    @Param('id') id: string,
    @Body() response: HumanInTheLoopResponse,
  ) {
    const eventId = parseInt(id);
    response.respondedAt = Date.now();

    const updatedEvent = await this.databaseService.updateEventHITLResponse(
      eventId,
      response,
    );

    if (!updatedEvent) {
      throw new NotFoundException('Event not found');
    }

    // Send response to agent via WebSocket
    if (updatedEvent.humanInTheLoop?.responseWebSocketUrl) {
      try {
        await this.observabilityService.sendResponseToAgent(
          updatedEvent.humanInTheLoop.responseWebSocketUrl,
          response,
        );
      } catch (error) {
        this.logger.error('Failed to send response to agent:', error);
        // Don't fail the request if we can't reach the agent
      }
    }

    // Broadcast updated event to all connected clients
    this.gateway.broadcastEvent(updatedEvent);

    return updatedEvent;
  }
}
