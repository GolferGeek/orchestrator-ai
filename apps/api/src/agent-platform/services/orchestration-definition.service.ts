import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OrchestrationDefinitionsRepository } from '../repositories/orchestration-definitions.repository';
import {
  OrchestrationDefinitionCreateInput,
  OrchestrationDefinitionRecord,
  OrchestrationDefinitionUpdateInput,
} from '../interfaces/orchestration-definition.interface';
import {
  OrchestrationDefinitionSchema,
  OrchestrationExecutionConfig,
  OrchestrationResolvedDefinition,
  OrchestrationStepDefinition,
} from '../types/orchestration-definition.types';
import {
  OrchestrationCacheService,
  DefinitionCacheKey,
} from './orchestration-cache.service';

@Injectable()
export class OrchestrationDefinitionService {
  private readonly logger = new Logger(OrchestrationDefinitionService.name);

  constructor(
    private readonly definitionsRepository: OrchestrationDefinitionsRepository,
    private readonly cache: OrchestrationCacheService,
  ) {}

  async createDefinition(
    input: OrchestrationDefinitionCreateInput,
  ): Promise<OrchestrationDefinitionRecord> {
    const normalized = this.normalizeDefinition(input.definition);
    this.validateDefinition(normalized);
    const created = await this.definitionsRepository.create({
      ...input,
      definition: normalized,
    });

    const resolved = this.toResolvedDefinition(created);
    this.cacheResolvedDefinition(resolved, { cacheLatest: true });

    return created;
  }

  async updateDefinition(
    id: string,
    patch: OrchestrationDefinitionUpdateInput & {
      definition?: Record<string, any>;
    },
  ): Promise<OrchestrationDefinitionRecord> {
    let definitionPatch = patch.definition;

    if (definitionPatch) {
      const normalized = this.normalizeDefinition(definitionPatch);
      this.validateDefinition(normalized);
      definitionPatch = normalized;
    }
    const updated = await this.definitionsRepository.update(id, {
      display_name: patch.display_name,
      description: patch.description,
      definition: definitionPatch,
      status: patch.status,
      version: patch.version,
    });

    this.cache.invalidateDefinitionByRecordId(updated.id);
    const resolved = this.toResolvedDefinition(updated);
    this.cacheResolvedDefinition(resolved, { cacheLatest: true });

    return updated;
  }

  async getDefinitionById(
    id: string,
  ): Promise<OrchestrationResolvedDefinition | null> {
    const record = await this.definitionsRepository.getById(id);
    if (!record) {
      return null;
    }

    return this.toResolvedDefinition(record);
  }

  async getDefinitionForExecution(options: {
    ownerAgentSlug: string;
   organizationSlug: string;
   name: string;
   version?: string;
  }): Promise<OrchestrationResolvedDefinition> {
    const cacheKey = {
      ownerAgentSlug: options.ownerAgentSlug,
      organizationSlug: options.organizationSlug,
      name: options.name,
      version: options.version ?? null,
    } satisfies DefinitionCacheKey;

    const cached = this.cache.getDefinition(cacheKey);
    if (cached) {
      return cached;
    }

    const record = await this.definitionsRepository.findByOwnerAndName(
      options.ownerAgentSlug,
      options.organizationSlug,
      options.name,
      options.version,
    );

    if (!record) {
      throw new BadRequestException(
        `Orchestration definition ${options.name} not found for owner ${options.ownerAgentSlug}`,
      );
    }

    const resolved = this.toResolvedDefinition(record);
    const cacheLatest = !options.version;
    this.cacheResolvedDefinition(resolved, { cacheLatest });

    return resolved;
  }

  async listDefinitions(
    organizationSlug: string,
  ): Promise<OrchestrationResolvedDefinition[]> {
    const records =
      await this.definitionsRepository.listByOrganization(organizationSlug);
    return records.map((record) => this.toResolvedDefinition(record));
  }

  // ---------------------------------------------------------------------------
  // Validation Helpers
  // ---------------------------------------------------------------------------

  private normalizeDefinition(
    definition: Record<string, any>,
  ): OrchestrationDefinitionSchema {
    const clone =
      definition && typeof definition === 'object'
        ? JSON.parse(JSON.stringify(definition))
        : {};

    if (!clone.orchestration) {
      clone.orchestration = {};
    }

    if (!Array.isArray(clone.orchestration.steps)) {
      clone.orchestration.steps = [];
    }

    if (!Array.isArray(clone.orchestration.parameters)) {
      clone.orchestration.parameters = [];
    }

    // Normalize step modes to uppercase
    clone.orchestration.steps = clone.orchestration.steps.map(
      (step: OrchestrationStepDefinition, index: number) => {
        const normalizedType =
          typeof step.type === 'string'
            ? (step.type as string).toLowerCase()
            : 'agent';

        const orchestrationConfig =
          step.orchestration && typeof step.orchestration === 'object'
            ? JSON.parse(JSON.stringify(step.orchestration))
            : undefined;

        return {
          ...step,
          id: step.id || `step_${index + 1}`,
          mode: (step.mode || 'BUILD').toUpperCase(),
          depends_on: Array.isArray(step.depends_on) ? step.depends_on : [],
          type:
            normalizedType === 'orchestration' ? 'orchestration' : 'agent',
          orchestration: orchestrationConfig,
        };
      },
    );

    return clone as OrchestrationDefinitionSchema;
  }

