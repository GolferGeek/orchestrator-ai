import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentExecutionGateway } from './agent-execution-gateway.service';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { AgentOrchestrationsRepository } from '@agent-platform/repositories/agent-orchestrations.repository';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import {
  demoOrchestratorAgentRecord,
} from '@agent-platform/fixtures/reference-agents.fixture';
import { ConversationPlanRecord } from '@agent-platform/interfaces/conversation-plan-record.interface';

describe('AgentExecutionGateway (runtime integration)', () => {
  const organizationSlug = 'demo';
  const agentSlug = 'orchestrator';
  const planId = '11111111-2222-3333-4444-555555555555';
  const runId = '66666666-7777-8888-9999-aaaaaaaaaaaa';
  const conversationId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const sessionId = 'ffffffff-1111-2222-3333-444444444444';

  const buildGateway = (overrides: {
    registry?: Partial<AgentRegistryService>;
    planEngine?: Partial<PlanEngineService>;
    orchestrationRunner?: Partial<OrchestrationRunnerService>;
    agentOrchestrations?: Partial<AgentOrchestrationsRepository>;
    routingPolicy?: Partial<RoutingPolicyAdapterService>;
    modeRouter?: Partial<AgentModeRouterService>;
    streamService?: AgentRuntimeStreamService;
  } = {}) => {
    const registry = {
      getAgent: jest.fn().mockResolvedValue(demoOrchestratorAgentRecord),
      ...overrides.registry,
    } as unknown as jest.Mocked<AgentRegistryService>;

    const runtimeDefinitions = new AgentRuntimeDefinitionService();
    const runtimeExecution = new AgentRuntimeExecutionService();

    const planRecord: ConversationPlanRecord = {
      id: planId,
      conversation_id: conversationId,
      organization_slug: organizationSlug,
      agent_slug: agentSlug,
      version: 1,
      status: 'approved',
      summary: 'Integration smoke plan',
      plan_json: { phases: [] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      approved_by: null,
    };

    const planEngine = {
      generateDraft: jest.fn(),
      updateStatus: jest.fn(),
      getPlan: jest.fn().mockResolvedValue(planRecord),
      listPlans: jest.fn(),
      ...overrides.planEngine,
    } as unknown as jest.Mocked<PlanEngineService>;

    const orchestrationRunner = {
      startRun: jest.fn().mockResolvedValue({
        id: runId,
        plan_id: planId,
        status: 'pending',
        organization_slug: organizationSlug,
        agent_slug: agentSlug,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {},
      }),
      updateRun: jest.fn(),
      getRun: jest.fn(),
      ...overrides.orchestrationRunner,
    } as unknown as jest.Mocked<OrchestrationRunnerService>;

    const agentOrchestrations = {
      findBySlug: jest.fn(),
      upsert: jest.fn(),
      ...overrides.agentOrchestrations,
    } as unknown as jest.Mocked<AgentOrchestrationsRepository>;

    const routingPolicy = {
      evaluate: jest.fn().mockResolvedValue({
        showstopper: false,
        metadata: {
          provider: 'openai',
          model: 'gpt-4o-mini',
        },
      }),
      ...overrides.routingPolicy,
    } as unknown as jest.Mocked<RoutingPolicyAdapterService>;

    const modeRouter = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AgentModeRouterService>;

    const eventEmitter = new EventEmitter2();
    const streamService =
      overrides.streamService ?? new AgentRuntimeStreamService(eventEmitter);

    const gateway = new AgentExecutionGateway(
      registry,
      runtimeDefinitions,
      runtimeExecution,
      routingPolicy,
      modeRouter,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
      streamService,
    );

    return {
      gateway,
      eventEmitter,
      registry,
      planEngine,
      orchestrationRunner,
      agentOrchestrations,
      routingPolicy,
      streamService,
      modeRouter,
    };
  };

  it('starts a plan-based orchestration run and emits stream lifecycle events', async () => {
    const { gateway, eventEmitter, orchestrationRunner, planEngine } =
      buildGateway();

    const startEvents: any[] = [];
    const chunkEvents: any[] = [];
    const completeEvents: any[] = [];

    eventEmitter.on('agent.stream.start', (payload) => {
      startEvents.push(payload);
    });
    eventEmitter.on('agent.stream.chunk', (payload) => {
      chunkEvents.push(payload);
    });
    eventEmitter.on('agent.stream.complete', (payload) => {
      completeEvents.push(payload);
    });

    const request: TaskRequestDto = {
      mode: AgentTaskMode.ORCHESTRATOR_RUN_START,
      conversationId,
      sessionId,
      planId,
      userMessage: 'Kick off the orchestration',
      payload: {
        options: {
          stream: true,
        },
        metadata: {
          createdBy: 'user-123',
        },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(planEngine.getPlan).toHaveBeenCalledWith(planId);
    expect(orchestrationRunner.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        planId,
        agentSlug,
        agentType: 'orchestrator',
        promptInputs: {},
      }),
    );

    expect(response.success).toBe(true);
    expect(response.mode).toBe(AgentTaskMode.ORCHESTRATE_EXECUTE);
    expect(response.payload?.content?.id).toBe(runId);
    expect(response.payload?.metadata?.streamId).toBeDefined();

    const streamId = response.payload?.metadata?.streamId;
    expect(streamId).toEqual(startEvents[0]?.streamId);

    expect(startEvents).toHaveLength(1);
    expect(startEvents[0]).toMatchObject({
      conversationId,
      agentSlug,
      mode: AgentTaskMode.ORCHESTRATE_EXECUTE,
    });

    expect(chunkEvents).toHaveLength(1);
    expect(chunkEvents[0]).toMatchObject({ streamId });
    const runChunk = JSON.parse(chunkEvents[0]?.chunk?.content ?? '{}');
    expect(runChunk.status).toBe('run_started');
    expect(runChunk.run?.id).toBe(runId);

    expect(completeEvents).toHaveLength(1);
    expect(completeEvents[0]).toMatchObject({ streamId });
  });

  it('continues an orchestration run and streams update events', async () => {
    const updateRunId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
    const { gateway, eventEmitter, orchestrationRunner } = buildGateway({
      orchestrationRunner: {
        updateRun: jest.fn().mockResolvedValue({
          id: updateRunId,
          plan_id: planId,
          status: 'running',
          organization_slug: organizationSlug,
          agent_slug: agentSlug,
          current_step_index: 2,
          completed_steps: [{ id: 'step-1', status: 'complete' }],
          step_state: {},
          human_checkpoint_id: null,
          metadata: { checkpoint: 'step-2' },
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      },
    });

    const startEvents: any[] = [];
    const chunkEvents: any[] = [];
    const completeEvents: any[] = [];

    eventEmitter.on('agent.stream.start', (payload) => {
      startEvents.push(payload);
    });
    eventEmitter.on('agent.stream.chunk', (payload) => {
      chunkEvents.push(payload);
    });
    eventEmitter.on('agent.stream.complete', (payload) => {
      completeEvents.push(payload);
    });

    const request: TaskRequestDto = {
      mode: AgentTaskMode.ORCHESTRATOR_RUN_CONTINUE,
      orchestrationRunId: updateRunId,
      payload: {
        options: {
          stream: true,
        },
        update: {
          agentSlug,
          status: 'running',
          currentStepIndex: 2,
          completedSteps: [{ id: 'step-1', status: 'complete' }],
          metadata: { checkpoint: 'step-2' },
        },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(orchestrationRunner.updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: updateRunId,
        status: 'running',
        currentStepIndex: 2,
      }),
    );

    expect(response.success).toBe(true);
    expect(response.mode).toBe(AgentTaskMode.ORCHESTRATE_CONTINUE);
    expect(response.payload?.content?.id).toBe(updateRunId);
    expect(response.payload?.metadata?.streamId).toBeDefined();

    const streamId = response.payload?.metadata?.streamId;
    expect(streamId).toEqual(startEvents[0]?.streamId);

    expect(startEvents).toHaveLength(1);
    expect(startEvents[0]).toMatchObject({
      agentSlug,
      mode: AgentTaskMode.ORCHESTRATE_CONTINUE,
    });

    expect(chunkEvents).toHaveLength(1);
    expect(chunkEvents[0]).toMatchObject({ streamId });
    const updateChunk = JSON.parse(chunkEvents[0]?.chunk?.content ?? '{}');
    expect(updateChunk.status).toBe('run_updated');
    expect(updateChunk.run?.id).toBe(updateRunId);

    expect(completeEvents).toHaveLength(1);
    expect(completeEvents[0]).toMatchObject({ streamId });
  });

  it('executes a saved orchestration recipe and streams run start', async () => {
    const savedRunId = 'cccccccc-dddd-eeee-ffff-000000000000';
    const savedOrchestrationId = 'dddddddd-eeee-ffff-0000-111111111111';
    const templateName = 'kickoff';

    const { gateway, eventEmitter, agentOrchestrations, orchestrationRunner } =
      buildGateway({
        agentOrchestrations: {
          findBySlug: jest.fn().mockResolvedValue({
            id: savedOrchestrationId,
            organization_slug: organizationSlug,
            agent_slug: agentSlug,
            slug: 'demo-kickoff',
            display_name: 'Demo Kickoff',
            description: 'demo saved orchestration',
            status: 'active',
            orchestration_json: { phases: [] },
            prompt_templates: [
              {
                name: templateName,
                template: 'Run kickoff with {{customer}}',
                parameters: [
                  { key: 'customer', required: true },
                  { key: 'timezone', required: false, defaultValue: 'UTC' },
                ],
              },
            ],
            tags: ['demo'],
            version: '1.0.0',
            created_by: null,
            updated_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        },
        orchestrationRunner: {
          startRun: jest.fn().mockResolvedValue({
            id: savedRunId,
            plan_id: null,
            status: 'pending',
            organization_slug: organizationSlug,
            agent_slug: agentSlug,
            orchestration_slug: 'demo-kickoff',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {},
          }),
        },
      });

    const startEvents: any[] = [];
    const chunkEvents: any[] = [];
    const completeEvents: any[] = [];

    eventEmitter.on('agent.stream.start', (payload) => startEvents.push(payload));
    eventEmitter.on('agent.stream.chunk', (payload) => chunkEvents.push(payload));
    eventEmitter.on('agent.stream.complete', (payload) =>
      completeEvents.push(payload),
    );

    const request: TaskRequestDto = {
      mode: AgentTaskMode.ORCHESTRATOR_RUN_START,
      orchestrationSlug: 'demo-kickoff',
      payload: {
        options: { stream: true },
        promptParameters: {
          [templateName]: {
            customer: 'Acme Corp',
          },
        },
        metadata: {
          createdBy: 'user-456',
        },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(agentOrchestrations.findBySlug).toHaveBeenCalledWith(
      organizationSlug,
      agentSlug,
      'demo-kickoff',
    );
    expect(orchestrationRunner.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        originType: 'saved_orchestration',
        orchestrationSlug: 'demo-kickoff',
        promptInputs: {
          [templateName]: {
            customer: 'Acme Corp',
            timezone: 'UTC',
          },
        },
      }),
    );

    expect(response.success).toBe(true);
    expect(response.mode).toBe(AgentTaskMode.ORCHESTRATE_EXECUTE);
    expect(response.payload?.content?.id).toBe(savedRunId);

    const streamId = response.payload?.metadata?.streamId;
    expect(streamId).toBeDefined();
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0]).toMatchObject({
      agentSlug,
      mode: AgentTaskMode.ORCHESTRATE_EXECUTE,
    });
    expect(chunkEvents).toHaveLength(1);
    const savedChunk = JSON.parse(chunkEvents[0]?.chunk?.content ?? '{}');
    expect(savedChunk.status).toBe('run_started');
    expect(savedChunk.run?.id).toBe(savedRunId);
    expect(completeEvents).toHaveLength(1);
  });

  it('throws when required prompt parameters are missing for saved orchestration and emits error event', async () => {
    const { gateway, eventEmitter, agentOrchestrations, orchestrationRunner } =
      buildGateway({
        agentOrchestrations: {
          findBySlug: jest.fn().mockResolvedValue({
            id: 'eeeeeeee-ffff-0000-1111-222222222222',
            organization_slug: organizationSlug,
            agent_slug: agentSlug,
            slug: 'demo-kickoff',
            display_name: 'Demo Kickoff',
            description: 'demo saved orchestration',
            status: 'active',
            orchestration_json: { phases: [] },
            prompt_templates: [
              {
                name: 'kickoff',
                template: 'Run kickoff with {{customer}}',
                parameters: [{ key: 'customer', required: true }],
              },
            ],
            tags: ['demo'],
            version: '1.0.0',
            created_by: null,
            updated_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        },
      });

    const errorEvents: any[] = [];
    eventEmitter.on('agent.stream.error', (payload) => errorEvents.push(payload));

    const request: TaskRequestDto = {
      mode: AgentTaskMode.ORCHESTRATOR_RUN_START,
      orchestrationSlug: 'demo-kickoff',
      payload: {
        options: { stream: true },
        promptParameters: {
          kickoff: {
            timezone: 'UTC',
          },
        },
      },
    };

    await expect(
      gateway.execute(organizationSlug, agentSlug, request),
    ).rejects.toThrow('Missing prompt parameter customer for template kickoff');

    expect(agentOrchestrations.findBySlug).toHaveBeenCalled();
    expect(orchestrationRunner.startRun).not.toHaveBeenCalled();
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({ agentSlug });
  });

  it('returns routing showstopper as human response without invoking dispatch', async () => {
    const { gateway, routingPolicy, modeRouter } = buildGateway({
      routingPolicy: {
        evaluate: jest.fn().mockResolvedValue({
          showstopper: true,
          humanMessage: 'Requires manual approval',
        }),
      },
    });

    const response = await gateway.execute(organizationSlug, agentSlug, {
      mode: AgentTaskMode.CONVERSE,
      userMessage: 'Hi there',
      payload: {},
    });

    expect(response.success).toBe(false);
    expect(response.humanResponse?.message).toBe('Requires manual approval');
    expect(routingPolicy.evaluate).toHaveBeenCalled();
    expect(modeRouter.execute).not.toHaveBeenCalled();
  });

  it('creates plan drafts with agent metadata enrichment', async () => {
    const createdPlan = {
      id: 'plan-xyz',
      conversation_id: conversationId,
      organization_slug: organizationSlug,
      agent_slug: agentSlug,
      summary: 'Draft summary',
      status: 'draft',
      plan_json: { phases: [], _meta: { agent: { slug: agentSlug } } },
      created_by: 'user-789',
      approved_by: null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as const;

    const { gateway, planEngine } = buildGateway({
      planEngine: {
        generateDraft: jest.fn().mockResolvedValue(createdPlan),
      },
    });

    const request: TaskRequestDto = {
      mode: AgentTaskMode.PLAN,
      conversationId,
      userMessage: 'Draft a plan for kickoff',
      payload: {
        summary: 'Draft summary',
        planDraft: { phases: [] },
        metadata: { createdBy: 'user-789', priority: 'high' },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(planEngine.generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        organizationSlug,
        agentSlug,
        summary: 'Draft summary',
        draftPlan: expect.objectContaining({ phases: [] }),
        agentMetadata: expect.objectContaining({
          slug: agentSlug,
          organizationSlug,
        }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.mode).toBe(AgentTaskMode.PLAN);
    expect(response.payload?.content).toBe(createdPlan);
  });

  it('throws when plan belongs to different conversation', async () => {
    const mismatchedPlan = {
      id: planId,
      conversation_id: 'other-conv',
      organization_slug: organizationSlug,
      agent_slug: agentSlug,
      summary: 'Mismatch',
      status: 'approved',
      plan_json: {},
      created_by: null,
      approved_by: null,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    const { gateway, planEngine } = buildGateway({
      planEngine: {
        getPlan: jest.fn().mockResolvedValue(mismatchedPlan),
      },
    });

    const request: TaskRequestDto = {
      mode: AgentTaskMode.BUILD,
      conversationId,
      planId,
      payload: {
        options: { stream: false },
      },
    };

    await expect(
      gateway.execute(organizationSlug, agentSlug, request),
    ).rejects.toThrow('Plan is tied to a different conversation');

    expect(planEngine.getPlan).toHaveBeenCalledWith(planId);
  });

  it('executes plan-based run and returns metadata without streaming', async () => {
    const { gateway, planEngine, orchestrationRunner } = buildGateway({
      orchestrationRunner: {
        startRun: jest.fn().mockResolvedValue({
          id: runId,
          plan_id: planId,
          status: 'pending',
          organization_slug: organizationSlug,
          agent_slug: agentSlug,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: { existing: true },
        }),
      },
    });

    const request: TaskRequestDto = {
      mode: AgentTaskMode.ORCHESTRATOR_RUN_START,
      conversationId,
      planId,
      payload: {
        options: { stream: false },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(planEngine.getPlan).toHaveBeenCalledWith(planId);
    expect(orchestrationRunner.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        planId,
        metadata: expect.objectContaining({
          conversationId,
          planVersion: 1,
          agentSlug,
        }),
      }),
    );

    expect(response.success).toBe(true);
    expect(response.payload?.metadata).toMatchObject({
      planVersion: 1,
      agentSlug,
    });
    expect(response.payload?.metadata?.streamId).toBeUndefined();
  });

  it('routes converse streaming requests through mode router and preserves metadata', async () => {
    const streamResponse = TaskResponseDto.success(AgentTaskMode.CONVERSE, {
      content: { message: 'hello world' },
      metadata: { streamId: 'stream-abc', provider: 'openai' },
    });

    const { gateway, routingPolicy, modeRouter } = buildGateway({
      routingPolicy: {
        evaluate: jest.fn().mockResolvedValue({
          showstopper: false,
          metadata: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            custom: 'route-metadata',
          },
        }),
      },
      streamService: undefined,
    });

    modeRouter.execute.mockResolvedValue(streamResponse);

    const request: TaskRequestDto = {
      mode: AgentTaskMode.CONVERSE,
      conversationId,
      sessionId,
      userMessage: 'Need help',
      payload: {
        options: { stream: true },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(routingPolicy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: AgentTaskMode.CONVERSE }),
      expect.objectContaining({ slug: agentSlug }),
    );
    expect(modeRouter.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationSlug,
        agentSlug,
        request: expect.objectContaining({ mode: AgentTaskMode.CONVERSE }),
        routingMetadata: expect.objectContaining({ custom: 'route-metadata' }),
      }),
    );

    expect(response.success).toBe(true);
    expect(response.payload?.metadata?.streamId).toBe('stream-abc');
  });

  it('handles converse request without streaming via mode router fallback payload', async () => {
    const nonStreamResponse = TaskResponseDto.success(AgentTaskMode.CONVERSE, {
      content: { message: 'inline response' },
      metadata: { provider: 'openai', model: 'gpt-4o-mini' },
    });

    const { gateway, routingPolicy, modeRouter } = buildGateway({
      routingPolicy: {
        evaluate: jest.fn().mockResolvedValue({
          showstopper: false,
          metadata: {
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        }),
      },
    });

    modeRouter.execute.mockResolvedValue(nonStreamResponse);

    const request: TaskRequestDto = {
      mode: AgentTaskMode.CONVERSE,
      userMessage: 'Quick question',
      payload: {
        options: { stream: false },
      },
    };

    const response = await gateway.execute(organizationSlug, agentSlug, request);

    expect(routingPolicy.evaluate).toHaveBeenCalled();
    expect(modeRouter.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ mode: AgentTaskMode.CONVERSE }),
      }),
    );
    expect(response.success).toBe(true);
    expect(response.payload?.content?.message).toBe('inline response');
    expect(response.payload?.metadata?.provider).toBe('openai');
  });
});
