import { Injectable, Logger } from '@nestjs/common';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import {
  OrchestrationResolvedDefinition,
  OrchestrationStepDefinition,
} from '../types/orchestration-definition.types';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import {
  OrchestrationStepRecord,
  OrchestrationStepInsertInput,
} from '../interfaces/orchestration-step-record.interface';
import type {
  OrchestrationStepStateEntry,
  OrchestrationCheckpointMetadata,
  OrchestrationStepBehaviorConfig,
} from '../types/orchestration-run.types';
import type { JsonObject } from '@orchestrator-ai/transport-types';

@Injectable()
export class OrchestrationStateService {
  private readonly logger = new Logger(OrchestrationStateService.name);

  constructor(
    private readonly orchestrationRunner: OrchestrationRunnerService,
  ) {}

  /**
   * Initialize orchestration steps for a new run based on definition metadata.
   * Creates persistent step records with dependency metadata and prepared inputs.
   */
  async initializeRun(
    run: OrchestrationRunRecord,
    definition: OrchestrationResolvedDefinition,
    parameters: Record<string, unknown> = {},
  ): Promise<OrchestrationStepRecord[]> {
    const orderedStepIds = this.resolveExecutionOrder(definition.steps);
    const stepLookup = new Map(definition.steps.map((step) => [step.id, step]));

    const createdSteps: Promise<OrchestrationStepRecord>[] = [];

    orderedStepIds.forEach((stepId, index) => {
      const stepDefinition = stepLookup.get(stepId);
      if (!stepDefinition) {
        throw new Error(`Missing orchestration step definition for ${stepId}`);
      }

      const inputPayload = this.prepareStepInput(
        stepDefinition.input ?? {},
        parameters,
      );

      const stepType =
        typeof stepDefinition.type === 'string'
          ? (stepDefinition.type as string).toLowerCase()
          : 'agent';

      const retryBehavior = this.buildStepRetryMetadata(
        definition,
        stepDefinition,
      );
      const rollbackBehavior = this.buildStepRollbackMetadata(
        definition,
        stepDefinition,
      );

      const metadata: OrchestrationStepStateEntry = {
        name: stepDefinition.name,
        checkpoint: stepDefinition.checkpoint_after as OrchestrationCheckpointMetadata | undefined,
        rawInput: stepDefinition.input ?? null,
        rawContext: stepDefinition.context ?? null,
        outputMapping: stepDefinition.output_mapping ?? null,
        type: stepType === 'orchestration' ? 'orchestration' : 'agent',
        orchestration: stepDefinition.orchestration
          ? (JSON.parse(
              JSON.stringify(stepDefinition.orchestration),
            ) as JsonObject)
          : null,
      };

      if (retryBehavior) {
        const existingBehavior = metadata.behavior as
          | Record<string, unknown>
          | undefined;
        metadata.behavior = {
          ...(existingBehavior ?? {}),
          retry: retryBehavior as JsonObject,
        } as OrchestrationStepBehaviorConfig;
        const existingRuntime = metadata.runtime as
          | Record<string, unknown>
          | undefined;
        metadata.runtime = {
          ...(existingRuntime ?? {}),
          retry: {
            attempt: 1,
            history: [],
            nextRetryAt: null,
            maxAttempts: retryBehavior.maxAttempts as number,
          },
        };
      }

      if (rollbackBehavior) {
        const existingBehavior = metadata.behavior as
          | Record<string, unknown>
          | undefined;
        metadata.behavior = {
          ...(existingBehavior ?? {}),
          rollback: rollbackBehavior as JsonObject,
        } as OrchestrationStepBehaviorConfig;
      }

      const insert: OrchestrationStepInsertInput = {
        orchestration_run_id: run.id,
        step_index: index,
        step_id: stepDefinition.id,
        status: 'pending',
        agent_slug:
          stepDefinition.agent ?? stepDefinition.orchestration?.owner ?? null,
        mode:
          stepType === 'orchestration'
            ? 'ORCHESTRATION'
            : (stepDefinition.mode ?? 'BUILD'),
        depends_on: stepDefinition.depends_on ?? [],
        input: inputPayload as JsonObject,
        metadata,
      };

      createdSteps.push(this.orchestrationRunner.createStep(insert));
    });

    return Promise.all(createdSteps);
  }

