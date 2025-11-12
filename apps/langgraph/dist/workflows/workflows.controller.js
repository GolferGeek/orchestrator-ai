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
var WorkflowsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowsController = void 0;
const common_1 = require("@nestjs/common");
const workflows_service_1 = require("./workflows.service");
const workflow_request_dto_1 = require("../common/dto/workflow-request.dto");
let WorkflowsController = WorkflowsController_1 = class WorkflowsController {
    constructor(workflowsService) {
        this.workflowsService = workflowsService;
        this.logger = new common_1.Logger(WorkflowsController_1.name);
    }
    async executeMarketingSwarm(request) {
        this.logger.log(`Executing marketing-swarm workflow for task ${request.taskId}`);
        const startTime = Date.now();
        const result = await this.workflowsService.executeMarketingSwarm(request);
        const executionTime = Date.now() - startTime;
        return {
            success: true,
            taskId: request.taskId,
            conversationId: request.conversationId,
            data: result.result,
            metadata: {
                executionTime,
                stepsCompleted: 3,
                provider: request.provider,
                model: request.model,
            },
        };
    }
    async executeRequirementsWriter(request) {
        this.logger.log(`Executing requirements-writer workflow for task ${request.taskId}`);
        const startTime = Date.now();
        const result = await this.workflowsService.executeRequirementsWriter(request);
        const executionTime = Date.now() - startTime;
        return {
            success: true,
            taskId: request.taskId,
            conversationId: request.conversationId,
            data: result.result,
            metadata: {
                executionTime,
                stepsCompleted: 6,
                provider: request.provider,
                model: request.model,
            },
        };
    }
    async executeMetricsAgent(request) {
        this.logger.log(`Executing metrics-agent workflow for task ${request.taskId}`);
        const startTime = Date.now();
        const result = await this.workflowsService.executeMetricsAgent(request);
        const executionTime = Date.now() - startTime;
        return {
            success: true,
            taskId: request.taskId,
            conversationId: request.conversationId,
            data: result.result,
            metadata: {
                executionTime,
                stepsCompleted: 2,
                provider: request.provider,
                model: request.model,
            },
        };
    }
};
exports.WorkflowsController = WorkflowsController;
__decorate([
    (0, common_1.Post)('marketing-swarm'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [workflow_request_dto_1.WorkflowRequestDto]),
    __metadata("design:returntype", Promise)
], WorkflowsController.prototype, "executeMarketingSwarm", null);
__decorate([
    (0, common_1.Post)('requirements-writer'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [workflow_request_dto_1.WorkflowRequestDto]),
    __metadata("design:returntype", Promise)
], WorkflowsController.prototype, "executeRequirementsWriter", null);
__decorate([
    (0, common_1.Post)('metrics-agent'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [workflow_request_dto_1.WorkflowRequestDto]),
    __metadata("design:returntype", Promise)
], WorkflowsController.prototype, "executeMetricsAgent", null);
exports.WorkflowsController = WorkflowsController = WorkflowsController_1 = __decorate([
    (0, common_1.Controller)('workflows'),
    __metadata("design:paramtypes", [workflows_service_1.WorkflowsService])
], WorkflowsController);
//# sourceMappingURL=workflows.controller.js.map