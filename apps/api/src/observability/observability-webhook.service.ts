import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Observability event payload structure
 */
export interface ObservabilityEvent {
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  chat?: unknown[];
  summary?: string;
  model_name?: string;
  
  // Enriched fields
  userId?: string;
  username?: string; // display_name or email
  conversationId?: string;
  taskId?: string;
  agentSlug?: string;
  organizationSlug?: string;
  mode?: string;
}

/**
 * User cache entry
 */
interface UserCacheEntry {
  username: string;
  cachedAt: number;
}

/**
 * ObservabilityWebhookService
 * 
 * Centralized service for sending observability events to the observability server.
 * Features:
 * - Username resolution (display_name or email) with caching
 * - Automatic enrichment with userId, conversationId, taskId, etc.
 * - Non-blocking webhook calls (failures don't affect agent execution)
 * - Configurable observability server URL
 */
@Injectable()
export class ObservabilityWebhookService implements OnModuleInit {
  private readonly logger = new Logger(ObservabilityWebhookService.name);
  
  // In-memory cache for username lookups (userId -> username)
  // Cache TTL: 5 minutes
  private readonly userCache = new Map<string, UserCacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  // Observability server URL (configurable via env)
  private readonly observabilityUrl: string;
  
  constructor(
    private readonly httpService: HttpService,
    private readonly authService: AuthService,
  ) {
    // Default to Orchestrator AI API port (7100) if not configured
    // This sends events to observability endpoints within the Orchestrator AI API
    const apiPort = process.env.API_PORT || '7100';
    this.observabilityUrl = 
      process.env.OBSERVABILITY_SERVER_URL || 
      `http://localhost:${apiPort}`;
  }
  
  onModuleInit() {
    this.logger.log(
      `ObservabilityWebhookService initialized - sending events to ${this.observabilityUrl}`,
    );
  }
  
  /**
   * Resolve userId to username (display_name or email)
   * Uses caching to avoid repeated database lookups
   */
  private async resolveUsername(userId: string): Promise<string | undefined> {
    if (!userId) {
      return undefined;
    }
    
    // Check cache first
    const cached = this.userCache.get(userId);
    const now = Date.now();
    
    if (cached && (now - cached.cachedAt) < this.CACHE_TTL_MS) {
      return cached.username;
    }
    
    try {
      // Fetch user profile
      const profile = await this.authService.getUserProfile(userId);
      
      if (!profile) {
        this.logger.warn(`User profile not found for userId: ${userId}`);
        return undefined;
      }
      
      // Prefer display_name, fallback to email
      const username = profile.displayName || profile.email || 'Unknown User';
      
      // Cache the result
      this.userCache.set(userId, {
        username,
        cachedAt: now,
      });
      
      return username;
    } catch (error) {
      this.logger.error(
        `Failed to resolve username for userId ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [userId, entry] of this.userCache.entries()) {
      if ((now - entry.cachedAt) >= this.CACHE_TTL_MS) {
        this.userCache.delete(userId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired username cache entries`);
    }
  }
  
  /**
   * Send an observability event to the observability server
   * This is non-blocking - failures are logged but don't throw
   */
  async sendEvent(event: ObservabilityEvent): Promise<void> {
    // Clean up cache periodically (every 10th call)
    if (Math.random() < 0.1) {
      this.cleanupCache();
    }
    
    // Resolve username if userId is provided
    if (event.userId && !event.username) {
      event.username = await this.resolveUsername(event.userId);
    }
    
    // Ensure timestamp is set
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    try {
      const url = `${this.observabilityUrl}/hooks`;
      
      this.logger.debug(
        `Sending observability event: ${event.hook_event_type} for task ${event.taskId || 'N/A'}`,
      );
      
      await firstValueFrom(
        this.httpService.post(url, event, {
          timeout: 2000, // 2 second timeout - don't block
          validateStatus: () => true, // Accept any status
        }),
      );
      
      this.logger.debug(
        `✅ Observability event sent: ${event.hook_event_type} (task: ${event.taskId || 'N/A'})`,
      );
    } catch (error) {
      // Log but don't throw - observability failures shouldn't break agent execution
      this.logger.warn(
        `Failed to send observability event (non-blocking): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  
  /**
   * Convenience method: Emit agent execution started event
   */
  async emitAgentStarted(params: {
    userId: string;
    conversationId?: string;
    taskId: string;
    agentSlug: string;
    organizationSlug?: string;
    mode: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'agent.started',
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      agentSlug: params.agentSlug,
      organizationSlug: params.organizationSlug,
      mode: params.mode,
      payload: {
        ...params.payload,
        agentSlug: params.agentSlug,
        mode: params.mode,
      },
    });
  }
  
  /**
   * Convenience method: Emit agent execution completed event
   */
  async emitAgentCompleted(params: {
    userId: string;
    conversationId?: string;
    taskId: string;
    agentSlug: string;
    organizationSlug?: string;
    mode: string;
    success: boolean;
    result?: unknown;
    error?: string;
    duration?: number;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: params.conversationId || params.taskId,
      hook_event_type: params.success ? 'agent.completed' : 'agent.failed',
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      agentSlug: params.agentSlug,
      organizationSlug: params.organizationSlug,
      mode: params.mode,
      payload: {
        success: params.success,
        result: params.result,
        error: params.error,
        duration: params.duration,
        agentSlug: params.agentSlug,
        mode: params.mode,
      },
    });
  }
  
  /**
   * Convenience method: Emit agent progress event
   */
  async emitAgentProgress(params: {
    userId: string;
    conversationId?: string;
    taskId: string;
    agentSlug: string;
    organizationSlug?: string;
    mode: string;
    message: string;
    progress?: number;
    step?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: params.conversationId || params.taskId,
      hook_event_type: 'agent.progress',
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      agentSlug: params.agentSlug,
      organizationSlug: params.organizationSlug,
      mode: params.mode,
      payload: {
        message: params.message,
        progress: params.progress,
        step: params.step,
        ...params.metadata,
      },
    });
  }
  
  /**
   * Convenience method: Emit orchestration step event
   */
  async emitOrchestrationStep(params: {
    userId: string;
    conversationId?: string;
    taskId: string;
    orchestrationRunId: string;
    stepId: string;
    stepName: string;
    status: 'started' | 'completed' | 'failed';
    agentSlug?: string;
    error?: string;
    duration?: number;
  }): Promise<void> {
    await this.sendEvent({
      source_app: 'orchestrator-ai',
      session_id: params.conversationId || params.taskId,
      hook_event_type: `orchestration.step.${params.status}`,
      userId: params.userId,
      conversationId: params.conversationId,
      taskId: params.taskId,
      agentSlug: params.agentSlug,
      payload: {
        orchestrationRunId: params.orchestrationRunId,
        stepId: params.stepId,
        stepName: params.stepName,
        status: params.status,
        error: params.error,
        duration: params.duration,
      },
    });
  }
}

