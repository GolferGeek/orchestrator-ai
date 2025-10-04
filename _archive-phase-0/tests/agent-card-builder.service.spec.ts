import { AgentCardBuilderService } from './agent-card-builder.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { ConfigService } from '@nestjs/config';

const createRegistryMock = () => {
  const registry = {
    getAgent: jest.fn(),
  } as unknown as jest.Mocked<AgentRegistryService>;
  return registry;
};

const createConfigMock = (overrides: Record<string, any> = {}) => {
  const defaults: Record<string, any> = {
    AGENT_PUBLIC_BASE_URL: 'https://api.example.com',
    AGENT_A2A_SPEC_VERSION: '2024-08-07',
    AGENT_PROVIDER_NAME: 'Test Provider',
  };

  const mock = {
    get: jest.fn((key: string) => {
      if (key in overrides) {
        return overrides[key];
      }
      return defaults[key];
    }),
  } as unknown as jest.Mocked<ConfigService>;

  return mock;
};

describe('AgentCardBuilderService', () => {
  it('returns cached agent card when present', async () => {
    const registry = createRegistryMock();
    registry.getAgent.mockResolvedValue({
      agent_card: {
        name: 'Existing Card',
        metadata: { cached: true },
        customField: 'custom',
      },
      display_name: 'Agent',
      description: 'desc',
      agent_type: 'context',
      slug: 'agent',
      organization_slug: 'demo',
      mode_profile: 'autonomous_build',
      version: '2.0.0',
      status: 'active',
      context: {
        input_modes: ['text/plain'],
        output_modes: ['text/plain'],
      },
      config: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    } as any);

    const service = new AgentCardBuilderService(registry, createConfigMock());
    const result = await service.build(null, 'agent');

    expect(registry.getAgent).toHaveBeenCalledWith(null, 'agent');
    expect(result.name).toBe('Agent');
    expect(result.customField).toBe('custom');
    expect(result.protocol).toBe('google/a2a');
    expect(result.metadata.cached).toBe(true);
    expect(result.metadata.slug).toBe('agent');
    expect(result.url).toBe(
      'https://api.example.com/agent-to-agent/demo/agent',
    );
  });

  it('builds fallback card when cached card missing', async () => {
    const registry = createRegistryMock();
    registry.getAgent.mockResolvedValue({
      display_name: 'Agent',
      description: 'desc',
      agent_type: 'context',
      slug: 'agent',
      organization_slug: null,
      version: '1.0.0',
      context: {
        input_modes: ['text/plain'],
        output_modes: ['text/plain'],
        skills: ['analysis'],
      },
      config: {
        capabilities: ['converse'],
        streaming: { enabled: true },
        extensions: ['notifications'],
      },
      mode_profile: 'autonomous_build',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    } as any);

    const service = new AgentCardBuilderService(registry, createConfigMock());
    const result = await service.build(null, 'agent');

    expect(registry.getAgent).toHaveBeenCalledWith(null, 'agent');
    expect(result.name).toBe('Agent');
    expect(result.capabilities.declared).toContain('converse');
    expect(result.capabilities.streaming).toBe(true);
    expect(result.capabilities.extensions).toContain('notifications');
    expect(result.protocol).toBe('google/a2a');
    expect(result.defaultInputModes).toEqual(['text/plain']);
    expect(result.capabilities.modes).toEqual(
      expect.arrayContaining(['converse', 'plan', 'build']),
    );
    expect(result.skills).toEqual(['analysis']);
    expect(result.securitySchemes.apiKey).toMatchObject({
      type: 'apiKey',
      name: 'X-Agent-Api-Key',
    });
    expect(result.url).toBe(
      'https://api.example.com/agent-to-agent/global/agent',
    );
  });
});
