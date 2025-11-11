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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMNodeExecutor = void 0;
const common_1 = require("@nestjs/common");
const llm_http_client_service_1 = require("../../services/llm-http-client.service");
const webhook_status_service_1 = require("../../services/webhook-status.service");
let LLMNodeExecutor = class LLMNodeExecutor {
    constructor(llmClient, webhookService) {
        this.llmClient = llmClient;
        this.webhookService = webhookService;
    }
    async execute(state, config) {
        const { provider, model, taskId, conversationId, userId, statusWebhook, } = state;
        if (statusWebhook) {
            await this.webhookService.sendProgress(statusWebhook, taskId, conversationId, userId, config.stepName, config.sequence, config.totalSteps);
        }
        const userMessage = state[config.userMessageField];
        if (!userId) {
            throw new Error(`userId is required in workflow state for LLM node execution (step: ${config.stepName})`);
        }
        const result = await this.llmClient.callLLM({
            provider,
            model,
            systemMessage: config.systemMessage,
            userMessage,
            callerName: config.stepName,
            userId,
        });
        return {
            [config.outputField]: result.text,
        };
    }
};
exports.LLMNodeExecutor = LLMNodeExecutor;
exports.LLMNodeExecutor = LLMNodeExecutor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [llm_http_client_service_1.LLMHttpClientService,
        webhook_status_service_1.WebhookStatusService])
], LLMNodeExecutor);
//# sourceMappingURL=llm-node.js.map