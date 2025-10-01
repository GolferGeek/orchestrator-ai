import { Agent2AgentController } from './agent2agent.controller';

describe('Agent2AgentController - health', () => {
  it('returns minimal health payload', async () => {
    const cardBuilder: any = {};
    const gateway: any = {};
    const controller = new Agent2AgentController(cardBuilder, gateway);

    const res = await controller.getHealth('global', 'orchestrator');
    expect(res.ok).toBe(true);
    expect(res.service).toBe('agent-to-agent');
    expect(res.organization).toBe('global');
    expect(res.agent).toBe('orchestrator');
    expect(typeof res.timestamp).toBe('string');
  });

  it('normalizes org slug for non-global', async () => {
    const controller = new Agent2AgentController({} as any, {} as any);
    const res = await controller.getHealth('my-org', 'planner');
    expect(res.organization).toBe('my-org');
    expect(res.agent).toBe('planner');
  });
});

