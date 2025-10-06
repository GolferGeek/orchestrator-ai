/**
 * Strict A2A Protocol - Orchestrate Mode
 * Complete request and response types for all orchestrate mode actions
 */
import { AgentTaskMode } from '../shared/enums';
import { StrictRequestMetadata, StrictResponseMetadata } from './base.types';
/**
 * Orchestrate Mode: EXECUTE action
 */
export interface OrchestrateExecuteRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: 'orchestrate.execute';
    params: {
        mode: AgentTaskMode.ORCHESTRATE_EXECUTE;
        conversationId: string;
        userMessage: string;
        payload: {
            action: 'execute';
            workflow?: string;
            steps?: any[];
        };
        metadata?: StrictRequestMetadata;
    };
}
/**
 * Union of all Orchestrate mode requests
 */
export type StrictOrchestrateRequest = OrchestrateExecuteRequest;
/**
 * Workflow execution data structure
 */
export interface WorkflowExecutionData {
    workflowId: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    steps: WorkflowStep[];
    startedAt: string;
    completedAt?: string;
}
/**
 * Individual workflow step
 */
export interface WorkflowStep {
    stepId: string;
    stepNumber: number;
    action: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    result?: any;
    error?: string;
    startedAt?: string;
    completedAt?: string;
}
/**
 * Orchestrate Mode: EXECUTE response
 */
export interface OrchestrateExecuteResponse {
    jsonrpc: '2.0';
    id: string | number;
    result: {
        success: true;
        mode: 'orchestrate';
        payload: {
            content: WorkflowExecutionData;
            metadata: StrictResponseMetadata;
        };
    };
}
/**
 * Union of all Orchestrate mode responses
 */
export type StrictOrchestrateResponse = OrchestrateExecuteResponse;
//# sourceMappingURL=orchestrate.strict.d.ts.map