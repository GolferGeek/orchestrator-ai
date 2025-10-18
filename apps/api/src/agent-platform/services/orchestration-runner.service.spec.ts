import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunsRepository } from '../repositories/orchestration-runs.repository';
import { OrchestrationStepsRepository } from '../repositories/orchestration-steps.repository';

describe('OrchestrationRunnerService', () => {
  const runsRepository = {
    start: jest.fn(),
    update: jest.fn(),
    getById: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationRunsRepository>;

  const stepsRepository = {
    create: jest.fn(),
    update: jest.fn(),
    listByRunId: jest.fn(),
    getById: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationStepsRepository>;

  const service = new OrchestrationRunnerService(
    runsRepository,
    stepsRepository,
  );

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('starts orchestration run with metadata enrichment', async () => {
    runsRepository.start.mockResolvedValue({
      id: 'run-1',
      status: 'pending',
      parameters: {},
      plan: {},
      results: {},
      metadata: {},
      completed_steps: [],
      step_state: {},
      error_details: {},
      plan_id: null,
      orchestration_definition_id: null,
      orchestration_name: null,
      conversation_id: null,
      parent_orchestration_run_id: null,
      origin_type: 'plan',
      origin_id: null,
      orchestration_slug: null,
      organization_slug: null,
      user_id: null,
      current_step_index: null,
      current_step_id: null,
      human_checkpoint_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      created_by: null,
    });

    const result = await service.startRun({
      planId: 'plan-1',
      organizationSlug: 'my-org',
      parameters: { foo: 'bar' },
      agentId: 'agent-123',
      agentSlug: 'assistant',
      agentType: 'specialist',
      agentDisplayName: 'Assistant',
      metadata: { traceId: 'abc' },
    });

    expect(runsRepository.start).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-1',
        origin_type: 'plan',
        origin_id: 'plan-1',
        orchestration_slug: null,
        parameters: { foo: 'bar' },
        organization_slug: 'my-org',
        metadata: expect.objectContaining({
          traceId: 'abc',
          agent: expect.objectContaining({
            id: 'agent-123',
            slug: 'assistant',
            type: 'specialist',
            displayName: 'Assistant',
          }),
        }),
      }),
    );
    expect(result.id).toBe('run-1');
  });

  it('updates orchestration run status', async () => {
    runsRepository.update.mockResolvedValue({
      id: 'run-1',
      status: 'in_execution',
      parameters: {},
      plan: {},
      results: {},
      metadata: {},
      completed_steps: [],
      step_state: {},
      error_details: {},
      plan_id: null,
      orchestration_definition_id: null,
      orchestration_name: null,
      conversation_id: null,
      parent_orchestration_run_id: null,
      origin_type: 'plan',
      origin_id: null,
      orchestration_slug: null,
      organization_slug: null,
      user_id: null,
      current_step_index: null,
      current_step_id: null,
      human_checkpoint_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      created_by: null,
    });

    const result = await service.updateRun({
      runId: 'run-1',
      status: 'in_execution',
      currentStepId: 'step-1',
    });

    expect(runsRepository.update).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        status: 'in_execution',
        current_step_id: 'step-1',
      }),
    );
    expect(result.status).toBe('in_execution');
  });

  it('creates orchestration step record', async () => {
    stepsRepository.create.mockResolvedValue({
      id: 'step-1',
      orchestration_run_id: 'run-1',
      step_index: 0,
      step_id: 'fetch',
      status: 'pending',
      agent_slug: null,
      mode: 'BUILD',
      conversation_id: null,
      plan_id: null,
      deliverable_id: null,
      depends_on: [],
      attempt_number: 1,
      checkpoint_decision: null,
      checkpoint_decided_by: null,
      checkpoint_decided_at: null,
      invalidated_at: null,
      invalidated_reason: null,
      input: {},
      output: null,
      metadata: {},
      error_details: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const record = await service.createStep({
      orchestration_run_id: 'run-1',
      step_index: 0,
      step_id: 'fetch',
      mode: 'BUILD',
    });

    expect(stepsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orchestration_run_id: 'run-1',
        step_index: 0,
        step_id: 'fetch',
        mode: 'BUILD',
      }),
    );
    expect(record.id).toBe('step-1');
  });
});
