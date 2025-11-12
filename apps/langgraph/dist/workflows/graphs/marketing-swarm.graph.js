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
exports.MarketingSwarmGraph = void 0;
const common_1 = require("@nestjs/common");
const llm_node_1 = require("../nodes/llm-node");
const webhook_status_service_1 = require("../../services/webhook-status.service");
let MarketingSwarmGraph = class MarketingSwarmGraph {
    constructor(llmNode, webhookService) {
        this.llmNode = llmNode;
        this.webhookService = webhookService;
    }
    async execute(input) {
        if (input.statusWebhook) {
            await this.webhookService.sendStarted(input.statusWebhook, input.taskId, input.conversationId, input.userId, 3);
        }
        try {
            const state = { ...input };
            const webPostResult = await this.llmNode.execute(state, {
                systemMessage: 'You are a brilliant blog post writer who specializes in being both entertaining and informative, and you\'re best known for being able to write posts for all audiences.',
                userMessageField: 'announcement',
                outputField: 'webPost',
                stepName: 'Write Blog Post',
                sequence: 1,
                totalSteps: 3,
            });
            Object.assign(state, webPostResult);
            const seoResult = await this.llmNode.execute(state, {
                systemMessage: 'You are an expert SEO specialist. Generate comprehensive SEO-optimized content including: meta title (60 chars max), meta description (155 chars max), 5-10 relevant keywords, H1 heading, and JSON-LD structured data for the given topic.',
                userMessageField: 'announcement',
                outputField: 'seoContent',
                stepName: 'Create SEO',
                sequence: 2,
                totalSteps: 3,
            });
            Object.assign(state, seoResult);
            const socialResult = await this.llmNode.execute(state, {
                systemMessage: 'You are a social media content strategist. Create engaging social media posts (NOT blog posts) for multiple platforms: Twitter/X (280 chars with hashtags), LinkedIn (professional tone, 1300 chars max), and Facebook (conversational, 500 chars).',
                userMessageField: 'announcement',
                outputField: 'socialMedia',
                stepName: 'Create Social Media',
                sequence: 3,
                totalSteps: 3,
            });
            Object.assign(state, socialResult);
            state.result = {
                webPost: state.webPost,
                seoContent: state.seoContent,
                socialMedia: state.socialMedia,
            };
            if (input.statusWebhook) {
                await this.webhookService.sendCompleted(input.statusWebhook, input.taskId, input.conversationId, input.userId, state.result);
            }
            return state;
        }
        catch (error) {
            if (input.statusWebhook) {
                await this.webhookService.sendFailed(input.statusWebhook, input.taskId, input.conversationId, input.userId, error.message);
            }
            throw error;
        }
    }
};
exports.MarketingSwarmGraph = MarketingSwarmGraph;
exports.MarketingSwarmGraph = MarketingSwarmGraph = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [llm_node_1.LLMNodeExecutor,
        webhook_status_service_1.WebhookStatusService])
], MarketingSwarmGraph);
//# sourceMappingURL=marketing-swarm.graph.js.map