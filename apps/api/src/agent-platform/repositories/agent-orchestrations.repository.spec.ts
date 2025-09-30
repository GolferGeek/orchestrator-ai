import { AgentOrchestrationsRepository } from './agent-orchestrations.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('AgentOrchestrationsRepository', () => {
  let fromMock: jest.Mock;
  let supabase: jest.Mocked<SupabaseService>;
  let repository: AgentOrchestrationsRepository;

  beforeEach(() => {
    fromMock = jest.fn();
    supabase = {
      getServiceClient: jest.fn(() => ({ from: fromMock })),
    } as unknown as jest.Mocked<SupabaseService>;
    repository = new AgentOrchestrationsRepository(supabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('upserts orchestration', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: { id: 'orch-1' }, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ upsert });

    const _result = await repository.upsert({
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
    const eqAfterOrg = jest.fn().mockReturnValue({ order });
    const is = jest.fn().mockReturnValue({ order });
    const eq = jest.fn().mockImplementation((column: string) => {
      if (column === 'agent_slug') {
        return { eq: eqAfterOrg, is, order } as any;
      }
      return { order } as any;
    });
    const select = jest.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const _result = await repository.listByAgent(null, 'planner');

    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('agent_slug', 'planner');
    expect(is).toHaveBeenCalledWith('organization_slug', null);
    expect(order).toHaveBeenCalledWith('slug', { ascending: true });
    expect(result).toEqual([]);
  });
});
