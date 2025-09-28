import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunsRepository } from '../repositories/orchestration-runs.repository';

describe('OrchestrationRunnerService', () => {
  const repo = {
    start: jest.fn(),
    update: jest.fn(),
    getById: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationRunsRepository>;

  const service = new OrchestrationRunnerService(repo);

  afterEach(() => jest.resetAllMocks());

  it('starts orchestration run', async () => {
    repo.start.mockResolvedValue({ id: 'run-1' } as any);

    const result = await service.startRun({
      planId: 'plan-1',
      organizationSlug: 'my-org',
      promptInputs: { foo: 'bar' },
    });

    expect(repo.start).toHaveBeenCalledWith({
      plan_id: 'plan-1',
      origin_type: 'plan',
      origin_id: 'plan-1',
      orchestration_slug: null,
      prompt_inputs: { foo: 'bar' },
      organization_slug: 'my-org',
      metadata: {},
    });
    expect(result.id).toBe('run-1');
  });

  it('updates orchestration run', async () => {
    repo.update.mockResolvedValue({ id: 'run-1', status: 'in_execution' } as any);

    const result = await service.updateRun({ runId: 'run-1', status: 'in_execution' });

    expect(repo.update).toHaveBeenCalled();
    expect(result.status).toBe('in_execution');
  });
});
