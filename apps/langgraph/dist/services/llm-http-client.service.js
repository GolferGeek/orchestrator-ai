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
var LLMHttpClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMHttpClientService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let LLMHttpClientService = LLMHttpClientService_1 = class LLMHttpClientService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(LLMHttpClientService_1.name);
        const apiPort = this.configService.get('API_PORT');
        if (!apiPort) {
            throw new Error('API_PORT environment variable is required. ' +
                'Please set API_PORT in your .env file (e.g., API_PORT=7100). ' +
                'This must be explicitly configured for your environment.');
        }
        const apiHost = this.configService.get('API_HOST') || 'localhost';
        const llmEndpoint = this.configService.get('LLM_ENDPOINT') || '/llm/generate';
        this.llmServiceUrl = `http://${apiHost}:${apiPort}`;
        this.llmEndpoint = llmEndpoint;
    }
    async callLLM(request) {
        const url = `${this.llmServiceUrl}${this.llmEndpoint}`;
        this.logger.debug(`Calling LLM service: ${url}`, {
            provider: request.provider,
            model: request.model,
            caller: request.callerName,
        });
        try {
            if (!request.userId) {
                throw new Error('userId is required for LLM calls');
            }
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(url, {
                systemPrompt: request.systemMessage || '',
                userPrompt: request.userMessage,
                options: {
                    provider: request.provider,
                    providerName: request.provider,
                    modelName: request.model,
                    temperature: request.temperature ?? 0.7,
                    maxTokens: request.maxTokens ?? 3500,
                    callerType: 'langgraph',
                    callerName: request.callerName || 'workflow',
                    userId: request.userId,
                },
            }));
            const text = response.data.response || response.data.content || '';
            return {
                text,
                usage: response.data.metadata?.usage,
            };
        }
        catch (error) {
            let errorMessage = error.message;
            let errorDetails = '';
            if (error.response) {
                errorDetails = JSON.stringify(error.response.data || error.response.statusText);
                errorMessage = `Request failed with status code ${error.response.status}: ${errorDetails}`;
            }
            else if (error.request) {
                errorMessage = `No response received: ${error.message}`;
            }
            this.logger.error('LLM call failed', {
                message: errorMessage,
                details: errorDetails,
                url,
                request: {
                    provider: request.provider,
                    model: request.model,
                    callerName: request.callerName,
                },
            });
            throw new Error(`LLM call failed: ${errorMessage}`);
        }
    }
};
exports.LLMHttpClientService = LLMHttpClientService;
exports.LLMHttpClientService = LLMHttpClientService = LLMHttpClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], LLMHttpClientService);
//# sourceMappingURL=llm-http-client.service.js.map