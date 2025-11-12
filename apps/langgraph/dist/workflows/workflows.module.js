"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowsModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const workflows_controller_1 = require("./workflows.controller");
const workflows_service_1 = require("./workflows.service");
const llm_http_client_service_1 = require("../services/llm-http-client.service");
const webhook_status_service_1 = require("../services/webhook-status.service");
const llm_node_1 = require("./nodes/llm-node");
const marketing_swarm_graph_1 = require("./graphs/marketing-swarm.graph");
const requirements_writer_graph_1 = require("./graphs/requirements-writer.graph");
const metrics_agent_graph_1 = require("./graphs/metrics-agent.graph");
let WorkflowsModule = class WorkflowsModule {
};
exports.WorkflowsModule = WorkflowsModule;
exports.WorkflowsModule = WorkflowsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule.register({
                timeout: 60000,
                maxRedirects: 5,
            }),
        ],
        controllers: [workflows_controller_1.WorkflowsController],
        providers: [
            workflows_service_1.WorkflowsService,
            llm_http_client_service_1.LLMHttpClientService,
            webhook_status_service_1.WebhookStatusService,
            llm_node_1.LLMNodeExecutor,
            marketing_swarm_graph_1.MarketingSwarmGraph,
            requirements_writer_graph_1.RequirementsWriterGraph,
            metrics_agent_graph_1.MetricsAgentGraph,
        ],
        exports: [workflows_service_1.WorkflowsService],
    })
], WorkflowsModule);
//# sourceMappingURL=workflows.module.js.map