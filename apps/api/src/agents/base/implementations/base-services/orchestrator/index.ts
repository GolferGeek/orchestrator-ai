/**
 * Orchestrator Base Services - Following conversation + tasks paradigm
 *
 * These services enhance the proven conversation + tasks pattern with:
 * - Project capabilities for multi-step workflows
 * - Delegation intelligence for agent coordination
 * - A2A compliance for all operations
 */

export * from './orchestrator-agent-base.service';
export * from './intent-recognition.service';
export * from './planning.service';
export * from './plan-execution.service';
export * from './delegation.service';
export * from './subproject-management.service';
export * from './orchestrator-facade.service';
export * from './orchestrator.module';
