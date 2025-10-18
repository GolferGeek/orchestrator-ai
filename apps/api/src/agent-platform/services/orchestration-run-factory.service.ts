import { Injectable } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationStateService } from './orchestration-state.service';
import { OrchestrationExecutionService } from './orchestration-execution.service';
import { OrchestrationEventsService } from './orchestration-events.service';
import { OrchestrationResolvedDefinition } from '../types/orchestration-definition.types';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';
import { OrchestrationMetricsService } from './orchestration-metrics.service';

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
    private readonly metrics: OrchestrationMetricsService,
  ) {}

  async createRunFromDefinition(
    options: OrchestrationRunFactoryOptions,
  ): Promise<OrchestrationRunFactoryResult> {
    const parameters = options.parameters ?? {};
    const organizationSlug =
      options.organizationSlug ?? options.definition.organizationSlug;

    const plan = this.buildPlanSnapshot(options.definition);
    const metadata = this.buildRunMetadata(options, plan);
    const concurrencyLimit = this.resolveRunConcurrency(metadata);

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
      {
        maxParallel:
          typeof concurrencyLimit === 'number' ? concurrencyLimit : undefined,
      },
    );
    const steps = await this.orchestrationRunner.listSteps(execution.run.id);

    this.metrics.recordRunStarted(execution.run);

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

    const errorHandling = this.extractErrorHandlingMetadata(options.definition);

    if (errorHandling) {
      baseMetadata.errorHandling = errorHandling;
    }

    const execution = this.extractExecutionMetadata(options.definition);
    if (execution) {
      baseMetadata.execution = execution;
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

  private extractErrorHandlingMetadata(
    definition: OrchestrationResolvedDefinition,
  ): Record<string, any> | null {
    const orchestrationConfig = (definition.rawDefinition?.orchestration ??
      {}) as Record<string, any>;
    const errorHandling = orchestrationConfig.error_handling as
      | Record<string, any>
      | undefined;
    const retryConfig = this.normalizeRetryConfig(errorHandling);

    const retryMetadata = this.buildRunRetryMetadata(retryConfig);
    const rollbackMetadata = this.buildRunRollbackMetadata(errorHandling);

    if (!retryMetadata && !rollbackMetadata) {
      return null;
    }

    const summary: Record<string, any> = {};

    if (retryMetadata) {
      summary.onStepFailure = retryMetadata;
    }

    if (rollbackMetadata) {
      summary.rollback = rollbackMetadata;
    }

    return summary;
  }

  private extractExecutionMetadata(
    definition: OrchestrationResolvedDefinition,
  ): Record<string, any> | null {
    const metadata: Record<string, any> = {};
    const executionConfig = definition.execution ?? null;
    const defaultConcurrency = this.resolveDefaultConcurrency();

    const concurrencyConfig = executionConfig?.concurrency ?? null;
    const concurrencyValue = this.coerceNumber(concurrencyConfig?.maxParallel);
    const resolvedConcurrency =
      concurrencyValue !== null
        ? Math.max(1, Math.floor(Number(concurrencyValue)))
        : defaultConcurrency;

    if (resolvedConcurrency !== null) {
      metadata.concurrency = {
        maxParallelSteps: resolvedConcurrency,
        source:
          concurrencyValue !== null
            ? 'definition'
            : defaultConcurrency !== null
              ? 'default'
              : 'unspecified',
        queueStrategy: concurrencyConfig?.queueStrategy ?? 'fifo',
      };
    }

    // Caching metadata populated in Phase 9 caching task (handled separately)
    if (executionConfig?.caching) {
      metadata.caching = { ...executionConfig.caching };
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  private resolveRunConcurrency(metadata: Record<string, any>): number | null {
    const execution = this.asRecord(
      metadata.execution as Record<string, any> | undefined,
    );
    if (!execution) {
      return null;
    }

    const concurrency = this.asRecord(
      execution.concurrency as Record<string, any> | undefined,
    );
    if (!concurrency) {
      return null;
    }

    const value = this.coerceNumber(
      concurrency.maxParallelSteps,
      concurrency.max_parallel_steps,
      concurrency.maxParallel,
      concurrency.max_parallel,
    );

    if (value === null) {
      return null;
    }

    const normalized = Math.max(1, Math.floor(Number(value)));
    return Number.isFinite(normalized) ? normalized : null;
  }

  private resolveDefaultConcurrency(): number | null {
    const raw =
      process.env.ORCHESTRATION_DEFAULT_MAX_PARALLEL ??
      process.env.ORCHESTRATION_MAX_CONCURRENCY ??
      null;

    if (raw === null || raw === undefined) {
      return null;
    }

    const parsed = this.coerceNumber(raw);
    if (parsed === null) {
      return null;
    }

    const normalized = Math.max(1, Math.floor(Number(parsed)));
    return Number.isFinite(normalized) ? normalized : null;
  }

  private buildRunRetryMetadata(
    config: Record<string, any>,
  ): Record<string, any> | null {
    const maxAttempts = this.resolveMaxAttempts(config);
    if (maxAttempts <= 1) {
      return null;
    }

    const initialDelayMs =
      this.coerceNumber(
        config.initialDelayMs,
        config.initial_delay_ms,
        config.initial_delay_seconds
          ? Number(config.initial_delay_seconds) * 1000
          : undefined,
        config.base_delay_ms,
        config.base_delay_seconds
          ? Number(config.base_delay_seconds) * 1000
          : undefined,
      ) ?? 2000;

    const backoffMultiplier =
      this.coerceNumber(
        config.backoffMultiplier,
        config.backoff_multiplier,
        config.multiplier,
      ) ?? 2;

    const maxDelayMs =
      this.coerceNumber(
        config.maxDelayMs,
        config.max_delay_ms,
        config.max_delay_seconds
          ? Number(config.max_delay_seconds) * 1000
          : undefined,
      ) ?? null;

    return {
      maxAttempts,
      strategy:
        typeof config.strategy === 'string' ? config.strategy : 'exponential',
      initialDelayMs: Math.max(250, initialDelayMs),
      backoffMultiplier: Math.max(1, backoffMultiplier),
      maxDelayMs:
        typeof maxDelayMs === 'number' ? Math.max(0, maxDelayMs) : null,
      notifyHuman:
        typeof config.notify_human === 'boolean'
          ? config.notify_human
          : config.notifyHuman === true,
      allowSkip:
        typeof config.allow_skip === 'boolean'
          ? config.allow_skip
          : config.allowSkip === true,
    };
  }

  private buildRunRollbackMetadata(
    errorHandling: Record<string, any> | undefined,
  ): Record<string, any> | null {
    if (!errorHandling || typeof errorHandling !== 'object') {
      return null;
    }

    const rollback = this.asRecord(errorHandling.rollback);
    if (!rollback) {
      return null;
    }

    const reversible =
      typeof rollback.reversible === 'boolean'
        ? rollback.reversible
        : rollback.enabled === true;

    if (!reversible) {
      return null;
    }

    return {
      reversible: true,
      manualOnly:
        typeof rollback.manualOnly === 'boolean'
          ? rollback.manualOnly
          : rollback.manual_only === true,
      description:
        typeof rollback.description === 'string' ? rollback.description : null,
    };
  }

  private normalizeRetryConfig(
    raw: Record<string, any> | undefined,
  ): Record<string, any> {
    if (!raw || typeof raw !== 'object') {
      return {};
    }

    const onFailureRaw: unknown = raw.on_step_failure;
    if (!onFailureRaw) {
      return {};
    }

    if (Array.isArray(onFailureRaw)) {
      return onFailureRaw.reduce<Record<string, any>>((acc, entry) => {
        if (entry && typeof entry === 'object') {
          Object.assign(acc, entry);
        }
        return acc;
      }, {});
    }

    if (onFailureRaw && typeof onFailureRaw === 'object') {
      const cloned = this.asRecord(onFailureRaw);
      if (cloned) {
        return cloned;
      }
    }

    return {};
  }

  private resolveMaxAttempts(config: Record<string, any>): number {
    const attemptConfig = this.coerceNumber(
      config.maxAttempts,
      config.max_attempts,
    );
    if (attemptConfig !== null) {
      return Math.max(1, attemptConfig);
    }

    const retryCount = this.coerceNumber(config.retry_count, config.retryCount);

    if (retryCount !== null) {
      return Math.max(1, retryCount + 1);
    }

    return 1;
  }

  private coerceNumber(...values: Array<any>): number | null {
    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }
      const parsed =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value)
            : NaN;
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private asRecord(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    if (Array.isArray(value)) {
      return value.reduce<Record<string, any>>((acc, entry: unknown, index) => {
        acc[index] = entry as any;
        return acc;
      }, {});
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return {};
    }

    const result: Record<string, any> = {};
    for (const [key, entry] of entries) {
      result[key] = entry as any;
    }
    return result;
  }
}
