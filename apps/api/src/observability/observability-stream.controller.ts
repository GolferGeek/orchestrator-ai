import { Controller, Get, Res, UseGuards, Logger, Query } from '@nestjs/common';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/decorators/roles.decorator';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Observability Stream Controller
 *
 * Provides admin-only SSE endpoint for real-time monitoring of all agent executions.
 * Broadcasts all observability events to connected admin clients.
 *
 * Endpoint: GET /observability/stream
 * Auth: Requires admin role
 * Response: Server-Sent Events stream
 */
@Controller('observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ObservabilityStreamController {
  private readonly logger = new Logger(ObservabilityStreamController.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Stream all observability events to admin clients
   * GET /observability/stream
   *
   * Optional query params for filtering (client-side filtering is preferred):
   * - userId: Filter by user ID
   * - agentSlug: Filter by agent
   * - conversationId: Filter by conversation
   */
  @Get('stream')
  async streamEvents(
    @Res() response: Response,
    @Query('userId') userId?: string,
    @Query('agentSlug') agentSlug?: string,
    @Query('conversationId') conversationId?: string,
  ): Promise<void> {
    this.logger.log('🔌 Admin connected to observability stream');

    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send recent events on connection (last 100 events)
    try {
      const { data: recentEvents, error } = await this.supabaseService
        .getServiceClient()
        .from('observability_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        this.logger.error('Failed to fetch recent events:', error);
      } else if (recentEvents && recentEvents.length > 0) {
        // Send recent events in chronological order (oldest first)
        for (const event of recentEvents.reverse()) {
          response.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        this.logger.log(`📦 Sent ${recentEvents.length} recent events to admin`);
      }
    } catch (error) {
      this.logger.error('Error sending recent events:', error);
    }

    // Create event listener for new events
    const eventListener = (eventData: Record<string, unknown>) => {
      // Optional server-side filtering (client-side preferred)
      if (userId && eventData.user_id !== userId) {
        return;
      }
      if (agentSlug && eventData.agent_slug !== agentSlug) {
        return;
      }
      if (conversationId && eventData.conversation_id !== conversationId) {
        return;
      }

      // Send event to admin client
      try {
        response.write(`data: ${JSON.stringify(eventData)}\n\n`);
      } catch (error) {
        this.logger.error('Failed to write event to stream:', error);
      }
    };

    // Subscribe to observability events
    this.eventEmitter.on('observability.event', eventListener);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        response.write(': heartbeat\n\n');
      } catch (error) {
        this.logger.warn('Failed to send heartbeat, client disconnected');
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Handle client disconnect
    response.on('close', () => {
      this.logger.log('🔌 Admin disconnected from observability stream');
      clearInterval(heartbeatInterval);
      this.eventEmitter.off('observability.event', eventListener);
      response.end();
    });
  }
}

