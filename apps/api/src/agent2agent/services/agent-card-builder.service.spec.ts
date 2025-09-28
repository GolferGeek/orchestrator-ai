import { AgentCardBuilderService } from './agent-card-builder.service';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';

const createRepoMock = () => {
  const repo = {
    findBySlug: jest.fn(),
  } as unknown as jest.Mocked<AgentsRepository>;
  return repo;
};

describe('AgentCardBuilderService', () => {
  it('returns cached agent card when present', async () => {
    const repo = createRepoMock();
    repo.findBySlug.mockResolvedValue({
      agent_card: { name: 'card-name' },
    } as any);

    const service = new AgentCardBuilderService(repo);
    const result = await service.build(null, 'agent');

    expect(result).toEqual({ name: 'card-name' });
  });

  it('builds fallback card when cached card missing', async () => {
    const repo = createRepoMock();
    repo.findBySlug.mockResolvedValue({
      display_name: 'Agent',
      description: 'desc',
      agent_type: 'context',
      slug: 'agent',
      organization_slug: null,
      version: '1.0.0',
      context: {
        input_modes: ['text/plain'],
        output_modes: ['text/plain'],
      },
      config: {
        capabilities: ['converse'],
      },
    } as any);

    const service = new AgentCardBuilderService(repo);
    const result = await service.build(null, 'agent');

    expect(result.name).toBe('Agent');
    expect(result.capabilities).toEqual(['converse']);
  });
});
