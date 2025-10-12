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
    parameters: Record<string, any> = {},
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

      const insert: OrchestrationStepInsertInput = {
        orchestration_run_id: run.id,
        step_index: index,
        step_id: stepDefinition.id,
        status: 'pending',
        agent_slug:
          stepDefinition.agent ??
          stepDefinition.orchestration?.owner ??
          null,
        mode:
          stepType === 'orchestration'
            ? 'ORCHESTRATION'
            : stepDefinition.mode ?? 'BUILD',
        depends_on: stepDefinition.depends_on ?? [],
        input: inputPayload,
        metadata: {
          name: stepDefinition.name,
          checkpoint: stepDefinition.checkpoint_after ?? null,
          rawInput: stepDefinition.input ?? null,
          rawContext: stepDefinition.context ?? null,
          outputMapping: stepDefinition.output_mapping ?? null,
          type: stepType === 'orchestration' ? 'orchestration' : 'agent',
          orchestration: stepDefinition.orchestration
            ? JSON.parse(JSON.stringify(stepDefinition.orchestration))
            : null,
        },
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
  async findRunnableSteps(runId: string): Promise<OrchestrationStepRecord[]> {
    const steps = await this.orchestrationRunner.listSteps(runId);
    const completed = new Set(
      steps
        .filter((step) => step.status === 'completed')
        .map((step) => step.step_id),
    );

    return steps.filter((step) => {
      if (step.status !== 'pending') {
        return false;
      }
      return (step.depends_on ?? []).every((dependency) =>
        completed.has(dependency),
      );
    });
  }

  /**
   * Prepare step input by resolving parameter placeholders.
   * We only replace top-level parameter placeholders; step output references
   * remain intact for downstream resolution.
   */
  private prepareStepInput(
    template: Record<string, any>,
    parameters: Record<string, any>,
  ): Record<string, any> {
    const resolveValue = (value: any): any => {
      if (typeof value === 'string') {
        return value.replace(
          /{{\s*([a-zA-Z0-9_\.]+)\s*}}/g,
          (_, expression: string) => {
            if (expression.startsWith('steps.')) {
              // Defer step output interpolation to runtime resolution
              return `{{ ${expression} }}`;
            }

            const paramValue = this.lookupParameter(expression, parameters);
            return paramValue !== undefined ? String(paramValue) : '';
          },
        );
      }

      if (Array.isArray(value)) {
        return value.map((entry) => resolveValue(entry));
      }

      if (value && typeof value === 'object') {
        const resolved: Record<string, any> = {};
        Object.entries(value).forEach(([key, entry]) => {
          resolved[key] = resolveValue(entry);
        });
        return resolved;
      }

      return value;
    };

    return resolveValue(template);
  }

  private lookupParameter(
    expression: string,
    parameters: Record<string, any>,
  ): any {
    if (expression in parameters) {
      return parameters[expression];
    }

    // Support dotted notation (e.g., context.org.slug)
    const segments = expression.split('.');
    let current: any = parameters;
    for (const segment of segments) {
      if (
        current &&
        typeof current === 'object' &&
        Object.prototype.hasOwnProperty.call(current, segment)
      ) {
        current = current[segment];
      } else {
        return undefined;
      }
    }
    return current;
  }
}
