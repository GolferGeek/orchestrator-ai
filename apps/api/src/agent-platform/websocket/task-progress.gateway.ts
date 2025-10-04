import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  TaskProgressEvent,
  WorkflowStepProgressEvent,
} from '@/agent2agent/types/agent-conversations.types';
import {
  AgentStreamChunkEvent,
  AgentStreamCompleteEvent,
  AgentStreamErrorEvent,
} from '@/agent-platform/services/agent-runtime-stream.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  subscribedTasks?: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://localhost:5173',
      // Development ports
      'http://localhost:7101',
      'http://127.0.0.1:7101',
      'http://localhost:7201',
      'http://127.0.0.1:7201',
      'http://localhost:7202',
      'http://127.0.0.1:7202',
      'http://localhost:9002',
      'http://127.0.0.1:9002',
      'http://localhost:9003',
      'http://127.0.0.1:9003',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3100',
      'http://127.0.0.1:3100',
      'http://localhost:3101',
      'http://127.0.0.1:3101',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      // Production domains
      'https://orchestratorai.io',
      'https://app.orchestratorai.io',
      'https://api.orchestratorai.io',
      'http://orchestratorai.io',
      'http://app.orchestratorai.io',
      'http://api.orchestratorai.io',
    ],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/task-progress',
  transports: ['polling', 'websocket'],
})
export class TaskProgressGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TaskProgressGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(private readonly supabaseService: SupabaseService) {}

  afterInit(_server: Server) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        client.userId = 'anonymous';
        client.subscribedTasks = new Set();
        this.connectedClients.set(client.id, client);

        return;
      }

      // Verify and decode token using Supabase
      const supabaseClient = this.supabaseService.getAnonClient();
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        client.userId = 'anonymous';
        client.subscribedTasks = new Set();
        this.connectedClients.set(client.id, client);

        return;
      }

      client.userId = user.id;
      client.subscribedTasks = new Set();

      // Store client connection
      this.connectedClients.set(client.id, client);

      // Join user-specific room
      void client.join(`user:${client.userId}`);
    } catch {
      // Allow anonymous connection as fallback
      client.userId = 'anonymous';
      client.subscribedTasks = new Set();
      this.connectedClients.set(client.id, client);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
  }

  /**
   * Subscribe to task progress updates
   */
  @SubscribeMessage('subscribe_task')
  async handleTaskSubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    // Allow subscription without authentication for development/testing
    if (!client.userId) {
      // Set a temporary user ID for unauthenticated clients
      client.userId = 'anonymous';
    }

    try {
      // TODO: Verify that user owns this task
      // For now, we'll allow any client to subscribe to any task

      client.subscribedTasks?.add(data.taskId);
      void client.join(`task:${data.taskId}`);

      // Check room immediately after joining
      setTimeout(() => {
        const roomClients = this.server?.sockets?.adapter?.rooms?.get(
          `task:${data.taskId}`,
        );
        const clientCount = roomClients ? roomClients.size : 0;

        if (clientCount === 0) {
          const _allRooms = Array.from(
            this.server?.sockets?.adapter?.rooms?.keys() || [],
          );

          const _clientRooms = Array.from(client.rooms || []);
        }
      }, 100); // Small delay to let room join complete

      client.emit('subscription_confirmed', { taskId: data.taskId });
    } catch {
      client.emit('subscription_error', {
        taskId: data.taskId,
        message: 'Failed to subscribe to task',
      });
    }
  }

  @SubscribeMessage('subscribe_stream')
  handleStreamSubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { streamId: string },
  ) {
    if (!data?.streamId) {
      client.emit('subscription_error', {
        streamId: data?.streamId,
        message: 'streamId is required',
      });
      return;
    }

    void client.join(`stream:${data.streamId}`);
    client.emit('subscription_confirmed', { streamId: data.streamId });
  }

  @SubscribeMessage('unsubscribe_stream')
  handleStreamUnsubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { streamId: string },
  ) {
    if (data?.streamId) {
      void client.leave(`stream:${data.streamId}`);
    }
    client.emit('unsubscription_confirmed', { streamId: data?.streamId });
  }

  /**
   * Unsubscribe from task progress updates
   */
  @SubscribeMessage('unsubscribe_task')
  async handleTaskUnsubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    client.subscribedTasks?.delete(data.taskId);
    void client.leave(`task:${data.taskId}`);

    client.emit('unsubscription_confirmed', { taskId: data.taskId });
  }

  /**
   * Handle task progress events from EventEmitter
   */
  @OnEvent('task.progress')
  handleTaskProgress(event: TaskProgressEvent) {
    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${event.taskId}`).emit('task_progress', event);
  }

  @OnEvent('agent.stream.chunk')
  handleAgentStreamChunk(event: AgentStreamChunkEvent) {
    this.server.to(`stream:${event.streamId}`).emit('agent_stream_chunk', event);

    if (event.conversationId) {
      this.server
        .to(`conversation:${event.conversationId}`)
        .emit('agent_stream_chunk', event);
    }

    if (event.orchestrationRunId) {
      this.server
        .to(`run:${event.orchestrationRunId}`)
        .emit('agent_stream_chunk', event);
    }
  }

  @OnEvent('agent.stream.complete')
  handleAgentStreamComplete(event: AgentStreamCompleteEvent) {
    const payload = { ...event, type: 'complete' as const };
    this.server.to(`stream:${event.streamId}`).emit('agent_stream_complete', payload);

    if (event.conversationId) {
      this.server
        .to(`conversation:${event.conversationId}`)
        .emit('agent_stream_complete', payload);
    }

    if (event.orchestrationRunId) {
      this.server
        .to(`run:${event.orchestrationRunId}`)
        .emit('agent_stream_complete', payload);
    }
  }

  @OnEvent('agent.stream.error')
  handleAgentStreamError(event: AgentStreamErrorEvent) {
    const payload = { ...event, type: 'error' as const };
    this.server.to(`stream:${event.streamId}`).emit('agent_stream_error', payload);

    if (event.conversationId) {
      this.server
        .to(`conversation:${event.conversationId}`)
        .emit('agent_stream_error', payload);
    }

    if (event.orchestrationRunId) {
      this.server
        .to(`run:${event.orchestrationRunId}`)
        .emit('agent_stream_error', payload);
    }
  }

  /**
   * Broadcast workflow step progress updates
   */
  broadcastWorkflowStepProgress(
    taskId: string,
    stepName: string,
    stepIndex: number,
    totalSteps: number,
    status: string,
    message?: string,
  ) {
    const event: WorkflowStepProgressEvent = {
      taskId,
      stepName,
      stepIndex,
      totalSteps,
      status,
      message,
    };

    // Check how many clients are in the room (with null safety)
    let clientCount = 0;
    let roomClients;
    try {
      roomClients = this.server?.sockets?.adapter?.rooms?.get(`task:${taskId}`);
      clientCount = roomClients ? roomClients.size : 0;
    } catch {
      // Failed to get room client count
    }

    if (clientCount === 0) {
      // Log all current rooms to debug
      const _allRooms = Array.from(
        this.server?.sockets?.adapter?.rooms?.keys() || [],
      );
    }

    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${taskId}`).emit('workflow_step_progress', event);
  }

  /**
   * Broadcast task completion updates
   */
  broadcastTaskCompletion(taskId: string, status: string, message?: string) {
    const event = {
      taskId,
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    // Check how many clients are in the room (with null safety)
    let _clientCount = 0;
    try {
      const roomClients = this.server?.sockets?.adapter?.rooms?.get(
        `task:${taskId}`,
      );
      _clientCount = roomClients ? roomClients.size : 0;
    } catch {
      // Failed to get room client count
    }

    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${taskId}`).emit('task_completed', event);
  }

  /**
   * Broadcast task completion with full response content
   */
  broadcastTaskCompletionWithResponse(
    taskId: string,
    status: string,
    message?: string,
    response?: string,
    metadata?: any,
  ) {
    const event = {
      taskId,
      status,
      message,
      response,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Check how many clients are in the room (with null safety)
    let _clientCount = 0;
    try {
      const roomClients = this.server?.sockets?.adapter?.rooms?.get(
        `task:${taskId}`,
      );
      _clientCount = roomClients ? roomClients.size : 0;
    } catch {
      // Failed to get room client count
    }

    // Broadcast to all clients subscribed to this task with full response
    this.server
      .to(`task:${taskId}`)
      .emit('task_completed_with_response', event);
  }

  /**
   * Handle task creation events
   */
  @OnEvent('task.created')
  handleTaskCreated(event: {
    taskId: string;
    conversationId: string;
    userId: string;
    agentName: string;
  }) {
    // Broadcast to user's room
    this.server.to(`user:${event.userId}`).emit('task_created', event);
  }

  /**
   * Handle flexible task status changes with JSON data (from TaskStatusService)
   */
  @OnEvent('task.status_changed')
  handleTaskStatusChanged(event: {
    taskId: string;
    userId: string;
    status: string;
    progress: number;
    message?: string;
    data: any; // Full JSON status object with agent-specific data
  }) {
    // Broadcast to task room and user room with full JSON data
    this.server.to(`task:${event.taskId}`).emit('task_status_changed', event);
    this.server.to(`user:${event.userId}`).emit('task_status_changed', event);
  }

  /**
   * Handle task completion events
   * Note: WebSocket broadcasting is handled by broadcastTaskCompletion() method to avoid duplicates
   */
  @OnEvent('task.completed')
  handleTaskCompleted(_event: { taskId: string; userId: string }) {
    // Don't emit WebSocket events here - broadcastTaskCompletion() already handles this
    // to prevent duplicate task_completed events that cause multiple frontend completion handlers
  }

  /**
   * Handle task failure events
   */
  @OnEvent('task.failed')
  handleTaskFailed(event: { taskId: string; userId: string }) {
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_failed', event);
    this.server.to(`user:${event.userId}`).emit('task_failed', event);
  }

  /**
   * Handle task cancellation events
   */
  @OnEvent('task.cancelled')
  handleTaskCancelled(event: { taskId: string; userId: string }) {
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_cancelled', event);
    this.server.to(`user:${event.userId}`).emit('task_cancelled', event);
  }

  /**
   * Handle task message events
   */
  @OnEvent('task.message')
  handleTaskMessage(event: { taskId: string; userId: string; message: any }) {
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_message', event);
    this.server.to(`user:${event.userId}`).emit('task_message', event);
  }

  /**
   * Handle human input required events
   */
  @OnEvent('human_input.required')
  handleHumanInputRequired(event: {
    taskId: string;
    userId: string;
    inputId: string;
    prompt: string;
    options?: any;
  }) {
    // Only broadcast to the specific user (not all task subscribers)
    this.server.to(`user:${event.userId}`).emit('human_input_required', event);
  }

  /**
   * Handle human input response events
   */
  @OnEvent('human_input.response')
  handleHumanInputResponse(event: {
    taskId: string;
    userId: string;
    inputId: string;
    response: any;
  }) {
    // Broadcast to task room and user room
    void this.server
      .to(`task:${event.taskId}`)
      .emit('human_input_response', event);
    void this.server
      .to(`user:${event.userId}`)
      .emit('human_input_response', event);
  }

  /**
   * Handle human input timeout events
   */
  @OnEvent('human_input.timeout')
  handleHumanInputTimeout(event: {
    taskId: string;
    userId: string;
    inputId: string;
  }) {
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('human_input_timeout', event);
    this.server.to(`user:${event.userId}`).emit('human_input_timeout', event);
  }

  /**
   * Handle task resumed events (after human input)
   */
  @OnEvent('task.resumed')
  handleTaskResumed(event: { taskId: string; userId: string }) {
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_resumed', event);
    this.server.to(`user:${event.userId}`).emit('task_resumed', event);
  }

  /**
   * Send direct message to specific user
   */
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Send direct message to specific task subscribers
   */
  sendToTask(taskId: string, event: string, data: any) {
    this.server.to(`task:${taskId}`).emit(event, data);
  }

  /**
   * Extract JWT token from WebSocket handshake
   */
  private extractTokenFromHandshake(client: Socket): string | null {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      client.handshake.query?.token;

    return Array.isArray(token) ? token[0] : token;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      authenticatedConnections: Array.from(
        this.connectedClients.values(),
      ).filter((client) => client.userId).length,
    };
  }
}
