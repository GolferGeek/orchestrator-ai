import { AgentCardBuilderService } from './agent-card-builder.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';

describe('AgentCardBuilderService - private metrics gating', () => {
  const makeService = (agent: AgentRecord, metricsSnapshot: any, envFlag: string | undefined) => {
    const agentRegistry = {
      getAgent: jest.fn().mockResolvedValue(agent),
    } as any;
    const configService = { get: jest.fn() } as any;
    const metricsService = {
      snapshot: jest.fn().mockImplementation((kind: any, slug: string) => metricsSnapshot),
    } as any;

    const original = process.env.AGENT_CARD_INCLUDE_PRIVATE_METRICS;
    if (envFlag !== undefined) {
      process.env.AGENT_CARD_INCLUDE_PRIVATE_METRICS = envFlag;
    }

    const service = new AgentCardBuilderService(agentRegistry, configService, metricsService);
    return { service, agentRegistry, metricsService, restore: () => (process.env.AGENT_CARD_INCLUDE_PRIVATE_METRICS = original) };
  };

  const agentRecord: AgentRecord = {
    id: 'id-1',
    organization_slug: 'global',
    slug: 'demo-agent',
    display_name: 'Demo Agent',
    description: 'desc',
    agent_type: 'specialist',
    mode_profile: 'conversation_only',
    version: '1.0.0',
    status: 'active',
    yaml: '---',
    agent_card: null,
    context: {},
    config: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('does not include metrics when env flag is false', async () => {
    const { service, restore } = makeService(agentRecord, {}, 'false');
    try {
      const card = await service.build(null, 'demo-agent', { includePrivateFields: true });
      expect(card?.metadata?.operations?.metrics).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('includes metrics when env flag is true and includePrivate=true', async () => {
    const metricsSnap = {
      'api:demo-agent': { total: 10, failures: 1, avgMs: 100, p95Ms: 200, lastStatus: 200 },
      'external:demo-agent': { total: 5, failures: 0, avgMs: 120, p95Ms: 180, lastStatus: 200 },
    };
    const { service, restore } = makeService(agentRecord, metricsSnap, 'true');
    try {
      const card = await service.build(null, 'demo-agent', { includePrivateFields: true });
      const ops = card?.metadata?.operations?.metrics;
      expect(ops?.api?.total).toBe(10);
      expect(ops?.external?.total).toBe(5);
    } finally {
      restore();
    }
  });
});

