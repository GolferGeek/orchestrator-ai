import { OrchestratorAgentRunnerService } from './orchestrator-agent-runner.service';
import { OrchestrationDefinitionService } from '@agent-platform/services/orchestration-definition.service';
import { OrchestrationStateService } from '@agent-platform/services/orchestration-state.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationEventsService } from '@agent-platform/services/orchestration-events.service';
import { OrchestrationStepExecutorService } from './orchestration-step-executor.service';
import { OrchestrationRunFactoryService } from '@agent-platform/services/orchestration-run-factory.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';

const createAgentDefinition = (
  overrides: Partial<AgentRuntimeDefinition> = {},
): AgentRuntimeDefinition => ({
  id: 'agent-1',
  slug: 'finance-manager',
  organizationSlug: 'org-1',
  displayName: 'Finance Manager',
  description: null,
  agentType: 'orchestrator',
  modeProfile: 'full_cycle',
  metadata: { tags: [] },
  hierarchy: undefined,
  capabilities: [],
  skills: [],
  communication: { inputModes: ['text/plain'], outputModes: ['text/markdown'] },
  execution: {
    modeProfile: 'full_cycle',
    canConverse: true,
    canPlan: true,
    canBuild: true,
    canOrchestrate: true,
    requiresHumanGate: false,
  },
  transport: undefined,
  llm: undefined,
  prompts: { system: '', plan: '', build: '', human: '', additional: null },
  context: null,
  config: {
    orchestration: { available_orchestrations: ['kpi-tracking'] },
  },
  agentCard: null,
  rawDescriptor: null,
  record: {} as Record<string, unknown>,
  ...overrides,
});

