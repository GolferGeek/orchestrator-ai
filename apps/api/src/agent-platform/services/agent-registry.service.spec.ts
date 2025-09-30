import { AgentRegistryService } from './agent-registry.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { ConfigService } from '@nestjs/config';
import { AgentRecord } from '../interfaces/agent-record.interface';

const buildAgent = (slug: string, overrides: Partial<AgentRecord> = {}) => ({
  id: `${slug}-id`,
  organization_slug: 'acme',
  slug,
  display_name: slug,
  description: null,
  agent_type: 'demo',
  mode_profile: 'conversation_only',
  version: '1.0.0',
  status: 'active',
  yaml: '---',
  agent_card: null,
  context: null,
  config: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const createConfigMock = (ttl = 30_000) =>
  ({
    get: jest.fn((key: string) =>
      key === 'AGENT_REGISTRY_CACHE_TTL_MS' ? ttl : undefined,
    ),
  }) as unknown as jest.Mocked<ConfigService>;

const createService = (ttl = 30_000) => {
  const repository = {
    findBySlug: jest.fn(),
    listByOrganization: jest.fn(),
  } as unknown as jest.Mocked<AgentsRepository>;

  const config = createConfigMock(ttl);
  const service = new AgentRegistryService(repository, config);

  return { service, repository, config };
};

describe('AgentRegistryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads agent from repository and caches subsequent lookups', async () => {
    const { service, repository } = createService();
    const record = buildAgent('alpha');
    repository.findBySlug.mockResolvedValue(record);

    const first = await service.getAgent('acme', 'alpha');
    const second = await service.getAgent('acme', 'alpha');

    expect(repository.findBySlug).toHaveBeenCalledTimes(1);
    expect(first).toBe(record);
    expect(second).toBe(record);
  });

  it('re-fetches agent after cache TTL expires', async () => {
    const ttl = 1_000;
    const { service, repository } = createService(ttl);
    const recordA = buildAgent('alpha', { display_name: 'Alpha' });
    const recordB = buildAgent('alpha', { display_name: 'Alpha v2' });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);
    repository.findBySlug.mockResolvedValueOnce(recordA);

    const first = await service.getAgent('acme', 'alpha');
    expect(first?.display_name).toBe('Alpha');

    nowSpy.mockReturnValue(1_000 + ttl + 1);
    repository.findBySlug.mockResolvedValueOnce(recordB);

    const second = await service.getAgent('acme', 'alpha');

    expect(repository.findBySlug).toHaveBeenCalledTimes(2);
    expect(second?.display_name).toBe('Alpha v2');

    nowSpy.mockRestore();
  });

  it('lists agents and hydrates cache bucket', async () => {
    const { service, repository } = createService();
    const records = [buildAgent('alpha'), buildAgent('beta')];
    repository.listByOrganization.mockResolvedValue(records);

    const result = await service.listAgents('acme');
    expect(result).toEqual(records);
    expect(repository.listByOrganization).toHaveBeenCalledWith('acme');

    repository.findBySlug.mockResolvedValue(records[0]!);
    const cached = await service.getAgent('acme', 'alpha');
    expect(cached).toEqual(records[0]!);
    expect(repository.findBySlug).not.toHaveBeenCalled();
  });

  it('supports explicit invalidation of cached entries', async () => {
    const { service, repository } = createService();
    const record = buildAgent('alpha');
    repository.findBySlug.mockResolvedValue(record);

    await service.getAgent(null, 'alpha');
    service.invalidate(null, 'alpha');

    repository.findBySlug.mockResolvedValue(record);
    await service.getAgent(null, 'alpha');
    expect(repository.findBySlug).toHaveBeenCalledTimes(2);
  });
});