  private validateDefinition(definition: OrchestrationDefinitionSchema): void {
    if (!definition.orchestration) {
      throw new BadRequestException(
        'Orchestration definition missing orchestration section',
      );
    }

    const steps = definition.orchestration.steps;
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new BadRequestException(
        'Orchestration definition must include at least one step',
      );
    }

    const stepIds = new Set<string>();
    steps.forEach((step) => {
      if (!step.id) {
        throw new BadRequestException(
          'Each orchestration step must have an id',
        );
      }

      if (stepIds.has(step.id)) {
        throw new BadRequestException(`Duplicate step id detected: ${step.id}`);
      }

      stepIds.add(step.id);

      this.validateStepConfiguration(step);
    });

    // Validate dependencies (no unknown references, no self dependency)
    steps.forEach((step) => {
      (step.depends_on || []).forEach((dependency) => {
        if (dependency === step.id) {
          throw new BadRequestException(
            `Step ${step.id} cannot depend on itself`,
          );
        }

        if (!stepIds.has(dependency)) {
          throw new BadRequestException(
            `Step ${step.id} depends on unknown step ${dependency}`,
          );
        }
      });
    });

    // Detect circular dependencies using DFS
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const adjacency = new Map<string, string[]>();

    steps.forEach((step) =>
      adjacency.set(step.id, step.depends_on ? [...step.depends_on] : []),
    );

