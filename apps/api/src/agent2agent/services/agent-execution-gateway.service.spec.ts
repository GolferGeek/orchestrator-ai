import { AgentExecutionGateway } from './agent-execution-gateway.service';
import { AgentsRepository } from '@agent-platform/repositories/agents.repository';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode } from '../dto/task-request.dto';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { AgentOrchestrationsRepository } from '@agent-platform/repositories/agent-orchestrations.repository';

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
  const orchestrationRunner = {
    startRun: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationRunnerService>;
  const agentOrchestrations = {
    findBySlug: jest.fn(),
  } as unknown as jest.Mocked<AgentOrchestrationsRepository>;

  return {
    agentsRepo,
    routing,
    modeRouter,
    planEngine,
    orchestrationRunner,
    agentOrchestrations,
  };
};

describe('AgentExecutionGateway', () => {
  const request = {
    mode: AgentTaskMode.CONVERSE,
    conversationId: 'conv-1',
  } as any;

  it('returns human response when policy blocks execution', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: true, humanMessage: 'blocked' });

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );
    const result = await gateway.execute('demo', 'agent-1', request);

    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(result.humanResponse?.message).toBe('blocked');
    expect(modeRouter.execute).not.toHaveBeenCalled();
  });

  it('delegates to mode router for converse', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false, metadata: { route: 'ok' } });
    modeRouter.execute.mockResolvedValue({ success: true, mode: AgentTaskMode.CONVERSE } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );
    const result = await gateway.execute('demo', 'agent-1', request);

    expect(modeRouter.execute).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('handles plan mode via plan engine', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.generateDraft.mockResolvedValue({ id: 'plan-1' } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.PLAN,
      conversationId: 'conv-1',
      payload: { planDraft: { phases: [] } },
    } as any);

    expect(planEngine.generateDraft).toHaveBeenCalled();
    expect(result.mode).toBe(AgentTaskMode.PLAN);
  });

  it('handles build mode via orchestration runner', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    orchestrationRunner.startRun.mockResolvedValue({ id: 'run-1' } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      planId: 'plan-1',
    } as any);

    expect(orchestrationRunner.startRun).toHaveBeenCalledWith({
      planId: 'plan-1',
      originType: 'plan',
      originId: 'plan-1',
      organizationSlug: 'demo',
      promptInputs: {},
      metadata: {},
    });
    expect(result.mode).toBe(AgentTaskMode.BUILD);
    expect(result.payload?.metadata).toMatchObject({
      originType: 'plan',
      planId: 'plan-1',
    });
  });

  it('handles saved orchestration execution with prompt validation', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    agentOrchestrations.findBySlug.mockResolvedValue({
      id: 'orch-1',
      slug: 'recipe-alpha',
      prompt_templates: [
        {
          name: 'plan_prompt',
          parameters: [
            { key: 'topic', required: true },
            { key: 'tone', defaultValue: 'professional' },
          ],
        },
      ],
    } as any);
    orchestrationRunner.startRun.mockResolvedValue({ id: 'run-2' } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      orchestrationSlug: 'recipe-alpha',
      promptParameters: {
        plan_prompt: {
          topic: 'Q1 launch',
        },
      },
    } as any);

    expect(agentOrchestrations.findBySlug).toHaveBeenCalledWith(
      'demo',
      'agent-1',
      'recipe-alpha',
    );
    expect(orchestrationRunner.startRun).toHaveBeenCalledWith({
      organizationSlug: 'demo',
      originType: 'saved_orchestration',
      originId: 'orch-1',
      orchestrationSlug: 'recipe-alpha',
      promptInputs: {
        plan_prompt: {
          topic: 'Q1 launch',
          tone: 'professional',
        },
      },
      metadata: {
        orchestrationId: 'orch-1',
      },
    });
    expect(result.payload?.metadata).toMatchObject({
      originType: 'saved_orchestration',
      orchestration: { slug: 'recipe-alpha' },
    });
  });

  it('throws when required prompt parameter missing', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    agentOrchestrations.findBySlug.mockResolvedValue({
      id: 'orch-1',
      slug: 'recipe-alpha',
      prompt_templates: [
        {
          name: 'plan_prompt',
          parameters: [{ key: 'topic', required: true }],
        },
      ],
    } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    await expect(
      gateway.execute('demo', 'agent-1', {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-1',
        orchestrationSlug: 'recipe-alpha',
        promptParameters: {
          plan_prompt: {},
        },
      } as any),
    ).rejects.toThrow('Missing prompt parameter topic');
  });

  it('falls back to ad-hoc orchestration when no plan or recipe provided', async () => {
    const {
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    agentsRepo.findBySlug.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    orchestrationRunner.startRun.mockResolvedValue({ id: 'run-adhoc' } as any);

    const gateway = new AgentExecutionGateway(
      agentsRepo,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.BUILD,
      conversationId: 'conv-1',
      payload: { metadata: { trigger: 'manual' } },
    } as any);

    expect(orchestrationRunner.startRun).toHaveBeenCalledWith({
      organizationSlug: 'demo',
      originType: 'ad_hoc',
      promptInputs: {},
      metadata: { trigger: 'manual' },
    });
    expect(result.payload?.metadata).toMatchObject({ originType: 'ad_hoc' });
  });
});
