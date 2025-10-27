"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ObservabilityGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let ObservabilityGateway = ObservabilityGateway_1 = class ObservabilityGateway {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.logger = new common_1.Logger(ObservabilityGateway_1.name);
    }
    afterInit(server) {
        this.logger.log('WebSocket Gateway initialized');
    }
    async handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        try {
            const events = await this.databaseService.getRecentEvents(300);
            client.emit('message', JSON.stringify({ type: 'initial', data: events }));
        }
        catch (error) {
            this.logger.error('Error sending initial events:', error);
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleMessage(client, payload) {
        this.logger.log(`Received message from ${client.id}:`, payload);
    }
    broadcastEvent(event) {
        const message = JSON.stringify({ type: 'event', data: event });
        this.server.emit('message', message);
    }
};
exports.ObservabilityGateway = ObservabilityGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ObservabilityGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ObservabilityGateway.prototype, "handleMessage", null);
exports.ObservabilityGateway = ObservabilityGateway = ObservabilityGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
        path: '/stream',
        transports: ['websocket', 'polling'],
    }),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ObservabilityGateway);
//# sourceMappingURL=observability.gateway.js.map