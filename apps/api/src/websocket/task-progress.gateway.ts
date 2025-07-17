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
import { JwtService } from '@nestjs/jwt';
import { TaskProgressEvent } from '../common/types/agent-conversations.types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  subscribedTasks?: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'], // Add your frontend URLs
    credentials: true,
  },
  namespace: '/task-progress',
})
export class TaskProgressGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TaskProgressGateway.name);
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        this.logger.warn('Client connected without valid token');
        client.disconnect();
        return;
      }

      // Verify and decode token
      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub;
      client.subscribedTasks = new Set();

      // Store client connection
      this.connectedClients.set(client.id, client);

      this.logger.log(`Client connected: ${client.id} (User: ${client.userId})`);
      
      // Join user-specific room
      client.join(`user:${client.userId}`);
    } catch (error) {
      this.logger.error('Authentication failed for client:', error);
      client.disconnect();
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
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // TODO: Verify that user owns this task
      // For now, we'll trust the authentication
      
      client.subscribedTasks?.add(data.taskId);
      client.join(`task:${data.taskId}`);
      
      this.logger.debug(
        `Client ${client.id} subscribed to task ${data.taskId}`,
      );
      
      client.emit('subscription_confirmed', { taskId: data.taskId });
    } catch (error) {
      this.logger.error('Error subscribing to task:', error);
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
    this.logger.debug(`Broadcasting progress for task ${event.taskId}: ${event.progress}%`);
    
    // Broadcast to all clients subscribed to this task
    this.server.to(`task:${event.taskId}`).emit('task_progress', event);
  }

  /**
   * Handle task creation events
   */
  @OnEvent('task.created')
  handleTaskCreated(event: { taskId: string; conversationId: string; userId: string; agentName: string }) {
    this.logger.debug(`Broadcasting task created: ${event.taskId}`);
    
    // Broadcast to user's room
    this.server.to(`user:${event.userId}`).emit('task_created', event);
  }

  /**
   * Handle task completion events
   */
  @OnEvent('task.completed')
  handleTaskCompleted(event: { taskId: string; userId: string }) {
    this.logger.debug(`Broadcasting task completed: ${event.taskId}`);
    
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_completed', event);
    this.server.to(`user:${event.userId}`).emit('task_completed', event);
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
    this.logger.debug(`Broadcasting task message for task ${event.taskId}: ${event.message.messageType}`);
    
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('task_message', event);
    this.server.to(`user:${event.userId}`).emit('task_message', event);
  }

  /**
   * Handle human input required events
   */
  @OnEvent('human_input.required')
  handleHumanInputRequired(event: { taskId: string; userId: string; inputId: string; prompt: string; options?: any }) {
    this.logger.debug(`Broadcasting human input required for task ${event.taskId}`);
    
    // Only broadcast to the specific user (not all task subscribers)
    this.server.to(`user:${event.userId}`).emit('human_input_required', event);
  }

  /**
   * Handle human input response events
   */
  @OnEvent('human_input.response')
  handleHumanInputResponse(event: { taskId: string; userId: string; inputId: string; response: any }) {
    this.logger.debug(`Broadcasting human input response for task ${event.taskId}`);
    
    // Broadcast to task room and user room
    this.server.to(`task:${event.taskId}`).emit('human_input_response', event);
    this.server.to(`user:${event.userId}`).emit('human_input_response', event);
  }

  /**
   * Handle human input timeout events
   */
  @OnEvent('human_input.timeout')
  handleHumanInputTimeout(event: { taskId: string; userId: string; inputId: string }) {
    this.logger.debug(`Broadcasting human input timeout for task ${event.taskId}`);
    
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
      authenticatedConnections: Array.from(this.connectedClients.values()).filter(
        client => client.userId
      ).length,
    };
  }
}