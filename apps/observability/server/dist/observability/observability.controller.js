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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ObservabilityController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityController = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const observability_gateway_1 = require("./observability.gateway");
const observability_service_1 = require("./observability.service");
let ObservabilityController = ObservabilityController_1 = class ObservabilityController {
    constructor(databaseService, gateway, observabilityService) {
        this.databaseService = databaseService;
        this.gateway = gateway;
        this.observabilityService = observabilityService;
        this.logger = new common_1.Logger(ObservabilityController_1.name);
    }
    getRoot() {
        return 'Multi-Agent Observability Server';
    }
    async handleHook(hookData) {
        try {
            const event = {
                source_app: hookData.source_app || hookData.sourceApp || 'unknown',
                session_id: hookData.session_id ||
                    hookData.sessionId ||
                    hookData.payload?.session_id ||
                    'unknown',
                hook_event_type: hookData.event_type ||
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
        }
        catch (error) {
            this.logger.error('Error processing hook:', error);
            return { success: false, error: 'Failed to process hook' };
        }
    }
    async createEvent(event) {
        if (!event.source_app ||
            !event.session_id ||
            !event.hook_event_type ||
            !event.payload) {
            throw new common_1.BadRequestException('Missing required fields');
        }
        const savedEvent = await this.databaseService.insertEvent(event);
        this.gateway.broadcastEvent(savedEvent);
        return savedEvent;
    }
    async getFilterOptions() {
        return this.databaseService.getFilterOptions();
    }
    async getRecentEvents(limit) {
        const limitNum = limit ? parseInt(limit) : 300;
        return this.databaseService.getRecentEvents(limitNum);
    }
    async respondToEvent(id, response) {
        const eventId = parseInt(id);
        response.respondedAt = Date.now();
        const updatedEvent = await this.databaseService.updateEventHITLResponse(eventId, response);
        if (!updatedEvent) {
            throw new common_1.NotFoundException('Event not found');
        }
        if (updatedEvent.humanInTheLoop?.responseWebSocketUrl) {
            try {
                await this.observabilityService.sendResponseToAgent(updatedEvent.humanInTheLoop.responseWebSocketUrl, response);
            }
            catch (error) {
                this.logger.error('Failed to send response to agent:', error);
            }
        }
        this.gateway.broadcastEvent(updatedEvent);
        return updatedEvent;
    }
};
exports.ObservabilityController = ObservabilityController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ObservabilityController.prototype, "getRoot", null);
__decorate([
    (0, common_1.Post)('hooks'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "handleHook", null);
__decorate([
    (0, common_1.Post)('events'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "createEvent", null);
__decorate([
    (0, common_1.Get)('events/filter-options'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "getFilterOptions", null);
__decorate([
    (0, common_1.Get)('events/recent'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "getRecentEvents", null);
__decorate([
    (0, common_1.Post)('events/:id/respond'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ObservabilityController.prototype, "respondToEvent", null);
exports.ObservabilityController = ObservabilityController = ObservabilityController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        observability_gateway_1.ObservabilityGateway,
        observability_service_1.ObservabilityService])
], ObservabilityController);
//# sourceMappingURL=observability.controller.js.map