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
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import {
  TaskProgressEvent,
  WorkflowStepProgressEvent,
} from '../common/types/agent-conversations.types';

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
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      'http://localhost:3100',
      'http://127.0.0.1:3100',
      'http://localhost:3101',
      'http://127.0.0.1:3101',
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

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.debug(`🔗 Client attempting to connect: ${client.id}`);
    
    try {
      // Extract JWT token from handshake
      const token = this.extractTokenFromHandshake(client);
      this.logger.debug(`🔑 Extracted token for client ${client.id}: ${token ? 'present' : 'missing'}`);
      
      if (!token) {
        this.logger.warn(`⚠️ Client ${client.id} connected without token - allowing anonymous access`);
        client.userId = 'anonymous';
        client.subscribedTasks = new Set();
        this.connectedClients.set(client.id, client);
        this.logger.log(`✅ Anonymous client connected: ${client.id}`);
        return;
      }

      // Verify and decode token using Supabase
      const supabaseClient = this.supabaseService.getAnonClient();
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);
      
      if (error || !user) {
        this.logger.warn(`⚠️ Token validation failed for client ${client.id}: ${error?.message || 'No user found'} - allowing anonymous access`);
        client.userId = 'anonymous';
        client.subscribedTasks = new Set();
        this.connectedClients.set(client.id, client);
        this.logger.log(`✅ Anonymous client connected: ${client.id}`);
        return;
      }
      
      client.userId = user.id;
      client.subscribedTasks = new Set();

      // Store client connection
      this.connectedClients.set(client.id, client);

      this.logger.log(
        `✅ Authenticated client connected: ${client.id} (User: ${client.userId})`,
      );

      // Join user-specific room
      client.join(`user:${client.userId}`);
    } catch (error) {
      this.logger.error(`❌ Connection failed for client ${client.id}:`, error);
      // Allow anonymous connection as fallback
      client.userId = 'anonymous';
      client.subscribedTasks = new Set();
      this.connectedClients.set(client.id, client);
      this.logger.log(`✅ Anonymous client connected as fallback: ${client.id}`);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Subscribe to task progress updates
   */
  @SubscribeMessage('subscribe_task')
  async handleTaskSubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string },
  ) {
    this.logger.log(`📡 Received subscribe_task request for task: ${data.taskId} from client: ${client.id}`);
    
    // Allow subscription without authentication for development/testing
    if (!client.userId) {
      this.logger.warn(`⚠️ Client ${client.id} not authenticated but allowing task subscription for development`);
      // Set a temporary user ID for unauthenticated clients
      client.userId = 'anonymous';
    }

    try {
      // TODO: Verify that user owns this task
      // For now, we'll allow any client to subscribe to any task

      client.subscribedTasks?.add(data.taskId);
      client.join(`task:${data.taskId}`);

      this.logger.log(
        `✅ Client ${client.id} (User: ${client.userId}) successfully subscribed to task ${data.taskId}`,
      );
      this.logger.debug(
        `🏠 Client ${client.id} joined room: task:${data.taskId}`,
      );

      // Check room immediately after joining
      setTimeout(() => {
        const roomClients = this.server?.sockets?.adapter?.rooms?.get(`task:${data.taskId}`);
        const clientCount = roomClients ? roomClients.size : 0;
        this.logger.log(`📊 Room task:${data.taskId} now has ${clientCount} clients`);
        
        if (clientCount === 0) {
          this.logger.warn(`⚠️ Room count still 0 after join - checking all rooms...`);
          const allRooms = Array.from(this.server?.sockets?.adapter?.rooms?.keys() || []);
          this.logger.debug(`🏠 All rooms: ${allRooms.join(', ')}`);
          const clientRooms = Array.from(client.rooms || []);
          this.logger.debug(`👤 Client ${client.id} is in rooms: ${clientRooms.join(', ')}`);
        }
      }, 100); // Small delay to let room join complete
      
      client.emit('subscription_confirmed', { taskId: data.taskId });
    } catch (error) {
      this.logger.error(`❌ Error subscribing client ${client.id} to task ${data.taskId}:`, error);
      client.emit('subscription_error', {
        taskId: data.taskId,
        message: 'Failed to subscribe to task',
      });
    }
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
    client.leave(`task:${data.taskId}`);

    this.logger.debug(
      `Client ${client.id} unsubscribed from task ${data.taskId}`,
    );

    client.emit('unsubscription_confirmed', { taskId: data.taskId });
  }

  /**
   * Handle task progress events from EventEmitter
   */
  @OnEvent('task.progress')
  handleTaskProgress(event: TaskProgressEvent) {
    this.logger.debug(
      `Broadcasting progress for task ${event.taskId}: ${event.progress}%`,
    );

    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${event.taskId}`).emit('task_progress', event);
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

    this.logger.log(
      `🔥 Broadcasting workflow step progress for task ${taskId}: ${stepName} (${stepIndex}/${totalSteps}) - ${status}`,
    );

    // Check how many clients are in the room (with null safety)
    let clientCount = 0;
    let roomClients;
    try {
      roomClients = this.server?.sockets?.adapter?.rooms?.get(`task:${taskId}`);
      clientCount = roomClients ? roomClients.size : 0;
    } catch (error) {
      this.logger.warn(`Failed to check room clients: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    this.logger.log(
      `📢 Broadcasting workflow_step_progress to ${clientCount} clients in room: task:${taskId}`,
    );
    
    if (clientCount === 0) {
      this.logger.warn(`⚠️ NO CLIENTS IN ROOM task:${taskId} - Event will be lost!`);
      // Log all current rooms to debug
      const allRooms = Array.from(this.server?.sockets?.adapter?.rooms?.keys() || []);
      this.logger.debug(`🏠 All current rooms: ${allRooms.join(', ')}`);
    }

    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${taskId}`).emit('workflow_step_progress', event);
    
    this.logger.debug(
      `📤 Emitted workflow_step_progress event for task ${taskId}, step: ${stepName}`,
    );
  }

  /**
   * Broadcast task completion updates
   */
  broadcastTaskCompletion(
    taskId: string,
    status: string,
    message?: string,
  ) {
    const event = {
      taskId,
      status,
      message,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(
      `🎯 broadcastTaskCompletion called for task ${taskId}: ${status} - ${message}`,
    );

    // Check how many clients are in the room (with null safety)
    let clientCount = 0;
    try {
      const roomClients = this.server?.sockets?.adapter?.rooms?.get(`task:${taskId}`);
      clientCount = roomClients ? roomClients.size : 0;
    } catch (error) {
      this.logger.warn(`Failed to check room clients: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    this.logger.debug(
      `📢 Broadcasting task_completed to ${clientCount} clients in room: task:${taskId}`,
    );

    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${taskId}`).emit('task_completed', event);
    
    this.logger.debug(
      `📤 Emitted task_completed event for task ${taskId}, status: ${status}`,
    );
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
    this.logger.debug(`Broadcasting task created: ${event.taskId}`);

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
    this.logger.debug(
      `Broadcasting status change for task ${event.taskId}: ${event.status} (${event.progress}%)`,
    );
    
    // Broadcast to task room and user room with full JSON data
    this.server.to(`task:${event.taskId}`).emit('task_status_changed', event);
    this.server.to(`user:${event.userId}`).emit('task_status_changed', event);
  }

  /**
   * Handle task completion events
   * Note: WebSocket broadcasting is handled by broadcastTaskCompletion() method to avoid duplicates
   */
  @OnEvent('task.completed')
  handleTaskCompleted(event: { taskId: string; userId: string }) {
    this.logger.debug(`Task completion event received: ${event.taskId} (WebSocket broadcasting disabled to prevent duplicates - handled by broadcastTaskCompletion)`);
    
    // Don't emit WebSocket events here - broadcastTaskCompletion() already handles this
    // to prevent duplicate task_completed events that cause multiple frontend completion handlers
  }

  /**
   * Handle task failure events
   */
  @OnEvent('task.failed')
  handleTaskFailed(event: { taskId: string; userId: string }) {
    this.logger.debug(`Broadcasting task failed: ${event.taskId}`);

    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_failed', event);
    this.server.to(`user:${event.userId}`).emit('task_failed', event);
  }

  /**
   * Handle task cancellation events
   */
  @OnEvent('task.cancelled')
  handleTaskCancelled(event: { taskId: string; userId: string }) {
    this.logger.debug(`Broadcasting task cancelled: ${event.taskId}`);

    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_cancelled', event);
    this.server.to(`user:${event.userId}`).emit('task_cancelled', event);
  }

  /**
   * Handle task message events
   */
  @OnEvent('task.message')
  handleTaskMessage(event: { taskId: string; userId: string; message: any }) {
    this.logger.debug(
      `Broadcasting task message for task ${event.taskId}: ${event.message.messageType}`,
    );

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
    this.logger.debug(
      `Broadcasting human input required for task ${event.taskId}`,
    );

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
    this.logger.debug(
      `Broadcasting human input response for task ${event.taskId}`,
    );

    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('human_input_response', event);
    this.server.to(`user:${event.userId}`).emit('human_input_response', event);
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
    this.logger.debug(
      `Broadcasting human input timeout for task ${event.taskId}`,
    );

    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('human_input_timeout', event);
    this.server.to(`user:${event.userId}`).emit('human_input_timeout', event);
  }

  /**
   * Handle task resumed events (after human input)
   */
  @OnEvent('task.resumed')
  handleTaskResumed(event: { taskId: string; userId: string }) {
    this.logger.debug(`Broadcasting task resumed: ${event.taskId}`);

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
    this.logger.debug(`🔍 Checking handshake for client ${client.id}:`);
    this.logger.debug(`  - auth.token: ${client.handshake.auth?.token ? 'present' : 'missing'}`);
    this.logger.debug(`  - headers.authorization: ${client.handshake.headers?.authorization ? 'present' : 'missing'}`);
    this.logger.debug(`  - query.token: ${client.handshake.query?.token ? 'present' : 'missing'}`);
    
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