    const hasCycle = (node: string): boolean => {
      if (visiting.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }
      visiting.add(node);
      for (const neighbor of adjacency.get(node) || []) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.id)) {
        throw new BadRequestException(
          `Circular dependency detected involving step ${step.id}`,
        );
      }
    }
  }

  private toResolvedDefinition(
    record: OrchestrationDefinitionRecord,
  ): OrchestrationResolvedDefinition {
    const normalized = this.normalizeDefinition(record.definition);

    return {
      recordId: record.id,
      ownerAgentSlug: record.owner_agent_slug,
      organizationSlug: record.organization_slug,
      name: record.name,
      displayName: record.display_name,
      version: record.version,
      description: record.description,
      steps: normalized.orchestration.steps,
      parameters: normalized.orchestration.parameters ?? [],
      rawDefinition: record.definition,
      execution: this.extractExecutionConfig(record.definition),
    };
  }

  private validateStepConfiguration(step: OrchestrationStepDefinition): void {
    const stepType =
      typeof step.type === 'string'
        ? (step.type as string).toLowerCase()
        : 'agent';

    if (!['agent', 'orchestration'].includes(stepType)) {
      throw new BadRequestException(
        `Step ${step.id} has unsupported type ${step.type}`,
      );
    }

    if (
      step.mode &&
      !['CONVERSE', 'PLAN', 'BUILD', 'ORCHESTRATION'].includes(
        step.mode.toUpperCase(),
      )
    ) {
      throw new BadRequestException(
        `Step ${step.id} has unsupported mode ${step.mode}`,
      );
    }

    if (stepType === 'agent') {
      if (!step.agent) {
        throw new BadRequestException(
          `Step ${step.id} missing required agent slug`,
        );
      }
      return;
    }

    const orchestrationConfig = step.orchestration;
    if (!orchestrationConfig || !orchestrationConfig.name) {
      throw new BadRequestException(
        `Step ${step.id} missing orchestration target`,
      );
    }

    if (!step.agent && !orchestrationConfig.owner) {
      throw new BadRequestException(
        `Step ${step.id} must specify agent or orchestration.owner to execute sub-orchestration`,
      );
    }
  }

  private cacheResolvedDefinition(
    definition: OrchestrationResolvedDefinition,
    options: { cacheLatest: boolean },
  ): void {
    const baseKey: DefinitionCacheKey = {
      ownerAgentSlug: definition.ownerAgentSlug,
      organizationSlug: definition.organizationSlug ?? 'global',
      name: definition.name,
      version: definition.version ?? null,
    };

    this.cache.setDefinition(baseKey, definition);

    if (options.cacheLatest) {
      this.cache.setDefinition(
        {
          ...baseKey,
          version: null,
        },
        definition,
      );
    }
  }

  private extractExecutionConfig(
    rawDefinition: Record<string, any>,
  ): OrchestrationExecutionConfig | null {
    const orchestration = this.asRecord(
      (rawDefinition?.orchestration as Record<string, any> | undefined) ?? null,
    );
    if (!orchestration) {
      return null;
    }

    const executionRaw = this.asRecord(
      (orchestration.execution as Record<string, any> | undefined) ?? null,
    );
    if (!executionRaw) {
      return null;
    }

    const concurrency = this.normalizeConcurrencyConfig(
      this.asRecord(
        (executionRaw.concurrency as Record<string, any> | undefined) ??
          (executionRaw.parallelism as Record<string, any> | undefined) ??
          null,
      ),
    );
    const caching = this.normalizeCachingConfig(
      this.asRecord(
        (executionRaw.caching as Record<string, any> | undefined) ?? null,
      ),
    );

    if (!concurrency && !caching) {
      return null;
    }

    return {
      concurrency,
      caching,
    };
  }

  private normalizeConcurrencyConfig(
    raw: Record<string, any> | null,
  ): OrchestrationExecutionConfig['concurrency'] {
    if (!raw) {
      return null;
    }

    const maxParallel = this.coerceNumber(
      raw.maxParallel,
      raw.max_parallel,
      raw.maxParallelSteps,
      raw.max_parallel_steps,
      raw.maxConcurrent,
      raw.max_concurrent,
    );

    const queueStrategyRaw =
      typeof raw.queueStrategy === 'string'
        ? raw.queueStrategy
        : typeof raw.queue_strategy === 'string'
          ? raw.queue_strategy
          : typeof raw.strategy === 'string'
            ? raw.strategy
            : undefined;

    const normalized: Record<string, any> = {};

    if (maxParallel !== null) {
      normalized.maxParallel = Math.max(
        1,
        Math.floor(Number(maxParallel ?? 1)),
      );
    }

    if (queueStrategyRaw) {
      const lowered = queueStrategyRaw.toLowerCase();
      if (['fifo', 'dependency'].includes(lowered)) {
        normalized.queueStrategy = lowered as 'fifo' | 'dependency';
      }
    }

    return Object.keys(normalized).length > 0
      ? (normalized as OrchestrationExecutionConfig['concurrency'])
      : null;
  }

  private normalizeCachingConfig(
    raw: Record<string, any> | null,
  ): OrchestrationExecutionConfig['caching'] {
    if (!raw) {
      return null;
    }

    const enabledRaw = raw.enabled ?? raw.enable ?? raw.isEnabled;
    const ttl = this.coerceNumber(
      raw.ttlSeconds,
      raw.ttl_seconds,
      raw.ttl,
      raw.stepTtl,
      raw.step_ttl,
    );
    const strategyRaw =
      typeof raw.strategy === 'string'
        ? raw.strategy
        : typeof raw.mode === 'string'
          ? raw.mode
          : undefined;

    const steps = Array.isArray(raw.steps)
      ? raw.steps
          .map((entry: any) => {
            const id = typeof entry?.id === 'string' ? entry.id : null;
            if (!id) {
              return null;
            }
            const stepEnabledRaw =
              entry.enabled ?? entry.enable ?? entry.isEnabled;
            const ttlValue = this.coerceNumber(
              entry.ttlSeconds,
              entry.ttl_seconds,
              entry.ttl,
            );
            const normalizedStep: Record<string, any> = {
              id,
            };
            if (stepEnabledRaw !== undefined) {
              normalizedStep.enabled =
                typeof stepEnabledRaw === 'string'
                  ? stepEnabledRaw.toLowerCase() === 'true'
                  : Boolean(stepEnabledRaw);
            }
            if (ttlValue !== null) {
              normalizedStep.ttlSeconds = Math.max(
                0,
                Math.floor(Number(ttlValue)),
              );
            }
            return normalizedStep;
          })
          .filter((entry) => entry !== null)
      : undefined;

    const normalized: Record<string, any> = {};

    if (enabledRaw !== undefined) {
      normalized.enabled =
        typeof enabledRaw === 'string'
          ? enabledRaw.toLowerCase() === 'true'
          : Boolean(enabledRaw);
    }

    if (ttl !== null) {
      normalized.ttlSeconds = Math.max(0, Math.floor(Number(ttl)));
    }

    if (strategyRaw) {
      const lowered = strategyRaw.toLowerCase();
      if (lowered === 'definition' || lowered === 'per_step') {
        normalized.strategy = lowered;
      }
    }

    if (steps && steps.length > 0) {
      normalized.steps = steps;
    }

    return Object.keys(normalized).length > 0
      ? (normalized as OrchestrationExecutionConfig['caching'])
      : null;
  }

  private coerceNumber(...values: Array<any>): number | null {
    for (const value of values) {
      if (value === undefined || value === null) {
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
    return { ...(value as Record<string, any>) };
  }
}
