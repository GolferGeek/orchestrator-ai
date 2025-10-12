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
    runsRepository.start.mockResolvedValue({ id: 'run-1' } as any);

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
    } as any);

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
    stepsRepository.create.mockResolvedValue({ id: 'step-1' } as any);

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
