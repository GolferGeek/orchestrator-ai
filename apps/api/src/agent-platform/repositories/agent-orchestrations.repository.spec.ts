import { AgentOrchestrationsRepository } from './agent-orchestrations.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('AgentOrchestrationsRepository', () => {
  const fromMock = jest.fn();
  const supabase = {
    getServiceClient: jest.fn(() => ({ from: fromMock })),
  } as unknown as jest.Mocked<SupabaseService>;

  afterEach(() => {
    jest.resetAllMocks();
  });

  const repository = new AgentOrchestrationsRepository(supabase);

  it('upserts orchestration', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: 'orch-1' }, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ upsert });

    const result = await repository.upsert({
      organization_slug: 'demo',
      agent_slug: 'planner',
      slug: 'default-plan',
      display_name: 'Default Plan',
      orchestration_json: {},
    });

    expect(fromMock).toHaveBeenCalledWith('agent_orchestrations');
    expect(result.id).toEqual('orch-1');
  });

  it('lists orchestrations', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const is = jest.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select: jest.fn().mockReturnValue({ eq, is }) });

    const result = await repository.listByAgent(null, 'planner');
    expect(result).toEqual([]);
  });
});
