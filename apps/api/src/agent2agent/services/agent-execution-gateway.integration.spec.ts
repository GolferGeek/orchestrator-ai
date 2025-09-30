import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentExecutionGateway } from './agent-execution-gateway.service';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
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
});