  /**
   * Resolve execution order via topological sort. Throws on cycles.
   */
  resolveExecutionOrder(steps: OrchestrationStepDefinition[]): string[] {
    const adjacency = new Map<string, string[]>();
    const incomingDegree = new Map<string, number>();

    steps.forEach((step) => {
      adjacency.set(step.id, [...(step.depends_on ?? [])]);
      incomingDegree.set(step.id, step.depends_on?.length ?? 0);
    });

    const queue: string[] = [];
    incomingDegree.forEach((degree, stepId) => {
      if (degree === 0) {
        queue.push(stepId);
      }
    });

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      (adjacency.get(current) || []).forEach((next) => {
        const nextDegree = (incomingDegree.get(next) ?? 0) - 1;
        incomingDegree.set(next, nextDegree);
        if (nextDegree === 0) {
          queue.push(next);
        }
      });
    }

    if (result.length !== steps.length) {
      throw new Error('Detected circular dependency in orchestration steps');
    }

    return result;
  }

  /**
   * Return steps in a run that are ready for execution (all dependencies completed).
   */
  async findRunnableSteps(
    runId: string,
    options: {
      steps?: OrchestrationStepRecord[];
      limit?: number;
    } = {},
  ): Promise<OrchestrationStepRecord[]> {
    const steps =
      options.steps ?? (await this.orchestrationRunner.listSteps(runId));
    const completed = new Set(
      steps
        .filter((step) => step.status === 'completed')
        .map((step) => step.step_id),
    );
    const now = Date.now();
    const limit =
      typeof options.limit === 'number' ? Math.max(0, options.limit) : null;

    const ready = steps
      .filter((step) => {
        if (step.status !== 'pending') {
          return false;
        }
        const runtime = this.asRecord(
          (step.metadata as Record<string, unknown> | undefined)?.runtime,
        );
        const retryState = this.asRecord(runtime?.retry);
        if (
          retryState?.nextRetryAt &&
          typeof retryState.nextRetryAt === 'string'
        ) {
          const scheduled = Date.parse(retryState.nextRetryAt);
          if (!Number.isNaN(scheduled) && scheduled > now) {
            return false;
          }
        }
        return (step.depends_on ?? []).every((dependency) =>
          completed.has(dependency),
        );
      })
      .sort((a, b) => a.step_index - b.step_index);

    if (limit !== null) {
      return ready.slice(0, limit);
    }

    return ready;
  }

  /**
   * Prepare step input by resolving parameter placeholders.
   * We only replace top-level parameter placeholders; step output references
   * remain intact for downstream resolution.
   */
  private prepareStepInput(
    template: Record<string, unknown>,
    parameters: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolveValue = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(
          /{{\s*([a-zA-Z0-9_.]+)\s*}}/g,
          (_, expression: string) => {
            if (expression.startsWith('steps.')) {
              // Defer step output interpolation to runtime resolution
              return `{{ ${expression} }}`;
            }

            const paramValue: unknown = this.lookupParameter(
              expression,
              parameters,
            );
            if (paramValue === undefined) return '';
            if (typeof paramValue === 'object' && paramValue !== null) {
              return JSON.stringify(paramValue);
            }
            if (
              typeof paramValue === 'string' ||
              typeof paramValue === 'number' ||
              typeof paramValue === 'boolean'
            ) {
              return String(paramValue);
            }
            return '';
          },
        );
      }

      if (Array.isArray(value)) {
        return value.map((entry) => resolveValue(entry));
      }

      if (value && typeof value === 'object') {
        const resolved: Record<string, unknown> = {};
        Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
          resolved[key] = resolveValue(entry) as unknown;
        });
        return resolved;
      }

      return value;
    };

    return resolveValue(template) as Record<string, unknown>;
  }

  private lookupParameter(
    expression: string,
    parameters: Record<string, unknown>,
  ): unknown {
    if (expression in parameters) {
      return parameters[expression];
    }

    // Support dotted notation (e.g., context.org.slug)
    const segments = expression.split('.');
    let current: unknown = parameters;
    for (const segment of segments) {
      if (
        current &&
        typeof current === 'object' &&
        Object.prototype.hasOwnProperty.call(current, segment)
      ) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private buildStepRetryMetadata(
    definition: OrchestrationResolvedDefinition,
    step: OrchestrationStepDefinition,
  ): Record<string, unknown> | null {
    const orchestrationConfig =
      this.asRecord(definition.rawDefinition?.orchestration) ?? {};
    const defaultRetryConfig = this.normalizeRetryConfig(
      this.asRecord(orchestrationConfig.error_handling),
    );
    const stepMetadata = this.asRecord(step.metadata);
    const stepRetryRaw = this.asRecord(stepMetadata?.retry);

    const merged = {
      ...defaultRetryConfig,
      ...(stepRetryRaw ?? {}),
    };

    const maxAttempts = this.resolveMaxAttempts(merged);
    if (maxAttempts <= 1) {
      return null;
    }

    const initialDelayMs =
      this.coerceNumber(
        merged.initialDelayMs,
        merged.initial_delay_ms,
        merged.initial_delay_seconds
          ? Number(merged.initial_delay_seconds) * 1000
          : undefined,
        merged.base_delay_ms,
        merged.base_delay_seconds
          ? Number(merged.base_delay_seconds) * 1000
          : undefined,
      ) ?? 2000;

    const backoffMultiplier =
      this.coerceNumber(
        merged.backoffMultiplier,
        merged.backoff_multiplier,
        merged.multiplier,
      ) ?? 2;

    const maxDelayMs =
      this.coerceNumber(
        merged.maxDelayMs,
        merged.max_delay_ms,
        merged.max_delay_seconds
          ? Number(merged.max_delay_seconds) * 1000
          : undefined,
      ) ?? null;

    return {
      maxAttempts,
      strategy:
        typeof merged.strategy === 'string' ? merged.strategy : 'exponential',
      initialDelayMs: Math.max(250, initialDelayMs),
      backoffMultiplier: Math.max(1, backoffMultiplier),
      maxDelayMs:
        typeof maxDelayMs === 'number' ? Math.max(0, maxDelayMs) : null,
      notifyHuman:
        typeof merged.notify_human === 'boolean'
          ? merged.notify_human
          : merged.notifyHuman === true,
      allowSkip:
        typeof merged.allow_skip === 'boolean'
          ? merged.allow_skip
          : merged.allowSkip === true,
    };
  }

  private buildStepRollbackMetadata(
    definition: OrchestrationResolvedDefinition,
    step: OrchestrationStepDefinition,
  ): Record<string, unknown> | null {
    const orchestrationConfig =
      this.asRecord(definition.rawDefinition?.orchestration) ?? {};
    const errorHandling = this.asRecord(orchestrationConfig.error_handling);
    const defaultRollback = this.asRecord(errorHandling?.rollback);
    const stepMetadata = this.asRecord(step.metadata);

    const rollbackSource = this.asRecord(stepMetadata?.rollback);
    const reversibleFlag =
      typeof stepMetadata?.reversible === 'boolean'
        ? stepMetadata.reversible
        : undefined;

    const merged = {
      ...(defaultRollback ?? {}),
      ...(rollbackSource ?? {}),
    };

    const reversible =
      typeof merged.reversible === 'boolean'
        ? merged.reversible
        : (reversibleFlag ?? false);

    if (!reversible) {
      return null;
    }

    return {
      reversible: true,
      label:
        typeof merged.label === 'string' && merged.label.trim().length > 0
          ? merged.label.trim()
          : (step.name ?? step.id),
      description:
        typeof merged.description === 'string' ? merged.description : null,
      manualOnly:
        typeof merged.manualOnly === 'boolean'
          ? merged.manualOnly
          : merged.manual_only === true,
    };
  }

  private normalizeRetryConfig(
    raw: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!raw) {
      return {};
    }

    const onFailureRaw: unknown = raw.on_step_failure;
    if (!onFailureRaw) {
      return {};
    }

    if (Array.isArray(onFailureRaw)) {
      return onFailureRaw.reduce<Record<string, unknown>>((acc, entry) => {
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

  private resolveMaxAttempts(config: Record<string, unknown>): number {
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

  private coerceNumber(...values: Array<unknown>): number | null {
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

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    if (Array.isArray(value)) {
      return value.reduce<Record<string, unknown>>((acc, entry, index) => {
        acc[index] = entry as unknown;
        return acc;
      }, {});
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      result[key] = entry as unknown;
    }
    return result;
  }
}
