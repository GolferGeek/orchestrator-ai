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
var RequirementsWriterGraph_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementsWriterGraph = void 0;
const common_1 = require("@nestjs/common");
const llm_http_client_service_1 = require("../../services/llm-http-client.service");
const webhook_status_service_1 = require("../../services/webhook-status.service");
const DOCUMENT_PROMPTS = {
    prd: 'You are a senior product manager and PRD specialist. Create a comprehensive Product Requirements Document (PRD) with: Executive Summary, Product Overview, User Personas, Functional Requirements, User Stories, Non-Functional Requirements, Technical Considerations, Implementation Timeline, Success Metrics, and Risk Assessment.',
    trd: 'You are a senior systems architect and technical documentation specialist. Create a comprehensive Technical Requirements Document (TRD) with: System Overview, Technical Architecture, Database Requirements, API Specifications, Security Requirements, Performance Requirements, Infrastructure Requirements, Integration Requirements, Development Standards, and Deployment Strategy.',
    api: 'You are an API design specialist. Create a comprehensive API Requirements Document with: API Overview, Authentication & Authorization, Endpoint Specifications, Data Models, Error Handling, Rate Limiting, Versioning Strategy, Integration Examples, Testing Requirements, and Documentation Standards.',
    user_story: 'You are an agile coach and user story specialist. Create a comprehensive User Story Document with: Project Overview, User Personas, Epic Stories, Detailed User Stories, Acceptance Criteria, Story Dependencies, Story Prioritization, Definition of Done, Story Estimation, and Sprint Planning Guidance.',
    architecture: 'You are a principal software architect. Create a comprehensive Architecture Requirements Document with: Architecture Overview, System Components, Data Flow & Integrations, Technology Stack, Scalability & Performance, Security Architecture, Deployment Architecture, Monitoring & Observability, Risk Assessment, and Roadmap & Phasing.',
    general: 'You are a senior requirements analyst. Create a comprehensive requirements document with: Executive Summary, Project Objectives & Scope, Stakeholders & Personas, Functional Requirements, Non-Functional Requirements, Technical Considerations, Risks & Assumptions, Implementation Plan, and Success Metrics.',
};
let RequirementsWriterGraph = RequirementsWriterGraph_1 = class RequirementsWriterGraph {
    constructor(llmClient, webhookService) {
        this.llmClient = llmClient;
        this.webhookService = webhookService;
        this.logger = new common_1.Logger(RequirementsWriterGraph_1.name);
    }
    async execute(input) {
        if (input.statusWebhook) {
            await this.webhookService.sendStarted(input.statusWebhook, input.taskId, input.conversationId, input.userId, 6);
        }
        try {
            const state = { ...input };
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'analyze_request', 1, 6, 'Analyzing request to understand requirements intent and scope...');
            }
            const analysisResult = await this.llmClient.callLLM({
                provider: state.provider,
                model: state.model,
                systemMessage: 'You are an expert requirements analyst. Analyze this request and identify: intent, scope (small/medium/large/enterprise), domain (technical/business/product), and provide a brief summary. Return as JSON.',
                userMessage: state.prompt,
                callerName: 'requirements-analyze',
                userId: state.userId,
            });
            let analysisObj = {};
            try {
                analysisObj = JSON.parse(analysisResult.text);
            }
            catch (e) {
                analysisObj = { summary: analysisResult.text, scope: 'medium', domain: 'technical' };
            }
            state.analysis = JSON.stringify(analysisObj);
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'determine_document_type', 2, 6, 'Determining the most appropriate requirements document type...');
            }
            const typeResult = await this.llmClient.callLLM({
                provider: state.provider,
                model: state.model,
                systemMessage: 'Determine the best document type for this request. Choose from: prd, trd, api, user_story, architecture, general. Return only the type name.',
                userMessage: `Request: ${state.prompt}\n\nAnalysis: ${state.analysis}`,
                callerName: 'requirements-type',
                userId: state.userId,
            });
            const docType = typeResult.text.trim().toLowerCase();
            state.documentType = ['prd', 'trd', 'api', 'user_story', 'architecture'].includes(docType) ? docType : 'general';
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'extract_features', 3, 6, 'Extracting key features and components from the request...');
            }
            const featuresResult = await this.llmClient.callLLM({
                provider: state.provider,
                model: state.model,
                systemMessage: 'Extract key features, components, and capabilities from this request. Return as a JSON array of strings.',
                userMessage: state.prompt,
                callerName: 'requirements-features',
                userId: state.userId,
            });
            state.features = featuresResult.text;
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'assess_complexity', 4, 6, 'Assessing complexity, effort, and risk profile...');
            }
            const complexityResult = await this.llmClient.callLLM({
                provider: state.provider,
                model: state.model,
                systemMessage: 'Assess the complexity of this project. Return JSON with: overall_complexity (low/medium/high/enterprise), effort_estimate (e.g., "3-6 weeks"), team_size_recommendation, risk_level.',
                userMessage: `Request: ${state.prompt}\n\nFeatures: ${state.features}`,
                callerName: 'requirements-complexity',
                userId: state.userId,
            });
            state.complexity = complexityResult.text;
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'generate_document', 5, 6, 'Generating comprehensive requirements document...');
            }
            const systemPrompt = DOCUMENT_PROMPTS[state.documentType] || DOCUMENT_PROMPTS.general;
            const documentResult = await this.llmClient.callLLM({
                provider: state.provider,
                model: state.model,
                systemMessage: systemPrompt + '\n\nIMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text.',
                userMessage: `Generate a ${state.documentType.toUpperCase()} for:\n\n${state.prompt}\n\nFeatures: ${state.features}\n\nComplexity: ${state.complexity}`,
                temperature: 0.2,
                maxTokens: 4000,
                callerName: 'requirements-generate',
                userId: state.userId,
            });
            state.document = documentResult.text;
            if (state.statusWebhook) {
                await this.webhookService.sendProgress(state.statusWebhook, state.taskId, state.conversationId, state.userId, 'finalize_response', 6, 6, 'Requirements document ready for review');
            }
            let featuresArray = [];
            let complexityObj = {};
            try {
                featuresArray = JSON.parse(state.features || '[]');
            }
            catch (e) {
                featuresArray = [state.features || ''];
            }
            try {
                complexityObj = JSON.parse(state.complexity || '{}');
            }
            catch (e) {
                complexityObj = { level: state.complexity };
            }
            state.result = {
                document: state.document,
                documentType: state.documentType,
                analysis: analysisObj,
                features: featuresArray,
                complexity: complexityObj,
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
exports.RequirementsWriterGraph = RequirementsWriterGraph;
exports.RequirementsWriterGraph = RequirementsWriterGraph = RequirementsWriterGraph_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [llm_http_client_service_1.LLMHttpClientService,
        webhook_status_service_1.WebhookStatusService])
], RequirementsWriterGraph);
//# sourceMappingURL=requirements-writer.graph.js.map