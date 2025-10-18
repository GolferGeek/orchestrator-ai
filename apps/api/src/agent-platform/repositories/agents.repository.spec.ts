import { AgentsRepository } from './agents.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';

const createSupabaseMock = () => {
  const fromMock = jest.fn();
  const service: Partial<SupabaseService> = {
    getServiceClient: jest.fn(
      () => ({ from: fromMock }) as unknown as SupabaseClient,
    ),
  };
  return { fromMock, service: service as SupabaseService };
};

describe('AgentsRepository', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  const sampleAgent = {
    id: '123',
    organization_slug: 'my-org',
    slug: 'marketing_swarm',
    display_name: 'Marketing Swarm',
    description: 'desc',
    agent_type: 'function',
    mode_profile: 'full_cycle',
    version: '1.0.0',
    status: 'active',
    yaml: 'yaml: true',
    agent_card: { protocol: 'a2a' },
    context: { prompt: 'hi' },
    config: { capabilities: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('upserts agents with conflict on organization_slug + slug', async () => {
    const { fromMock, service } = createSupabaseMock();

    const maybeSingle = jest
      .fn()
      .mockResolvedValue({ data: sampleAgent, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });

    fromMock.mockReturnValue({ upsert });

    const repo = new AgentsRepository(service);
    const result = await repo.upsert({
      organization_slug: 'my-org',
      slug: 'marketing_swarm',
      display_name: 'Marketing Swarm',
      agent_type: 'function',
      mode_profile: 'full_cycle',
      yaml: 'yaml: true',
    });

    expect(fromMock).toHaveBeenCalledWith('agents');
    expect(upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'marketing_swarm' }),
      ]),
      { onConflict: 'organization_slug,slug' },
    );
    expect(result).toEqual(sampleAgent);
  });

  it('returns null when agent missing for slug', async () => {
    const { fromMock, service } = createSupabaseMock();
    const queryChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    fromMock.mockReturnValue(queryChain);

    const repo = new AgentsRepository(service);
    const result = await repo.findBySlug('demo', 'missing');

    expect(queryChain.eq).toHaveBeenCalledWith('slug', 'missing');
    expect(result).toBeNull();
  });

  it('lists agents by organization', async () => {
    const { fromMock, service } = createSupabaseMock();
    interface QueryChain {
      select: jest.Mock;
      eq: jest.Mock;
      is: jest.Mock;
      order: jest.Mock;
      data: (typeof sampleAgent)[];
      error: null;
    }
    const listChain: QueryChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      data: [sampleAgent],
      error: null,
    };

    listChain.order = jest
      .fn()
      .mockResolvedValue({ data: [sampleAgent], error: null });

    fromMock.mockReturnValue(listChain);

    const repo = new AgentsRepository(service);
    const result = await repo.listByOrganization(null);

    expect(listChain.is).toHaveBeenCalledWith('organization_slug', null);
    expect(result).toEqual([sampleAgent]);
  });

  it('deletes agent by id', async () => {
    const { fromMock, service } = createSupabaseMock();
    const _deleteFn = jest.fn().mockResolvedValue({ error: null });
    const eqMock = jest.fn().mockResolvedValue({ error: null });

    fromMock.mockReturnValue({ delete: jest.fn(() => ({ eq: eqMock })) });

    const repo = new AgentsRepository(service);
    await repo.deleteById('123');

    expect(eqMock).toHaveBeenCalledWith('id', '123');
  });
});
