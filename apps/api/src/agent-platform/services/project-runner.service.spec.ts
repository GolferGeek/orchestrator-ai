import { ProjectRunnerService } from './project-runner.service';
import { ProjectRunsRepository } from '../repositories/project-runs.repository';

describe('ProjectRunnerService', () => {
  const repo = {
    start: jest.fn(),
    update: jest.fn(),
    getById: jest.fn(),
  } as unknown as jest.Mocked<ProjectRunsRepository>;

  const service = new ProjectRunnerService(repo);

  afterEach(() => jest.resetAllMocks());

  it('starts project run', async () => {
    repo.start.mockResolvedValue({ id: 'run-1' } as any);

    const result = await service.startRun({ planId: 'plan-1', organizationSlug: 'my-org' });

    expect(repo.start).toHaveBeenCalled();
    expect(result.id).toBe('run-1');
  });

  it('updates project run', async () => {
    repo.update.mockResolvedValue({ id: 'run-1', status: 'in_execution' } as any);

    const result = await service.updateRun({ runId: 'run-1', status: 'in_execution' });

    expect(repo.update).toHaveBeenCalled();
    expect(result.status).toBe('in_execution');
  });
});
