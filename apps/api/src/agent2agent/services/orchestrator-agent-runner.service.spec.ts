import { OrchestratorAgentRunnerService } from './orchestrator-agent-runner.service';
import { OrchestrationDefinitionService } from '@agent-platform/services/orchestration-definition.service';
import { OrchestrationStateService } from '@agent-platform/services/orchestration-state.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationEventsService } from '@agent-platform/services/orchestration-events.service';
import { OrchestrationStepExecutorService } from './orchestration-step-executor.service';
import { OrchestrationRunFactoryService } from '@agent-platform/services/orchestration-run-factory.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
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
  record: {} as any,
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

  const baseRun = {
    id: 'run-1',
    orchestration_definition_id: 'def-1',
    status: 'running',
  } as any;

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
    } as unknown as jest.Mocked<OrchestrationRunFactoryService>;

    service = new OrchestratorAgentRunnerService(
      definitionService,
      stateService,
      runnerService,
      executionService,
      eventsService,
      checkpointService,
      stepExecutor,
      runFactory,
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
      approval: {} as any,
      run: { ...baseRun, status: 'running' },
      decision: 'continue',
    });

    executionService.startExecution.mockResolvedValue({
      run: { ...baseRun, status: 'running' },
      readySteps: [],
    });

    runnerService.listSteps.mockResolvedValue([]);

    const response = await (service as any).resumeAfterApproval(
      definition,
      request,
      request.payload as any,
    );

    expect(response).toBeInstanceOf(TaskResponseDto);
    expect(response.success).toBe(true);
    expect(response.payload.content).toMatchObject({
      status: 'running',
      orchestrationRunId: 'run-1',
    });
    expect(executionService.startExecution).toHaveBeenCalledWith('run-1');
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
      approval: {} as any,
      run: { ...baseRun, status: 'aborted' },
      decision: 'abort',
    });

    const response = await (service as any).resumeAfterApproval(
      definition,
      request,
      request.payload as any,
    );

    expect(response.payload.content).toEqual(
      expect.objectContaining({
        status: 'aborted',
        orchestrationRunId: 'run-1',
      }),
    );
    expect(executionService.startExecution).not.toHaveBeenCalled();
  });
});
