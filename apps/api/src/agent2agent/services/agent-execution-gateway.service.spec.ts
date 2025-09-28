import { AgentExecutionGateway } from './agent-execution-gateway.service';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode } from '../dto/task-request.dto';

const createMocks = () => {
  const agentsRepo = {
    findBySlug: jest.fn(),
  } as unknown as jest.Mocked<AgentsRepository>;
  const routing = {
    evaluate: jest.fn(),
  } as unknown as jest.Mocked<RoutingPolicyAdapterService>;
  const modeRouter = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<AgentModeRouterService>;
  return { agentsRepo, routing, modeRouter };
};

describe('AgentExecutionGateway', () => {
  const request = {
    mode: AgentTaskMode.CONVERSE,
    conversationId: 'conv-1',
  } as any;

  it('returns human response when policy blocks execution', async () => {
    const { agentsRepo, routing, modeRouter } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: true, humanMessage: 'blocked' });

    const gateway = new AgentExecutionGateway(agentsRepo, routing, modeRouter);
    const result = await gateway.execute('demo', 'agent-1', request);

    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(result.humanResponse?.message).toBe('blocked');
    expect(modeRouter.execute).not.toHaveBeenCalled();
  });

  it('delegates to mode router when allowed', async () => {
    const { agentsRepo, routing, modeRouter } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false, metadata: { route: 'ok' } });
    modeRouter.execute.mockResolvedValue({ success: true, mode: AgentTaskMode.CONVERSE } as any);

    const gateway = new AgentExecutionGateway(agentsRepo, routing, modeRouter);
    const result = await gateway.execute('demo', 'agent-1', request);

    expect(modeRouter.execute).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
