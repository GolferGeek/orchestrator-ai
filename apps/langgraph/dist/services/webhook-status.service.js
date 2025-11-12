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
var WebhookStatusService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookStatusService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let WebhookStatusService = WebhookStatusService_1 = class WebhookStatusService {
    constructor(httpService) {
        this.httpService = httpService;
        this.logger = new common_1.Logger(WebhookStatusService_1.name);
    }
    async sendStatus(webhookUrl, update) {
        if (!webhookUrl) {
            this.logger.warn('No webhook URL provided, skipping status update');
            return;
        }
        this.logger.debug(`Sending status update to ${webhookUrl}`, {
            taskId: update.taskId,
            status: update.status,
            step: update.step,
        });
        try {
            await (0, rxjs_1.firstValueFrom)(this.httpService.post(webhookUrl, update, {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                },
            }));
            this.logger.log(`Status update sent successfully: ${update.status}`);
        }
        catch (error) {
            this.logger.error(`Failed to send status update to ${webhookUrl}`, error);
        }
    }
    async sendStarted(webhookUrl, taskId, conversationId, userId, totalSteps) {
        await this.sendStatus(webhookUrl, {
            taskId,
            conversationId,
            userId,
            status: 'started',
            timestamp: new Date().toISOString(),
            message: 'Workflow execution started',
            totalSteps,
        });
    }
    async sendProgress(webhookUrl, taskId, conversationId, userId, step, sequence, totalSteps, message) {
        await this.sendStatus(webhookUrl, {
            taskId,
            conversationId,
            userId,
            status: 'progress',
            timestamp: new Date().toISOString(),
            step,
            sequence,
            totalSteps,
            message: message || `Executing step ${sequence}/${totalSteps}: ${step}`,
        });
    }
    async sendCompleted(webhookUrl, taskId, conversationId, userId, data) {
        await this.sendStatus(webhookUrl, {
            taskId,
            conversationId,
            userId,
            status: 'completed',
            timestamp: new Date().toISOString(),
            message: 'Workflow execution completed',
            data,
        });
    }
    async sendFailed(webhookUrl, taskId, conversationId, userId, error) {
        await this.sendStatus(webhookUrl, {
            taskId,
            conversationId,
            userId,
            status: 'failed',
            timestamp: new Date().toISOString(),
            message: 'Workflow execution failed',
            error,
        });
    }
};
exports.WebhookStatusService = WebhookStatusService;
exports.WebhookStatusService = WebhookStatusService = WebhookStatusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], WebhookStatusService);
//# sourceMappingURL=webhook-status.service.js.map