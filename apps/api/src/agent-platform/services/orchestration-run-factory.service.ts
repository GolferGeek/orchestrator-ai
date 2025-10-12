import { Injectable } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationStateService } from './orchestration-state.service';
import { OrchestrationExecutionService } from './orchestration-execution.service';
import { OrchestrationEventsService } from './orchestration-events.service';
import { OrchestrationResolvedDefinition } from '../types/orchestration-definition.types';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';

interface OrchestrationRunFactoryAgentMetadata {
  id?: string | null;
  slug: string;
  type?: string | null;
  displayName?: string | null;
}

interface OrchestrationRunFactoryOptions {
  definition: OrchestrationResolvedDefinition;
  parameters?: Record<string, any>;
  planId?: string | null;
  conversationId?: string | null;
  parentRunId?: string | null;
  organizationSlug?: string | null;
  metadata?: Record<string, any>;
  agent: OrchestrationRunFactoryAgentMetadata;
  createdBy?: string | null;
  originType?: 'plan' | 'saved_orchestration' | 'ad_hoc';
  originId?: string | null;
  orchestrationSlug?: string | null;
  requestMetadata?: Record<string, any>;
  taskLink?: { id: string | null; userId: string | null } | null;
}

interface OrchestrationRunFactoryResult {
  run: OrchestrationRunRecord;
  steps: OrchestrationStepRecord[];
  readySteps: OrchestrationStepRecord[];
}

@Injectable()
export class OrchestrationRunFactoryService {
  constructor(
    private readonly orchestrationRunner: OrchestrationRunnerService,
    private readonly stateService: OrchestrationStateService,
    private readonly executionService: OrchestrationExecutionService,
    private readonly events: OrchestrationEventsService,
  ) {}

  async createRunFromDefinition(
    options: OrchestrationRunFactoryOptions,
  ): Promise<OrchestrationRunFactoryResult> {
    const parameters = options.parameters ?? {};
    const organizationSlug =
      options.organizationSlug ?? options.definition.organizationSlug;

    const plan = this.buildPlanSnapshot(options.definition);
    const metadata = this.buildRunMetadata(options, plan);

    const runRecord = await this.orchestrationRunner.startRun({
      planId: options.planId ?? null,
      orchestrationDefinitionId: options.definition.recordId ?? null,
      orchestrationName: options.definition.name,
      conversationId: options.conversationId ?? null,
      parentOrchestrationRunId: options.parentRunId ?? null,
      organizationSlug,
      parameters,
      plan,
      metadata,
      agentId: options.agent.id ?? null,
      agentSlug: options.agent.slug,
      agentType: options.agent.type ?? null,
      agentDisplayName: options.agent.displayName ?? null,
      createdBy: options.createdBy ?? null,
      originType: options.originType,
      originId: options.originId ?? null,
      orchestrationSlug: options.orchestrationSlug ?? null,
    });

    const createdSteps = await this.stateService.initializeRun(
      runRecord,
      options.definition,
      parameters,
    );

    const planningRun = await this.orchestrationRunner.updateRun({
      runId: runRecord.id,
      status: 'planning',
      currentStepIndex: createdSteps[0]?.step_index ?? 0,
      currentStepId: createdSteps[0]?.step_id ?? null,
      metadata: this.mergeRunMetadata(runRecord.metadata, {
        lifecycle: 'initialized',
        stats: {
          totalSteps: createdSteps.length,
          completedSteps: 0,
          progressPercentage: createdSteps.length > 0 ? 0 : null,
        },
      }),
    });

    this.events.emitRunCreated(planningRun, {
      totalSteps: createdSteps.length,
    });

    const execution = await this.executionService.startExecution(
      planningRun.id,
    );
    const steps = await this.orchestrationRunner.listSteps(execution.run.id);

    return {
      run: execution.run,
      steps,
      readySteps: execution.readySteps,
    };
  }

  private buildPlanSnapshot(
    definition: OrchestrationResolvedDefinition,
  ): Record<string, any> {
    return {
      name: definition.name,
      steps: definition.steps.map((step) => ({
        id: step.id,
        agent: step.agent ?? null,
        type: step.type ?? 'agent',
        mode: step.mode ?? 'BUILD',
      })),
    };
  }

  private buildRunMetadata(
    options: OrchestrationRunFactoryOptions,
    plan: Record<string, any>,
  ): Record<string, any> {
    const baseMetadata: Record<string, any> = {
      plan,
      triggeredByAgent: options.agent.slug,
      agent: {
        id: options.agent.id ?? null,
        slug: options.agent.slug,
        type: options.agent.type ?? null,
        displayName: options.agent.displayName ?? null,
        organizationSlug:
          options.organizationSlug ?? options.definition.organizationSlug,
      },
      requestMetadata: options.requestMetadata ?? {},
    };

    if (options.taskLink) {
      baseMetadata['task'] = {
        id: options.taskLink.id,
        userId: options.taskLink.userId,
      };
    }

    return {
      ...(options.metadata ?? {}),
      ...baseMetadata,
    };
  }

  private mergeRunMetadata(
    existing: Record<string, any> | undefined,
    patch: Record<string, any>,
  ): Record<string, any> {
    const base = { ...(existing ?? {}) };
    const existingStats = (base.stats as Record<string, any> | undefined) ?? {};
    const patchStats =
      (patch.stats as Record<string, any> | undefined) ?? undefined;

    const merged: Record<string, any> = {
      ...base,
      ...patch,
    };

    if (patchStats) {
      merged.stats = {
        ...existingStats,
        ...patchStats,
      };
    } else if (Object.keys(existingStats).length > 0 && !merged.stats) {
      merged.stats = existingStats;
    }

    return merged;
  }
}
