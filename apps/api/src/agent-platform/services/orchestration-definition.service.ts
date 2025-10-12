import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OrchestrationDefinitionsRepository } from '../repositories/orchestration-definitions.repository';
import {
  OrchestrationDefinitionCreateInput,
  OrchestrationDefinitionRecord,
  OrchestrationDefinitionUpdateInput,
} from '../interfaces/orchestration-definition.interface';
import {
  OrchestrationDefinitionSchema,
  OrchestrationResolvedDefinition,
  OrchestrationStepDefinition,
} from '../types/orchestration-definition.types';

@Injectable()
export class OrchestrationDefinitionService {
  private readonly logger = new Logger(OrchestrationDefinitionService.name);

  constructor(
    private readonly definitionsRepository: OrchestrationDefinitionsRepository,
  ) {}

  async createDefinition(
    input: OrchestrationDefinitionCreateInput,
  ): Promise<OrchestrationDefinitionRecord> {
    const normalized = this.normalizeDefinition(input.definition);
    this.validateDefinition(normalized);

    return this.definitionsRepository.create({
      ...input,
      definition: normalized,
    });
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

    return this.definitionsRepository.update(id, {
      display_name: patch.display_name,
      description: patch.description,
      definition: definitionPatch,
      status: patch.status,
      version: patch.version,
    });
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

    return this.toResolvedDefinition(record);
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
}
