import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationOutputMapper } from '@agent-platform/services/orchestration-output-mapper.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { AgentRuntimeAgentMetadata } from '@agent-platform/interfaces/agent-runtime-agent-metadata.interface';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { OrchestrationRunRecord } from '@agent-platform/interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '@agent-platform/interfaces/orchestration-step-record.interface';
import { OrchestrationStepUpdateInput } from '@agent-platform/interfaces/orchestration-step-record.interface';
import {
  OrchestrationCheckpointDecision,
  RequestOrchestrationCheckpointOptions,
} from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationDefinitionService } from '@agent-platform/services/orchestration-definition.service';
import { OrchestrationRunFactoryService } from '@agent-platform/services/orchestration-run-factory.service';
import {
  OrchestrationResolvedDefinition,
  OrchestrationSubDefinition,
} from '@agent-platform/types/orchestration-definition.types';

type StepProcessResult = {
  status: 'completed' | 'checkpoint' | 'failed';
  run: OrchestrationRunRecord;
};

@Injectable()
export class OrchestrationStepExecutorService {
  private readonly logger = new Logger(OrchestrationStepExecutorService.name);
  private readonly activeRuns = new Set<string>();

  constructor(
    private readonly executionService: OrchestrationExecutionService,
    private readonly runner: OrchestrationRunnerService,
    private readonly definitionService: OrchestrationDefinitionService,
    private readonly checkpointService: OrchestrationCheckpointService,
    private readonly outputMapper: OrchestrationOutputMapper,
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
    private readonly runtimeExecution: AgentRuntimeExecutionService,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly conversations: Agent2AgentConversationsService,
    private readonly runFactory: OrchestrationRunFactoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processRun(runId: string): Promise<void> {
    if (this.activeRuns.has(runId)) {
      this.logger.debug(`Orchestration run ${runId} already processing; skipping duplicate trigger.`);
      return;
    }

    this.activeRuns.add(runId);
    try {
      let start = await this.executionService.startExecution(runId);
      let run = start.run;
      let readySteps = start.readySteps;

      while (readySteps.length > 0) {
        let shouldHalt = false;

        for (const step of readySteps) {
          const stepResult = await this.executeStep(run, step);
          run = stepResult.run;

          if (stepResult.status === 'checkpoint' || stepResult.status === 'failed') {
            shouldHalt = true;
            break;
          }
        }

        if (shouldHalt) {
          break;
        }

        start = await this.executionService.startExecution(run.id);
        run = start.run;
        readySteps = start.readySteps;
      }
    } catch (error) {
      this.logger.error(
        `Failed to process orchestration run ${runId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  private async executeStep(
    run: OrchestrationRunRecord,
    queuedStep: OrchestrationStepRecord,
  ): Promise<StepProcessResult> {
    const step = queuedStep;
    const stepType = this.resolveStepType(step);

    if (stepType === 'orchestration') {
      return this.executeSubOrchestrationStep(run, step);
    }

    if (!step.agent_slug) {
      await this.markFailedDueToConfiguration(
        run,
        step,
        'Step is missing agent configuration',
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const userId = this.resolveUserId(run);
    const conversationId = await this.ensureConversation(run, step, userId);

    const resolvedInput = this.resolveStepInput(step, run);

    const agentRecord = await this.agentRegistry.getAgent(
      run.organization_slug,
      step.agent_slug,
    );

    if (!agentRecord) {
      await this.markFailedDueToConfiguration(
        run,
        step,
        `Agent ${step.agent_slug} not found`,
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const definition =
      this.runtimeDefinitions.buildDefinition(agentRecord);
    const agentMetadata = this.runtimeExecution.getAgentMetadataFromDefinition(
      definition,
      run.organization_slug,
    );
    const taskRequest = this.buildTaskRequest(
      run,
      step,
      conversationId,
      userId,
      resolvedInput.resolvedInput,
      resolvedInput.userMessage,
      resolvedInput.payload,
      agentMetadata,
    );

    const unsupportedResponse = this.checkUnsupportedMode(
      definition,
      taskRequest.mode!,
    );
    if (unsupportedResponse) {
      await this.markStepFailedWithResponse(step, unsupportedResponse);
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const policyAssessment = await this.routingPolicy.evaluate(
      taskRequest,
      agentRecord,
    );

    if (policyAssessment.showstopper) {
      await this.markStepFailedWithResponse(
        step,
        TaskResponseDto.human(
          policyAssessment.humanMessage ??
            'Routing policy requires human review.',
          'routing_showstopper',
        ),
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const runningStep = await this.executionService.markStepRunning(step.id);

    let agentResponse: TaskResponseDto;
    try {
      agentResponse = await this.modeRouter.execute({
        organizationSlug: run.organization_slug,
        agentSlug: agentRecord.slug,
        agent: agentRecord,
        definition,
        request: taskRequest,
        routingMetadata: policyAssessment.metadata,
      });
    } catch (error) {
      await this.executionService.markStepFailed(runningStep.id, {
        message: error instanceof Error ? error.message : String(error),
        type: 'agent_execution_error',
      });
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    if (!agentResponse.success) {
      await this.markStepFailedWithResponse(runningStep, agentResponse);
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const mapping = this.outputMapper.map(
      agentResponse.payload,
      (step.metadata?.outputMapping ?? undefined) as Record<string, any> | undefined,
    );

    const metadataPatch = this.buildMetadataPatch(
      step,
      resolvedInput.resolvedInput,
      agentResponse,
    );

    const update: OrchestrationStepUpdateInput = {
      conversation_id: conversationId,
      deliverable_id: mapping.deliverableId ?? null,
      metadata: metadataPatch,
    };

    const completion = await this.executionService.markStepCompleted(
      runningStep.id,
      mapping.output,
      update,
    );

    const checkpointConfig = this.resolveCheckpointConfig(step);
    if (checkpointConfig) {
      const checkpointResult = await this.requestCheckpoint({
        run: completion.run,
        step: runningStep,
        question: checkpointConfig.question,
        options: checkpointConfig.options,
        required: checkpointConfig.required,
        conversationId,
        organizationSlug: run.organization_slug,
      });

      return {
        status: 'checkpoint',
        run: checkpointResult.run,
      };
    }

    return {
      status: 'completed',
      run: completion.run,
    };
  }

  private async executeSubOrchestrationStep(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
  ): Promise<StepProcessResult> {
    const runningStep = await this.executionService.markStepRunning(step.id);
    const config = this.extractOrchestrationConfig(step);

    if (!config || !config.name) {
      await this.markFailedDueToConfiguration(
        run,
        runningStep,
        'Sub-orchestration step missing orchestration name',
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const ownerSlug = this.resolveChildOrchestrationOwner(config, step, run);
    if (!ownerSlug) {
      await this.markFailedDueToConfiguration(
        run,
        runningStep,
        'Sub-orchestration step missing owner agent slug',
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const childParameters = this.resolveChildParameters(
      config.parameters,
      run,
    );

    let childDefinition: OrchestrationResolvedDefinition;
    try {
      childDefinition = await this.definitionService.getDefinitionForExecution({
        ownerAgentSlug: ownerSlug,
        organizationSlug: run.organization_slug ?? 'global',
        name: config.name,
        version: config.version,
      });
    } catch (error) {
      await this.markFailedDueToConfiguration(
        run,
        runningStep,
        `Failed to resolve sub-orchestration definition ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    const agentRecord = await this.resolveAgentRecord(
      ownerSlug,
      run.organization_slug,
    );
    if (!agentRecord) {
      await this.markFailedDueToConfiguration(
        run,
        runningStep,
        `Orchestrator agent ${ownerSlug} not found`,
      );
      const refreshed = (await this.runner.getRun(run.id)) ?? run;
      return { status: 'failed', run: refreshed };
    }

    let stepMetadata = this.mergeStepMetadata(
      runningStep.metadata as Record<string, any> | undefined,
      this.buildInitialChildMetadataPatch(config, childDefinition, {
        ownerSlug,
        parameters: childParameters,
      }),
    );

    await this.runner.updateStep(runningStep.id, {
      metadata: stepMetadata,
    });

    const childRunMetadata = this.buildChildRunMetadata(run, runningStep, {
      ownerSlug,
      definition: childDefinition,
    });

    const factoryResult = await this.runFactory.createRunFromDefinition({
      definition: childDefinition,
      parameters: childParameters,
      conversationId: this.shouldInheritConversation(config)
        ? run.conversation_id ?? null
        : null,
      parentRunId: run.id,
      organizationSlug: childDefinition.organizationSlug,
      agent: {
        id: agentRecord.id ?? null,
        slug: ownerSlug,
        type: agentRecord.agent_type ?? null,
        displayName: agentRecord.display_name ?? ownerSlug,
      },
      createdBy: run.created_by ?? null,
      requestMetadata: this.buildChildRequestMetadata(run, runningStep),
      metadata: childRunMetadata,
    });

    const childRunId = factoryResult.run.id;
    stepMetadata = this.mergeStepMetadata(stepMetadata, {
      runtime: {
        subOrchestration: {
          childRunId,
        },
      },
    });

    await this.runner.updateStep(runningStep.id, {
      metadata: stepMetadata,
    });

    let finalChildRun: OrchestrationRunRecord | null = null;

    while (true) {
      await this.processRun(childRunId);

      const current = await this.runner.getRun(childRunId);
      if (!current) {
        const failure = await this.executionService.markStepFailed(
          runningStep.id,
          {
            type: 'child_orchestration_missing',
            message: `Child orchestration run ${childRunId} no longer exists`,
          },
        );
        return { status: 'failed', run: failure.run };
      }

      if (this.isTerminalRunStatus(current.status)) {
        finalChildRun = current;
        break;
      }

      if (current.status === 'checkpoint') {
        const latest = await this.runner.getRun(childRunId);
        if (latest && latest.status !== 'checkpoint') {
          continue;
        }
        await this.waitForRunEvent(childRunId, [
          'orchestration.checkpoint.resolved',
          'orchestration.run.failed',
          'orchestration.run.completed',
        ]);
        continue;
      }

      await this.waitForRunEvent(childRunId, [
        'orchestration.run.updated',
        'orchestration.run.failed',
        'orchestration.run.completed',
      ]);
    }

    stepMetadata = this.mergeStepMetadata(stepMetadata, {
      runtime: {
        subOrchestration: {
          completedAt: finalChildRun?.completed_at ?? null,
          status: finalChildRun?.status ?? null,
        },
      },
    });

    if (
      !finalChildRun ||
      !this.isSuccessfulRun(finalChildRun.status)
    ) {
      await this.runner.updateStep(runningStep.id, {
        metadata: stepMetadata,
      });

      const failureDetails = {
        type:
          finalChildRun?.status === 'aborted'
            ? 'child_orchestration_aborted'
            : 'child_orchestration_failed',
        childRunId,
        status: finalChildRun?.status ?? 'unknown',
        error: finalChildRun?.error_details ?? {},
      };

      const failure = await this.executionService.markStepFailed(
        runningStep.id,
        failureDetails,
      );
      return { status: 'failed', run: failure.run };
    }

    const output = this.buildChildRunOutput(finalChildRun);
    const completion = await this.executionService.markStepCompleted(
      runningStep.id,
      output,
      {
        metadata: stepMetadata,
      },
    );

    return {
      status: 'completed',
      run: completion.run,
    };
  }

  private checkUnsupportedMode(
    definition: any,
    mode: AgentTaskMode,
  ): TaskResponseDto | null {
    const exec = definition.execution;
    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return exec.canConverse
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.PLAN:
        return exec.canPlan
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.BUILD:
        return exec.canBuild
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      default:
        return null;
    }
  }

  private async markStepFailedWithResponse(
    step: OrchestrationStepRecord,
    response: TaskResponseDto,
  ) {
    await this.executionService.markStepFailed(step.id, {
      message:
        response.humanResponse?.message ??
        response.payload?.metadata?.reason ??
        'Agent execution returned human gate',
      mode: response.mode,
      payload: response.payload,
    });
  }

  private async markFailedDueToConfiguration(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    message: string,
  ) {
    await this.executionService.markStepFailed(step.id, {
      message,
      type: 'configuration_error',
      runId: run.id,
      stepId: step.step_id ?? step.id,
    });
  }

  private resolveCheckpointConfig(
    step: OrchestrationStepRecord,
  ):
    | {
        question: string;
        options?: RequestOrchestrationCheckpointOptions['options'];
        required?: boolean;
      }
    | null {
    const checkpoint =
      (step.metadata?.checkpoint as Record<string, any> | null) ?? null;
    if (!checkpoint || typeof checkpoint !== 'object') {
      return null;
    }

    if (!checkpoint.question) {
      return null;
    }

    return {
      question: String(checkpoint.question),
      options: Array.isArray(checkpoint.options)
        ? checkpoint.options.map((option: Record<string, any>) => ({
            action: option.action as OrchestrationCheckpointDecision,
            label: option.label,
            allowsModification: option.allows_modification ?? false,
            description: option.description ?? undefined,
          }))
        : undefined,
      required:
        typeof checkpoint.required === 'boolean'
          ? checkpoint.required
          : undefined,
    };
  }

  private async requestCheckpoint(options: {
    run: OrchestrationRunRecord;
    step: OrchestrationStepRecord;
    question: string;
    options?: Array<{
      action: OrchestrationCheckpointDecision;
      label: string;
      allowsModification?: boolean;
      description?: string;
    }>;
    required?: boolean;
    conversationId: string | null;
    organizationSlug: string | null;
  }): Promise<{
    run: OrchestrationRunRecord;
  }> {
    const run = options.run;
    const step = options.step;
    const checkpointId = `${step.step_id ?? step.id}-checkpoint`;

    const request = await this.checkpointService.requestCheckpoint({
      runId: run.id,
      checkpointId,
      question: options.question,
      agentSlug:
        (run.metadata?.agent as Record<string, any> | undefined)?.slug ??
        run.orchestration_name ??
        'orchestrator',
      stepId: step.step_id ?? null,
      stepRecordId: step.id,
      stepLabel: (step.metadata?.name as string | undefined) ?? step.step_id ?? undefined,
      stepIndex: step.step_index,
      options: options.options,
      organizationSlug: options.organizationSlug ?? run.organization_slug,
      conversationId: options.conversationId,
    });

    return {
      run: request.run,
    };
  }

  private resolveUserId(run: OrchestrationRunRecord): string | null {
    const fromRun = run.created_by ?? null;
    const requestMetadata = (run.metadata?.requestMetadata ??
      {}) as Record<string, any>;
    const fallback =
      requestMetadata.userId ??
      requestMetadata.createdBy ??
      process.env.SYSTEM_USER_ID ??
      null;
    return (fromRun as string | null) ?? (fallback as string | null);
  }

  private async ensureConversation(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    userId: string | null,
  ): Promise<string | null> {
    if (step.conversation_id) {
      return step.conversation_id;
    }

    if (!userId) {
      return null;
    }

    try {
      const created = await this.conversations.createConversation(
        userId,
        step.agent_slug ?? 'unknown-agent',
        (run.organization_slug ?? 'global') || 'global',
        {
          metadata: {
            orchestrationRunId: run.id,
            orchestrationStepId: step.step_id ?? step.id,
          },
        },
      );

      await this.runner.updateStep(step.id, {
        conversation_id: created.id,
      });

      return created.id;
    } catch (error) {
      this.logger.warn(
        `Failed to create conversation for step ${step.step_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private extractOrchestrationConfig(
    step: OrchestrationStepRecord,
  ): OrchestrationSubDefinition | null {
    const metadata = (step.metadata ?? {}) as Record<string, any>;
    const config = metadata.orchestration;
    if (!config || typeof config !== 'object') {
      return null;
    }
    try {
      const clone = JSON.parse(JSON.stringify(config));
      if (clone && typeof clone === 'object') {
        delete (clone as Record<string, any>).runtime;
      }
      return clone;
    } catch (_error) {
      const fallback = { ...(config as OrchestrationSubDefinition) };
      delete (fallback as Record<string, any>).runtime;
      return fallback;
    }
  }

  private resolveStepType(
    step: OrchestrationStepRecord,
  ): 'agent' | 'orchestration' {
    const metadata = (step.metadata ?? {}) as Record<string, any>;
    const rawType =
      typeof metadata.type === 'string'
        ? metadata.type
        : typeof metadata.stepType === 'string'
          ? metadata.stepType
          : null;
    if ((step.mode ?? '').toString().toUpperCase() === 'ORCHESTRATION') {
      return 'orchestration';
    }
    return rawType && rawType.toLowerCase() === 'orchestration'
      ? 'orchestration'
      : 'agent';
  }

  private resolveChildOrchestrationOwner(
    config: OrchestrationSubDefinition | null,
    step: OrchestrationStepRecord,
    run: OrchestrationRunRecord,
  ): string | null {
    const candidates = [
      config?.owner,
      step.agent_slug,
      (run.metadata?.agent as Record<string, any> | undefined)?.slug,
      (run.metadata as Record<string, any> | undefined)?.agentSlug,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private resolveChildParameters(
    template: Record<string, any> | undefined,
    run: OrchestrationRunRecord,
  ): Record<string, any> {
    if (!template || typeof template !== 'object') {
      return {};
    }

    const clone = this.cloneValue(template);
    const resolved = this.interpolateValues(clone, run);
    if (!resolved || typeof resolved !== 'object') {
      return {};
    }
    return resolved as Record<string, any>;
  }

  private async resolveAgentRecord(
    slug: string,
    organizationSlug: string | null,
  ): Promise<AgentRecord | null> {
    const direct = await this.agentRegistry.getAgent(organizationSlug, slug);
    if (direct) {
      return direct;
    }

    if (organizationSlug === 'global') {
      return null;
    }

    return this.agentRegistry.getAgent('global', slug);
  }

  private mergeStepMetadata(
    current: Record<string, any> | undefined,
    patch: Record<string, any>,
  ): Record<string, any> {
    const base =
      current && typeof current === 'object'
        ? this.cloneValue(current)
        : {};
    this.mergeInto(base, patch);
    return base;
  }

  private buildInitialChildMetadataPatch(
    config: OrchestrationSubDefinition,
    definition: OrchestrationResolvedDefinition,
    context: { ownerSlug: string; parameters: Record<string, any> },
  ): Record<string, any> {
    const patch: Record<string, any> = {
      type: 'orchestration',
      runtime: {
        subOrchestration: {
          ownerSlug: context.ownerSlug,
          target: {
            name: definition.name,
            definitionId: definition.recordId ?? null,
            version: definition.version,
          },
          parameters: context.parameters,
          initiatedAt: new Date().toISOString(),
        },
      },
    };

    if (config && typeof config === 'object') {
      patch.orchestration = this.cloneValue(config);
    }

    return patch;
  }

  private buildChildRunMetadata(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    context: {
      ownerSlug: string;
      definition: OrchestrationResolvedDefinition;
    },
  ): Record<string, any> {
    return {
      parent: {
        runId: run.id,
        stepRecordId: step.id,
        stepDefinitionId: step.step_id ?? null,
        stepIndex: step.step_index,
      },
      subOrchestration: {
        ownerSlug: context.ownerSlug,
        definitionId: context.definition.recordId ?? null,
        definitionName: context.definition.name,
        version: context.definition.version,
      },
    };
  }

  private buildChildRequestMetadata(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
  ): Record<string, any> {
    return {
      parentRunId: run.id,
      parentStepId: step.step_id ?? null,
      parentStepRecordId: step.id,
      parentStepIndex: step.step_index,
      conversationId: run.conversation_id ?? null,
    };
  }

  private shouldInheritConversation(
    config: OrchestrationSubDefinition | null,
  ): boolean {
    return Boolean(config?.inherit_conversation);
  }

  private isTerminalRunStatus(
    status: string | null | undefined,
  ): boolean {
    if (!status) {
      return false;
    }
    const normalized = status.toLowerCase();
    return (
      normalized === 'completed' ||
      normalized === 'failed' ||
      normalized === 'aborted' ||
      normalized === 'cancelled'
    );
  }

  private isSuccessfulRun(status: string | null | undefined): boolean {
    return (status ?? '').toLowerCase() === 'completed';
  }

  private buildChildRunOutput(
    childRun: OrchestrationRunRecord,
  ): Record<string, any> {
    return {
      orchestrationRunId: childRun.id,
      status: childRun.status,
      results: this.cloneValue(childRun.results ?? {}),
      parameters: this.cloneValue(childRun.parameters ?? {}),
      plan: this.cloneValue(childRun.plan ?? {}),
      metadata: this.cloneValue(childRun.metadata ?? {}),
      completedSteps: this.cloneValue(childRun.completed_steps ?? []),
      errorDetails: this.cloneValue(childRun.error_details ?? {}),
      timings: {
        startedAt: childRun.started_at ?? null,
        completedAt: childRun.completed_at ?? null,
      },
    };
  }

  private async waitForRunEvent(
    runId: string,
    eventNames: string[],
    timeoutMs = 300_000,
  ): Promise<void> {
    if (!eventNames.length) {
      return;
    }

    await new Promise<void>((resolve) => {
      let resolved = false;
      const handlers: Array<(payload: any) => void> = [];

      const cleanup = () => {
        handlers.forEach((handler, index) => {
          const eventName = eventNames[index];
          if (eventName) {
            this.eventEmitter.off(eventName, handler);
          }
        });
      };

      const timer = setTimeout(() => {
        if (resolved) {
          return;
        }
        resolved = true;
        cleanup();
        resolve();
      }, timeoutMs);

      eventNames.forEach((eventName) => {
        const handler = (payload: any) => {
          if (resolved) {
            return;
          }
          const payloadRunId =
            payload?.runId ??
            payload?.run?.id ??
            payload?.data?.runId ??
            payload?.data?.run?.id;

          if (payloadRunId !== runId) {
            return;
          }

          resolved = true;
          clearTimeout(timer);
          cleanup();
          resolve();
        };

        handlers.push(handler);
        this.eventEmitter.on(eventName, handler);
      });
    });
  }

  private buildTaskRequest(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    conversationId: string | null,
    userId: string | null,
    resolvedInput: Record<string, any>,
    userMessage?: string,
    payload?: Record<string, any> | undefined,
    agentMetadata?: AgentRuntimeAgentMetadata,
  ): TaskRequestDto {
    const request = new TaskRequestDto();
    request.mode = this.normalizeMode(step.mode);
    request.conversationId = conversationId ?? undefined;
    request.orchestrationRunId = run.id;
    request.payload =
      payload && Object.keys(payload).length > 0 ? payload : undefined;
    request.userMessage = typeof userMessage === 'string' ? userMessage : undefined;
    request.metadata = this.buildRequestMetadata(
      run,
      step,
      userId,
      resolvedInput,
      agentMetadata,
    );

    return request;
  }

  private buildRequestMetadata(
    run: OrchestrationRunRecord,
    step: OrchestrationStepRecord,
    userId: string | null,
    resolvedInput: Record<string, any>,
    agentMetadata?: AgentRuntimeAgentMetadata,
  ): Record<string, any> {
    const baseMetadata = {
      ...(run.metadata?.requestMetadata ?? {}),
      orchestrationRunId: run.id,
      orchestrationStepId: step.step_id ?? step.id,
      orchestrationStepIndex: step.step_index,
      attempt: step.attempt_number,
      userId: userId ?? undefined,
      actorId: userId ?? undefined,
      stream: false,
      resolvedInput,
    };

    return this.runtimeExecution.buildRunMetadata(baseMetadata, {
      id: agentMetadata?.id ?? null,
      slug: agentMetadata?.slug ?? '',
      displayName: agentMetadata?.displayName ?? null,
      type: agentMetadata?.type ?? null,
      organizationSlug: agentMetadata?.organizationSlug ?? run.organization_slug,
    });
  }

  private resolveStepInput(
    step: OrchestrationStepRecord,
    run: OrchestrationRunRecord,
  ): {
    resolvedInput: Record<string, any>;
    userMessage?: string;
    payload?: Record<string, any>;
  } {
    const baseInput =
      step.input && typeof step.input === 'object'
        ? this.cloneValue(step.input)
        : {};
    const resolved = this.interpolateValues(baseInput, run);

    const stepKey = step.step_id ?? step.id;
    const checkpointState =
      run.step_state?.[stepKey]?.checkpoint ?? ({} as Record<string, any>);
    if (checkpointState?.modifications) {
      this.mergeInto(resolved, checkpointState.modifications);
    }

    const { userMessage, ...rest } = resolved as Record<string, any>;
    const payload =
      rest && Object.keys(rest).length > 0 ? rest : undefined;

    return {
      resolvedInput: resolved,
      userMessage:
        typeof userMessage === 'string' ? (userMessage as string) : undefined,
      payload,
    };
  }

  private interpolateValues(value: any, run: OrchestrationRunRecord): any {
    if (typeof value === 'string') {
      return this.interpolateString(value, run);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolateValues(item, run));
    }

    if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      Object.entries(value).forEach(([key, entry]) => {
        result[key] = this.interpolateValues(entry, run);
      });
      return result;
    }

    return value;
  }

  private interpolateString(
    template: string,
    run: OrchestrationRunRecord,
  ): any {
    const trimmed = template.trim();
    const singleMatch = trimmed.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (singleMatch?.[1]) {
      const value = this.resolveExpression(singleMatch[1], run);
      return value ?? null;
    }

    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
      const value = this.resolveExpression(expr, run);
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (_error) {
          return '';
        }
      }
      return String(value);
    });
  }

  private resolveExpression(
    expression: string,
    run: OrchestrationRunRecord,
  ): any {
    const tokens = this.tokenizeExpression(expression);
    if (!tokens.length) {
      return undefined;
    }

    let current: any;
    const [first, ...rest] = tokens;

    switch (first) {
      case 'steps':
        current = run.results ?? {};
        break;
      case 'parameters':
        current = run.parameters ?? {};
        break;
      case 'run':
        current = run;
        break;
      default:
        current = first ? (run.parameters ?? {})[first] : undefined;
        break;
    }

    const remaining = first === 'steps' || first === 'parameters' || first === 'run'
      ? rest
      : rest;

    for (const segment of remaining) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = this.accessSegment(current, segment);
    }

    return current;
  }

  private tokenizeExpression(expression: string): string[] {
    return expression
      .split('.')
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  }

  private accessSegment(target: any, segment: string): any {
    if (segment.length === 0) {
      return target;
    }

    let remainder = segment;
    let current = target;

    const fieldMatch = remainder.match(/^([^\[\]]+)/);
    if (fieldMatch?.[1]) {
      const fieldName = fieldMatch[1];
      current = current?.[fieldName];
      remainder = remainder.slice(fieldName.length);
    }

    const indexRegex = /\[(\d+)\]/g;
    let indexMatch: RegExpExecArray | null;
    while ((indexMatch = indexRegex.exec(remainder))) {
      const index = Number(indexMatch[1]);
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[index];
    }

    return current;
  }

  private mergeInto(target: Record<string, any>, patch: Record<string, any>) {
    Object.entries(patch).forEach(([key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        this.mergeInto(target[key], value);
      } else {
        target[key] = this.cloneValue(value);
      }
    });
  }

  private buildMetadataPatch(
    step: OrchestrationStepRecord,
    resolvedInput: Record<string, any>,
    response: TaskResponseDto,
  ): Record<string, any> {
    const baseMetadata =
      (step.metadata ?? {}) as Record<string, any>;
    const runtimeMeta =
      (baseMetadata.runtime as Record<string, any> | undefined) ?? {};

    const snapshot: {
      content: any;
      metadata: Record<string, any>;
      deliverables?: Array<{ id: string | null; title: string | null; versionId: string | null }>;
    } = {
      content: this.cloneValue(response.payload?.content ?? null),
      metadata: this.cloneValue(response.payload?.metadata ?? {}),
    };

    const deliverables = (response as any)?.payload?.deliverables;
    if (Array.isArray(deliverables) && deliverables.length > 0) {
      snapshot.deliverables = deliverables.map((item: any) => ({
        id: item?.id ?? null,
        title: item?.title ?? null,
        versionId: item?.versionId ?? item?.version_id ?? null,
      }));
    }

    return {
      ...baseMetadata,
      runtime: {
        ...runtimeMeta,
        resolvedInput,
        agentResponse: snapshot,
        mappingRules: baseMetadata.outputMapping ?? null,
        completedAt: new Date().toISOString(),
      },
    };
  }

  private normalizeMode(mode: string | null | undefined): AgentTaskMode {
    switch ((mode ?? 'BUILD').toUpperCase()) {
      case 'CONVERSE':
        return AgentTaskMode.CONVERSE;
      case 'PLAN':
        return AgentTaskMode.PLAN;
      case 'BUILD':
      default:
        return AgentTaskMode.BUILD;
    }
  }

  private cloneValue<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_error) {
        return value;
      }
    }

    return value;
  }
}
