"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelegationError = exports.ProjectExecutionError = exports.OrchestratorError = void 0;
class OrchestratorError extends Error {
    code;
    context;
    constructor(message, code, context) {
        super(message);
        this.code = code;
        this.context = context;
        this.name = 'OrchestratorError';
    }
}
exports.OrchestratorError = OrchestratorError;
class ProjectExecutionError extends OrchestratorError {
    projectId;
    stepId;
    constructor(message, projectId, stepId, context) {
        super(message, 'PROJECT_EXECUTION_ERROR', {
            projectId,
            stepId,
            ...context,
        });
        this.projectId = projectId;
        this.stepId = stepId;
        this.name = 'ProjectExecutionError';
    }
}
exports.ProjectExecutionError = ProjectExecutionError;
class DelegationError extends OrchestratorError {
    agentName;
    constructor(message, agentName, context) {
        super(message, 'DELEGATION_ERROR', { agentName, ...context });
        this.agentName = agentName;
        this.name = 'DelegationError';
    }
}
exports.DelegationError = DelegationError;
//# sourceMappingURL=orchestration.types.js.map