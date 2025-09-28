import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { CentralizedRoutingService } from '@llm/centralized-routing.service';
import { AgentTaskMode } from '../dto/task-request.dto';

describe('RoutingPolicyAdapterService', () => {
  it('returns showstopper when routing blocks agent', async () => {
    const routingService = {
      determineRoute: jest.fn().mockResolvedValue({
        routeToAgent: false,
        blockingReason: 'PII detected',
      }),
    } as unknown as CentralizedRoutingService;

    const adapter = new RoutingPolicyAdapterService(routingService);
    const result = await adapter.evaluate(
      { mode: AgentTaskMode.CONVERSE } as any,
      { slug: 'agent-1' },
    );

    expect(result.showstopper).toBe(true);
    expect(result.humanMessage).toBe('PII detected');
  });

  it('passes through when routing allows agent', async () => {
    const routingService = {
      determineRoute: jest.fn().mockResolvedValue({
        routeToAgent: true,
      }),
    } as unknown as CentralizedRoutingService;

    const adapter = new RoutingPolicyAdapterService(routingService);
    const result = await adapter.evaluate(
      { mode: AgentTaskMode.CONVERSE } as any,
      { slug: 'agent-1' },
    );

    expect(result.showstopper).toBe(false);
  });
});
