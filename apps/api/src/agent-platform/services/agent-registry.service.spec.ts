import { AgentRegistryService } from './agent-registry.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { AgentRecord } from '../interfaces/agent-record.interface';
import { ConfigService } from '@nestjs/config';

const _buildAgent = (slug: string, overrides: Partial<AgentRecord> = {}) => ({
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

const _createConfigMock = (ttl = 30_000) =>
  ({
    get: jest.fn((key: string) =>
      key === 'AGENT_REGISTRY_CACHE_TTL_MS' ? ttl : undefined,
    ),
  }) as unknown as jest.Mocked<ConfigService>;

describe('AgentRegistryService', () => {
  const _createService = (ttl = 30_000) => {
    const _repository = {
      findBySlug: jest.fn(),
      listByOrganization: jest.fn(),
    } as unknown as jest.Mocked<AgentsRepository>;

    const _config = createConfigMock(ttl);
    const _service = new AgentRegistryService(repository, config);

    return { service, repository, config };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads agent from repository and caches the result', async () => {
    const { service, repository } = createService();
    const _record = buildAgent('alpha');
    repository.findBySlug.mockResolvedValue(record);

    const _first = await service.getAgent('acme', 'alpha');
    const _second = await service.getAgent('acme', 'alpha');

    expect(repository.findBySlug).toHaveBeenCalledTimes(1);
    expect(first).toBe(record);
    expect(second).toBe(record);
  });

  it('re-fetches agent after cache TTL expires', async () => {
    const _ttl = 1_000;
    const { service, repository } = createService(ttl);
    const _recordA = buildAgent('alpha', { display_name: 'Alpha' });
    const _recordB = buildAgent('alpha', { display_name: 'Alpha v2' });

    const _nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);
    repository.findBySlug.mockResolvedValueOnce(recordA);

    const _first = await service.getAgent('acme', 'alpha');
    expect(first?.display_name).toBe('Alpha');

    nowSpy.mockReturnValue(1_000 + ttl + 1);
    repository.findBySlug.mockResolvedValueOnce(recordB);

    const _second = await service.getAgent('acme', 'alpha');
    expect(repository.findBySlug).toHaveBeenCalledTimes(2);
    expect(second?.display_name).toBe('Alpha v2');

    nowSpy.mockRestore();
  });

  it('lists agents and populates cache bucket', async () => {
    const { service, repository } = createService();
    const _records = [buildAgent('alpha'), buildAgent('beta')];
    repository.listByOrganization.mockResolvedValue(records);

    const _result = await service.listAgents('acme');
    expect(result).toHaveLength(2);
    expect(repository.listByOrganization).toHaveBeenCalledWith('acme');

    const _cached = await service.getAgent('acme', 'alpha');
    expect(cached).toEqual(records[0]);
    expect(repository.findBySlug).not.toHaveBeenCalled();
  });

  it('supports explicit invalidation of cached entries', async () => {
    const { service, repository } = createService();
    const _record = buildAgent('alpha');
    repository.findBySlug.mockResolvedValue(record);

    await service.getAgent(null, 'alpha');
    service.invalidate(null, 'alpha');

    repository.findBySlug.mockResolvedValue(record);
    await service.getAgent(null, 'alpha');
    expect(repository.findBySlug).toHaveBeenCalledTimes(2);
  });
});
