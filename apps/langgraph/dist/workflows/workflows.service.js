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
exports.WorkflowsService = void 0;
const common_1 = require("@nestjs/common");
const marketing_swarm_graph_1 = require("./graphs/marketing-swarm.graph");
const requirements_writer_graph_1 = require("./graphs/requirements-writer.graph");
const metrics_agent_graph_1 = require("./graphs/metrics-agent.graph");
let WorkflowsService = class WorkflowsService {
    constructor(marketingSwarmGraph, requirementsWriterGraph, metricsAgentGraph) {
        this.marketingSwarmGraph = marketingSwarmGraph;
        this.requirementsWriterGraph = requirementsWriterGraph;
        this.metricsAgentGraph = metricsAgentGraph;
    }
    async executeMarketingSwarm(request) {
        const input = {
            announcement: request.prompt,
            provider: request.provider,
            model: request.model,
            taskId: request.taskId,
            conversationId: request.conversationId,
            userId: request.userId,
            statusWebhook: request.statusWebhook,
        };
        return this.marketingSwarmGraph.execute(input);
    }
    async executeRequirementsWriter(request) {
        const input = {
            prompt: request.prompt,
            provider: request.provider,
            model: request.model,
            taskId: request.taskId,
            conversationId: request.conversationId,
            userId: request.userId,
            statusWebhook: request.statusWebhook,
            metadata: request.metadata,
        };
        return this.requirementsWriterGraph.execute(input);
    }
    async executeMetricsAgent(request) {
        const input = {
            prompt: request.prompt,
            provider: request.provider,
            model: request.model,
            taskId: request.taskId,
            conversationId: request.conversationId,
            userId: request.userId,
            statusWebhook: request.statusWebhook,
        };
        return this.metricsAgentGraph.execute(input);
    }
};
exports.WorkflowsService = WorkflowsService;
exports.WorkflowsService = WorkflowsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [marketing_swarm_graph_1.MarketingSwarmGraph,
        requirements_writer_graph_1.RequirementsWriterGraph,
        metrics_agent_graph_1.MetricsAgentGraph])
], WorkflowsService);
//# sourceMappingURL=workflows.service.js.map