describe('OrchestratorAgentRunnerService (Phase 2 A2A checkpoints)', () => {
  let definitionService: jest.Mocked<OrchestrationDefinitionService>;
  let stateService: jest.Mocked<OrchestrationStateService>;
  let runnerService: jest.Mocked<OrchestrationRunnerService>;
  let executionService: jest.Mocked<OrchestrationExecutionService>;
  let eventsService: jest.Mocked<OrchestrationEventsService>;
  let checkpointService: jest.Mocked<OrchestrationCheckpointService>;
  let stepExecutor: jest.Mocked<OrchestrationStepExecutorService>;
  let runFactory: jest.Mocked<OrchestrationRunFactoryService>;
  let service: OrchestratorAgentRunnerService;

  const baseRun: OrchestrationRunRecord = {
    id: 'run-1',
    orchestration_definition_id: 'def-1',
    status: 'running',
  } as OrchestrationRunRecord;

  beforeEach(() => {
    definitionService = {
      getDefinitionById: jest.fn(),
      getDefinitionForExecution: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationDefinitionService>;

    stateService = {
      resolveExecutionOrder: jest.fn(),
      initializeRun: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationStateService>;

    runnerService = {
      startRun: jest.fn(),
      updateRun: jest.fn(),
      listSteps: jest.fn(),
      getRun: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunnerService>;

    executionService = {
      startExecution: jest.fn(),
      getConcurrencyLimit: jest.fn().mockReturnValue(5),
    } as unknown as jest.Mocked<OrchestrationExecutionService>;

    eventsService = {
      emitRunStarted: jest.fn(),
      emitRunCompleted: jest.fn(),
      emitRunFailed: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationEventsService>;

    checkpointService = {
      resolveCheckpoint: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationCheckpointService>;

    stepExecutor = {
      processRun: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationStepExecutorService>;

    runFactory = {
      buildAndStartSubOrchestration: jest.fn(),
      createRunFromDefinition: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunFactoryService>;

    const llmService = {} as Record<string, unknown>;
    const contextOptimization = {} as Record<string, unknown>;
    const plansService = {} as Record<string, unknown>;
    const conversationsService = {} as Record<string, unknown>;
    const deliverablesService = {} as Record<string, unknown>;

    service = new OrchestratorAgentRunnerService(
      definitionService,
      stateService,
      runnerService,
      executionService,
      eventsService,
      checkpointService,
      stepExecutor,
      runFactory,
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
    );
  });

  it('resumes orchestration after approval (continue)', async () => {
    const definition = createAgentDefinition();
    const request = {
      mode: AgentTaskMode.BUILD,
      payload: {
        action: 'resume_after_approval',
        approvalId: 'approval-1',
        decision: 'continue',
      },
    } as TaskRequestDto;

    checkpointService.resolveCheckpoint.mockResolvedValue({
      approval: {} as Record<string, unknown>,
      run: { ...baseRun, status: 'running' } as OrchestrationRunRecord,
      decision: 'continue',
    });

    executionService.startExecution.mockResolvedValue({
      run: { ...baseRun, status: 'running' } as OrchestrationRunRecord,
      readySteps: [],
    });

    runnerService.listSteps.mockResolvedValue([]);

    const response = await (
      service as {
        resumeAfterApproval: (
          definition: unknown,
          request: unknown,
          payload: unknown,
        ) => Promise<TaskResponseDto>;
      }
    ).resumeAfterApproval(definition, request, request.payload);

    expect(response).toBeInstanceOf(TaskResponseDto);
    expect(response.success).toBe(true);
    expect(response.payload.content).toMatchObject({
      status: 'running',
      orchestrationRunId: 'run-1',
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(executionService.startExecution).toHaveBeenCalledWith('run-1', {
      maxParallel: 5,
    });
  });

  it('returns aborted status when approval decision is abort', async () => {
    const definition = createAgentDefinition();
    const request = {
      mode: AgentTaskMode.BUILD,
      payload: {
        action: 'resume_after_approval',
        approvalId: 'approval-1',
        decision: 'abort',
      },
    } as TaskRequestDto;

    checkpointService.resolveCheckpoint.mockResolvedValue({
      approval: {} as Record<string, unknown>,
      run: { ...baseRun, status: 'aborted' } as OrchestrationRunRecord,
      decision: 'abort',
    });

    const response = await (
      service as {
        resumeAfterApproval: (
          definition: unknown,
          request: unknown,
          payload: unknown,
        ) => Promise<TaskResponseDto>;
      }
    ).resumeAfterApproval(definition, request, request.payload);

    expect(response.payload.content).toEqual(
      expect.objectContaining({
        status: 'aborted',
        orchestrationRunId: 'run-1',
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(executionService.startExecution).not.toHaveBeenCalled();
  });
});

describe('OrchestratorAgentRunnerService (ORCHESTRATE mode)', () => {
  let definitionService: jest.Mocked<OrchestrationDefinitionService>;
  let stateService: jest.Mocked<OrchestrationStateService>;
  let runnerService: jest.Mocked<OrchestrationRunnerService>;
  let executionService: jest.Mocked<OrchestrationExecutionService>;
  let eventsService: jest.Mocked<OrchestrationEventsService>;
  let checkpointService: jest.Mocked<OrchestrationCheckpointService>;
  let stepExecutor: jest.Mocked<OrchestrationStepExecutorService>;
  let runFactory: jest.Mocked<OrchestrationRunFactoryService>;
  let service: OrchestratorAgentRunnerService;

  const baseRun: OrchestrationRunRecord = {
    id: 'run-1',
    orchestration_definition_id: 'def-1',
    status: 'running',
  } as OrchestrationRunRecord;

  beforeEach(() => {
    definitionService = {
      getDefinitionById: jest.fn(),
      getDefinitionForExecution: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationDefinitionService>;

    stateService = {
      resolveExecutionOrder: jest.fn(),
      initializeRun: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationStateService>;

    runnerService = {
      startRun: jest.fn(),
      updateRun: jest.fn(),
      listSteps: jest.fn(),
      getRun: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunnerService>;

    executionService = {
      startExecution: jest.fn(),
      getConcurrencyLimit: jest.fn().mockReturnValue(5),
    } as unknown as jest.Mocked<OrchestrationExecutionService>;

    eventsService = {
      emitRunStarted: jest.fn(),
      emitRunCompleted: jest.fn(),
      emitRunFailed: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationEventsService>;

    checkpointService = {
      resolveCheckpoint: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationCheckpointService>;

    stepExecutor = {
      processRun: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationStepExecutorService>;

    runFactory = {
      buildAndStartSubOrchestration: jest.fn(),
      createRunFromDefinition: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunFactoryService>;

    const llmService = {} as Record<string, unknown>;
    const contextOptimization = {} as Record<string, unknown>;
    const plansService = {} as Record<string, unknown>;
    const conversationsService = {} as Record<string, unknown>;
    const deliverablesService = {} as Record<string, unknown>;

    service = new OrchestratorAgentRunnerService(
      definitionService,
      stateService,
      runnerService,
      executionService,
      eventsService,
      checkpointService,
      stepExecutor,
      runFactory,
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
    );
  });

  it('should handle ORCHESTRATE mode with create action', async () => {
    const definition = createAgentDefinition();
    const request = {
      mode: AgentTaskMode.ORCHESTRATE,
      conversationId: 'conv-1',
      userMessage: 'Create new orchestration',
      messages: [],
      payload: {
        action: 'create',
        parameters: { goal: 'track KPIs' },
      },
      metadata: {},
    } as TaskRequestDto;

    definitionService.getDefinitionForExecution.mockResolvedValue({
      id: 'def-1',
      slug: 'kpi-tracking',
    } as Record<string, unknown>);

    (
      stateService.resolveExecutionOrder as jest.MockedFunction<
        typeof stateService.resolveExecutionOrder
      >
    ).mockResolvedValue({
      steps: [],
      metadata: {},
    });

    (
      stateService.initializeRun as jest.MockedFunction<
        typeof stateService.initializeRun
      >
    ).mockResolvedValue({
      runId: 'run-1',
      executionOrder: [],
    });

    const response = await service.execute(definition, request, 'org-1');

    expect(response).toBeInstanceOf(TaskResponseDto);
    // ORCHESTRATE mode routes 'create' action to handlePlan, which returns 'plan' mode
    expect(response.mode).toBe(AgentTaskMode.PLAN);
  });

  it('should handle ORCHESTRATE mode with execute action', async () => {
    const definition = createAgentDefinition();
    const request = {
      mode: AgentTaskMode.ORCHESTRATE,
      conversationId: 'conv-1',
      userMessage: 'Execute orchestration',
      messages: [],
      payload: {
        action: 'execute',
        orchestrationName: 'kpi-tracking',
        parameters: { goal: 'track KPIs' },
      },
      metadata: {},
    } as TaskRequestDto;

    definitionService.getDefinitionForExecution.mockResolvedValue({
      id: 'def-1',
      slug: 'kpi-tracking',
    } as Record<string, unknown>);

    runFactory.createRunFromDefinition.mockResolvedValue({
      run: baseRun,
      steps: [],
      readySteps: [],
    } as Record<string, unknown>);

    const response = await service.execute(definition, request, 'org-1');

    expect(response).toBeInstanceOf(TaskResponseDto);
    // ORCHESTRATE mode routes 'execute' action to executeBuild, which returns 'build' mode
    expect(response.mode).toBe(AgentTaskMode.BUILD);
    expect(response.success).toBe(true);
  });

  it('should handle ORCHESTRATE mode with run_human_response action', async () => {
    const definition = createAgentDefinition();
    const request = {
      mode: AgentTaskMode.ORCHESTRATE,
      conversationId: 'conv-1',
      userMessage: 'Approve checkpoint',
      messages: [],
      payload: {
        action: 'run_human_response',
        approvalId: 'approval-1',
        decision: 'continue',
        notes: 'Approved',
      },
      metadata: { userId: 'user-1' },
    } as TaskRequestDto;

    checkpointService.resolveCheckpoint.mockResolvedValue({
      approval: {
        id: 'approval-1',
        status: 'approved',
      } as { id: string; status: string },
      run: { ...baseRun, status: 'running' } as OrchestrationRunRecord,
      decision: 'continue',
    });

    executionService.startExecution.mockResolvedValue({
      run: baseRun as OrchestrationRunRecord,
      readySteps: [],
    });

    runnerService.listSteps.mockResolvedValue([]);

    const response = await service.execute(definition, request, 'org-1');

    expect(response).toBeInstanceOf(TaskResponseDto);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(checkpointService.resolveCheckpoint).toHaveBeenCalledWith({
      approvalId: 'approval-1',
      decision: 'continue',
      actorId: 'user-1',
      notes: 'Approved',
      modifications: null,
    });
  });

  it('should return not supported for ORCHESTRATE mode on non-orchestrator agents', async () => {
    const definition = createAgentDefinition({
      agentType: 'function',
      execution: {
        modeProfile: 'conversation_only',
        canConverse: true,
        canPlan: false,
        canBuild: false,
        canOrchestrate: false,
        requiresHumanGate: false,
      },
    });

    const request = {
      mode: AgentTaskMode.ORCHESTRATE,
      conversationId: 'conv-1',
      payload: { action: 'create' },
      metadata: {},
    } as TaskRequestDto;

    const response = await service.execute(definition, request, 'org-1');

    expect(response.success).toBe(false);
    expect(response.payload.metadata?.reason).toContain(
      'does not support orchestrate mode',
    );
  });
});
