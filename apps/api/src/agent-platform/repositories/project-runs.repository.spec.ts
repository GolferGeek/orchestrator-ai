import { ProjectRunsRepository } from './project-runs.repository';
import { SupabaseService } from '@/supabase/supabase.service';

const createSupabaseMock = () => {
  const fromMock = jest.fn();
  const service: Partial<SupabaseService> = {
    getServiceClient: jest.fn(() => ({ from: fromMock } as any)),
  };
  return { fromMock, service: service as SupabaseService };
};

describe('ProjectRunsRepository', () => {
  afterEach(() => jest.resetAllMocks());

  const runRecord = {
    id: 'run-1',
    plan_id: 'plan-1',
    organization_slug: 'my-org',
    status: 'pending',
    current_step_index: null,
    completed_steps: [],
    step_state: {},
    human_checkpoint_id: null,
    metadata: {},
    started_at: new Date().toISOString(),
    completed_at: null,
    updated_at: new Date().toISOString(),
  };

  it('creates project runs', async () => {
    const { fromMock, service } = createSupabaseMock();
    const maybeSingle = jest.fn().mockResolvedValue({ data: runRecord, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const insert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const repo = new ProjectRunsRepository(service);
    const result = await repo.start({
      plan_id: runRecord.plan_id,
      organization_slug: runRecord.organization_slug,
    });

    expect(fromMock).toHaveBeenCalledWith('project_runs');
    expect(insert).toHaveBeenCalled();
    expect(result).toEqual(runRecord);
  });

  it('updates project run', async () => {
    const { fromMock, service } = createSupabaseMock();
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { ...runRecord, status: 'in_execution', current_step_index: 1 },
      error: null,
    });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update });

    const repo = new ProjectRunsRepository(service);
    const result = await repo.update('run-1', {
      status: 'in_execution',
      current_step_index: 1,
    });

    expect(update).toHaveBeenCalled();
    expect(result.status).toBe('in_execution');
  });

  it('returns null when project run missing', async () => {
    const { fromMock, service } = createSupabaseMock();
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const repo = new ProjectRunsRepository(service);
    const result = await repo.getById('missing');

    expect(result).toBeNull();
  });
});
