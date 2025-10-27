import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DatabaseService } from '../database/database.service';
import type { HookEvent } from '../types';
export declare class ObservabilityGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly databaseService;
    server: Server;
    private readonly logger;
    constructor(databaseService: DatabaseService);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    handleMessage(client: Socket, payload: any): void;
    broadcastEvent(event: HookEvent): void;
}
