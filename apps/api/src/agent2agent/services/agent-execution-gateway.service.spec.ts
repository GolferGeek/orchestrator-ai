import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentExecutionGateway } from './agent-execution-gateway.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode } from '../dto/task-request.dto';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { AgentOrchestrationsRepository } from '@agent-platform/repositories/agent-orchestrations.repository';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';

const createMocks = () => {
  const registry = {
    getAgent: jest.fn(),
  } as unknown as jest.Mocked<AgentRegistryService>;
  const runtimeDefinitions = {
    buildDefinition: jest.fn().mockReturnValue({
      id: 'agent-id',
      slug: 'agent-1',
      organizationSlug: 'demo',
      displayName: 'Agent 1',
      description: null,
      agentType: 'specialist',
      modeProfile: 'full_cycle',
      status: 'active',
      metadata: {
        name: 'Agent 1',
        displayName: 'Agent 1',
        description: null,
        category: null,
        version: '1.0.0',
        type: 'specialist',
        provider: null,
        tags: [],
        raw: null,
      },
      hierarchy: undefined,
      capabilities: [],
      skills: [],
      communication: { inputModes: [], outputModes: [] },
      execution: {
        modeProfile: 'full_cycle',
        canConverse: true,
        canPlan: true,
        canBuild: true,
        requiresHumanGate: false,
        executionProfile: null,
        timeoutSeconds: null,
      },
      transport: undefined,
      llm: undefined,
      prompts: {
        system: undefined,
        plan: undefined,
        build: undefined,
        human: undefined,
        additional: undefined,
      },
      context: null,
      config: null,
      agentCard: null,
      rawDescriptor: null,
      record: {} as any,
    } as AgentRuntimeDefinition),
  } as unknown as jest.Mocked<AgentRuntimeDefinitionService>;
  const routing = {
    evaluate: jest.fn(),
  } as unknown as jest.Mocked<RoutingPolicyAdapterService>;
  const modeRouter = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<AgentModeRouterService>;
  const planEngine = {
    generateDraft: jest.fn(),
    getPlan: jest.fn(),
  } as unknown as jest.Mocked<PlanEngineService>;
  const orchestrationRunner = {
    startRun: jest.fn(),
    updateRun: jest.fn(),
    getRun: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationRunnerService>;
  const agentOrchestrations = {
    findBySlug: jest.fn(),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<AgentOrchestrationsRepository>;

  return {
    registry,
    runtimeDefinitions,
    routing,
    modeRouter,
    planEngine,
    orchestrationRunner,
    agentOrchestrations,
  };
};

const instantiateGateway = (
  mocks: ReturnType<typeof createMocks>,
) =>
  new AgentExecutionGateway(
    mocks.registry,
    mocks.runtimeDefinitions,
    mocks.routing,
    mocks.modeRouter,
    mocks.planEngine,
    mocks.orchestrationRunner,
    mocks.agentOrchestrations,
  );

describe('AgentExecutionGateway', () => {
  const request = {
    mode: AgentTaskMode.CONVERSE,
    conversationId: 'conv-1',
  } as any;

  it('returns human response when policy blocks execution', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({
      showstopper: true,
      humanMessage: 'blocked',
    });

    const gateway = new AgentExecutionGateway(
      registry,
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
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({
      showstopper: false,
      metadata: { route: 'ok' },
    });
    modeRouter.execute.mockResolvedValue({
      success: true,
      mode: AgentTaskMode.CONVERSE,
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.generateDraft.mockResolvedValue({ id: 'plan-1' } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    const planRecord = {
      id: 'plan-1',
      conversation_id: 'conv-1',
      organization_slug: 'demo',
      agent_slug: 'agent-1',
      version: 1,
      status: 'approved',
      summary: null,
      plan_json: {},
      created_by: null,
      approved_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;
    planEngine.getPlan.mockResolvedValue(planRecord);
    orchestrationRunner.startRun.mockResolvedValue({ id: 'run-1' } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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

    expect(planEngine.getPlan).toHaveBeenCalledWith('plan-1');
    expect(orchestrationRunner.startRun).toHaveBeenCalledWith({
      planId: 'plan-1',
      originType: 'plan',
      originId: 'plan-1',
      organizationSlug: 'demo',
      promptInputs: {},
      metadata: {
        conversationId: 'conv-1',
        planVersion: 1,
      },
    });
    expect(result.mode).toBe(AgentTaskMode.BUILD);
    expect(result.payload?.metadata).toMatchObject({
      originType: 'plan',
      planId: 'plan-1',
      planVersion: 1,
      conversationId: 'conv-1',
    });
  });

  it('throws when plan cannot be found for execution', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.getPlan.mockResolvedValue(null as any);

    const gateway = new AgentExecutionGateway(
      registry,
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
        planId: 'missing-plan',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when plan belongs to a different agent', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.getPlan.mockResolvedValue({
      id: 'plan-1',
      conversation_id: 'conv-1',
      organization_slug: 'demo',
      agent_slug: 'other-agent',
      version: 1,
      status: 'approved',
      summary: null,
      plan_json: {},
      created_by: null,
      approved_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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
        planId: 'plan-1',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when plan conversation does not match request', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.getPlan.mockResolvedValue({
      id: 'plan-1',
      conversation_id: 'conv-999',
      organization_slug: 'demo',
      agent_slug: 'agent-1',
      version: 1,
      status: 'approved',
      summary: null,
      plan_json: {},
      created_by: null,
      approved_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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
        planId: 'plan-1',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when plan organization differs from request context', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.getPlan.mockResolvedValue({
      id: 'plan-1',
      conversation_id: 'conv-1',
      organization_slug: 'other-org',
      agent_slug: 'agent-1',
      version: 1,
      status: 'approved',
      summary: null,
      plan_json: {},
      created_by: null,
      approved_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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
        planId: 'plan-1',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('handles saved orchestration execution with prompt validation', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
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
      registry,
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

  it('creates orchestration drafts through new mode', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.generateDraft.mockResolvedValue({
      id: 'plan-1',
      status: 'draft',
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_CREATE,
      conversationId: 'conv-1',
      payload: { planDraft: { phases: [] } },
    } as any);

    expect(planEngine.generateDraft).toHaveBeenCalled();
    expect(result.mode).toBe(AgentTaskMode.ORCHESTRATE_CREATE);
    expect(result.payload?.content).toMatchObject({ id: 'plan-1' });
  });

  it('executes orchestration via new mode', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    const planRecord = {
      id: 'plan-2',
      conversation_id: 'conv-1',
      organization_slug: 'demo',
      agent_slug: 'agent-1',
      version: 2,
      status: 'approved',
      summary: null,
      plan_json: {},
      created_by: null,
      approved_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;
    planEngine.getPlan.mockResolvedValue(planRecord);
    orchestrationRunner.startRun.mockResolvedValue({
      id: 'run-1',
      origin_type: 'plan',
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_EXECUTE,
      conversationId: 'conv-1',
      planId: 'plan-2',
    } as any);

    expect(planEngine.getPlan).toHaveBeenCalledWith('plan-2');
    expect(orchestrationRunner.startRun).toHaveBeenCalledWith({
      planId: 'plan-2',
      originType: 'plan',
      originId: 'plan-2',
      organizationSlug: 'demo',
      promptInputs: {},
      metadata: {
        conversationId: 'conv-1',
        planVersion: 2,
      },
    });
    expect(result.mode).toBe(AgentTaskMode.ORCHESTRATE_EXECUTE);
    expect(result.payload?.metadata).toMatchObject({
      planId: 'plan-2',
      planVersion: 2,
      conversationId: 'conv-1',
    });
  });

  it('continues orchestration run', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    orchestrationRunner.updateRun.mockResolvedValue({
      id: 'run-1',
      status: 'running',
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_CONTINUE,
      conversationId: 'conv-1',
      orchestrationRunId: 'run-1',
      payload: { update: { status: 'running' } },
    } as any);

    expect(orchestrationRunner.updateRun).toHaveBeenCalledWith({
      runId: 'run-1',
      status: 'running',
      currentStepIndex: undefined,
      completedSteps: undefined,
      stepState: undefined,
      humanCheckpointId: undefined,
      metadata: undefined,
      completedAt: undefined,
    });
    expect(result.mode).toBe(AgentTaskMode.ORCHESTRATE_CONTINUE);
  });

  it('saves orchestration recipe', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    agentOrchestrations.upsert.mockResolvedValue({
      id: 'orch-1',
      slug: 'recipe',
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const result = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_SAVE_RECIPE,
      conversationId: 'conv-1',
      payload: {
        orchestration: {
          slug: 'recipe',
          displayName: 'Recipe',
          orchestrationJson: { phases: [] },
        },
      },
    } as any);

    expect(agentOrchestrations.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'recipe', organization_slug: 'demo' }),
    );
    expect(result.mode).toBe(AgentTaskMode.ORCHESTRATE_SAVE_RECIPE);
  });

  it('handles orchestration create → execute → continue flow', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();

    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    planEngine.generateDraft.mockResolvedValue({
      id: 'plan-123',
      status: 'draft',
    } as any);
    planEngine.getPlan.mockResolvedValue({
      id: 'plan-123',
      conversation_id: 'conv-123',
      organization_slug: 'demo',
      agent_slug: 'agent-1',
      version: 3,
      status: 'approved',
      summary: null,
      plan_json: {},
      created_by: null,
      approved_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
    orchestrationRunner.startRun.mockResolvedValue({
      id: 'run-123',
      origin_type: 'plan',
      plan_id: 'plan-123',
      status: 'pending',
    } as any);
    orchestrationRunner.updateRun.mockResolvedValue({
      id: 'run-123',
      status: 'running',
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    );

    const draft = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_CREATE,
      conversationId: 'conv-123',
      payload: { planDraft: { phases: [] } },
    } as any);

    expect(planEngine.generateDraft).toHaveBeenCalled();
    expect(draft.mode).toBe(AgentTaskMode.ORCHESTRATE_CREATE);

    const run = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_EXECUTE,
      conversationId: 'conv-123',
      planId: 'plan-123',
    } as any);

    expect(orchestrationRunner.startRun).toHaveBeenCalledWith({
      planId: 'plan-123',
      originType: 'plan',
      originId: 'plan-123',
      organizationSlug: 'demo',
      promptInputs: {},
      metadata: {
        conversationId: 'conv-123',
        planVersion: 3,
      },
    });
    expect(run.mode).toBe(AgentTaskMode.ORCHESTRATE_EXECUTE);

    const continued = await gateway.execute('demo', 'agent-1', {
      mode: AgentTaskMode.ORCHESTRATE_CONTINUE,
      conversationId: 'conv-123',
      orchestrationRunId: 'run-123',
      payload: { update: { status: 'running' } },
    } as any);

    expect(orchestrationRunner.updateRun).toHaveBeenCalledWith({
      runId: 'run-123',
      status: 'running',
      currentStepIndex: undefined,
      completedSteps: undefined,
      stepState: undefined,
      humanCheckpointId: undefined,
      metadata: undefined,
      completedAt: undefined,
    });
    expect(continued.mode).toBe(AgentTaskMode.ORCHESTRATE_CONTINUE);
  });

  it('throws when required prompt parameter missing', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
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
      registry,
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

  it('falls back to single-call execution when no plan or recipe provided', async () => {
    const {
      registry,
      routing,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
    } = createMocks();
    registry.getAgent.mockResolvedValue({ slug: 'agent-1' } as any);
    routing.evaluate.mockResolvedValue({ showstopper: false });
    modeRouter.execute.mockResolvedValue({
      success: true,
      mode: AgentTaskMode.BUILD,
      payload: { content: { status: 'build_started' } },
    } as any);

    const gateway = new AgentExecutionGateway(
      registry,
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

    expect(orchestrationRunner.startRun).not.toHaveBeenCalled();
    expect(modeRouter.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationSlug: 'demo',
        agentSlug: 'agent-1',
        agent: { slug: 'agent-1' },
        request: expect.objectContaining({
          mode: AgentTaskMode.BUILD,
          conversationId: 'conv-1',
          payload: { metadata: { trigger: 'manual' } },
        }),
        routingMetadata: undefined,
      }),
    );
    expect(result.mode).toBe(AgentTaskMode.BUILD);
  });
});
