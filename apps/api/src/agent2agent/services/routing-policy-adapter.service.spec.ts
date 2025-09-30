import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { CentralizedRoutingService } from '@llm/centralized-routing.service';
import { AgentTaskMode } from '../dto/task-request.dto';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';

const agentRecord: AgentRecord = {
  id: 'agent-1',
  organization_slug: 'acme',
  slug: 'agent-1',
  display_name: 'Agent One',
  description: null,
  agent_type: 'specialist',
  mode_profile: 'full_cycle',
  version: '1.0.0',
  status: 'active',
  yaml: '---',
  agent_card: null,
  context: null,
  config: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('RoutingPolicyAdapterService', () => {
  it('returns showstopper when routing blocks agent', async () => {
    const determineRoute = jest.fn().mockResolvedValue({
      routeToAgent: false,
      blockingReason: 'PII detected',
    });
    const routingService = {
      determineRoute,
    } as unknown as CentralizedRoutingService;

    const adapter = new RoutingPolicyAdapterService(routingService);
    const _result = await adapter.evaluate(
      { mode: AgentTaskMode.CONVERSE, conversationId: 'conv-1' } as any,
      agentRecord,
    );

    expect(result.showstopper).toBe(true);
    expect(result.humanMessage).toBe('PII detected');
    expect(determineRoute).toHaveBeenCalledWith(
      expect.stringContaining('Mode converse request'),
      expect.objectContaining({
        mode: AgentTaskMode.CONVERSE,
        agentSlug: 'agent-1',
        conversationId: 'conv-1',
        metadata: {},
      }),
    );
  });

  it('passes through when routing allows agent', async () => {
    const determineRoute = jest.fn().mockResolvedValue({
      routeToAgent: true,
    });
    const routingService = {
      determineRoute,
    } as unknown as CentralizedRoutingService;

    const adapter = new RoutingPolicyAdapterService(routingService);
    const _result = await adapter.evaluate(
      {
        mode: AgentTaskMode.PLAN,
        userMessage: 'Plan a launch',
        payload: {
          summary: 'Launch summary',
          planDraft: { phases: ['one', 'two'] },
          metadata: { userId: 'user-123', requestId: 'req-456' },
        },
        conversationId: 'conv-42',
      } as any,
      agentRecord,
    );

    expect(result.showstopper).toBe(false);
    expect(determineRoute).toHaveBeenCalledWith(
      expect.stringContaining('Plan draft'),
      expect.objectContaining({
        mode: AgentTaskMode.PLAN,
        userId: 'user-123',
        requestId: 'req-456',
        conversationId: 'conv-42',
        organizationSlug: 'acme',
        metadata: expect.objectContaining({ userId: 'user-123' }),
      }),
    );
  });

  it('includes recent conversation messages in routing prompt', async () => {
    const determineRoute = jest.fn().mockResolvedValue({ routeToAgent: true });
    const routingService = {
      determineRoute,
    } as unknown as CentralizedRoutingService;

    const adapter = new RoutingPolicyAdapterService(routingService);
    await adapter.evaluate(
      {
        mode: AgentTaskMode.CONVERSE,
        conversationId: 'conv-99',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'Reply' },
          { role: 'user', content: 'Second question' },
        ],
      } as any,
      agentRecord,
    );

    const [prompt] = determineRoute.mock.calls[0];
    expect(prompt).toContain('Recent transcript');
  });
});
