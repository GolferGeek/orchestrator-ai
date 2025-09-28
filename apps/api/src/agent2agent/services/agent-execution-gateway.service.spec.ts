import { AgentExecutionGateway } from './agent-execution-gateway.service';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode } from '../dto/task-request.dto';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { ProjectRunnerService } from '@agent-platform/services/project-runner.service';

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
  const planEngine = {
    generateDraft: jest.fn(),
  } as unknown as jest.Mocked<PlanEngineService>;
  const projectRunner = {
    startRun: jest.fn(),
  } as unknown as jest.Mocked<ProjectRunnerService>;

  return { agentsRepo, routing, modeRouter, planEngine, projectRunner };
};

describe('AgentExecutionGateway', () => {
  const request = {
    mode: AgentTaskMode.CONVERSE,
    conversationId: 'conv-1',
  } as any;

  it('returns human response when policy blocks execution', async () => {
    const { agentsRepo, routing, modeRouter, planEngine, projectRunner } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: true, humanMessage: 'blocked' });

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      projectRunner,
    );
    const result = await gateway.execute('demo', 'agent-1', request);

    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(result.humanResponse?.message).toBe('blocked');
    expect(modeRouter.execute).not.toHaveBeenCalled();
  });

  it('delegates to mode router for converse', async () => {
    const { agentsRepo, routing, modeRouter, planEngine, projectRunner } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false, metadata: { route: 'ok' } });
    modeRouter.execute.mockResolvedValue({ success: true, mode: AgentTaskMode.CONVERSE } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      projectRunner,
    );
    const result = await gateway.execute('demo', 'agent-1', request);

    expect(modeRouter.execute).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('handles plan mode via plan engine', async () => {
    const { agentsRepo, routing, modeRouter, planEngine, projectRunner } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.generateDraft.mockResolvedValue({ id: 'plan-1' } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      projectRunner,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.PLAN,
      conversationId: 'conv-1',
      payload: { planDraft: { phases: [] } },
    } as any);

    expect(planEngine.generateDraft).toHaveBeenCalled();
    expect(result.mode).toBe(AgentTaskMode.PLAN);
  });

  it('handles build mode via project runner', async () => {
    const { agentsRepo, routing, modeRouter, planEngine, projectRunner } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    projectRunner.startRun.mockResolvedValue({ id: 'run-1' } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      projectRunner,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      planId: 'plan-1',
    } as any);

    expect(projectRunner.startRun).toHaveBeenCalledWith({
      planId: 'plan-1',
      organizationSlug: 'demo',
      metadata: {},
    });
    expect(result.mode).toBe(AgentTaskMode.BUILD);
  });
});
