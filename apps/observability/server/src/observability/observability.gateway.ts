import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { HookEvent } from '../types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  path: '/stream',
  transports: ['websocket', 'polling'],
})
export class ObservabilityGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ObservabilityGateway.name);

  constructor(private readonly databaseService: DatabaseService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    try {
      // Send recent events on connection
      const events = await this.databaseService.getRecentEvents(300);
      client.emit('message', JSON.stringify({ type: 'initial', data: events }));
    } catch (error) {
      this.logger.error('Error sending initial events:', error);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): void {
    this.logger.log(`Received message from ${client.id}:`, payload);
  }

  broadcastEvent(event: HookEvent): void {
    const message = JSON.stringify({ type: 'event', data: event });
    this.server.emit('message', message);
  }
}
