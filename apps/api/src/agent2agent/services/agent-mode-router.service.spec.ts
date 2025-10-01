import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { AgentExecutionContext } from './agent-mode-router.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/database-agent-definition.interface';
import {
  AgentRuntimePromptService,
  PromptPayload,
} from '@agent-platform/services/agent-runtime-prompt.service';
import {
  AgentRuntimeDispatchService,
  AgentRuntimeDispatchResult,
} from '@agent-platform/services/agent-runtime-dispatch.service';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';

const baseAgent: AgentRecord = {
  id: 'agent-1',
  organization_slug: 'acme',
  slug: 'agent-1',
  display_name: 'Agent One',
  description: 'Helpful assistant.',
  agent_type: 'specialist',
  mode_profile: 'full_cycle',
  version: '1.0.0',
  status: 'active',
  yaml: '---',
  agent_card: null,
  context: { system_prompt: 'You are Agent One.' },
  config: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const routingDecision = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  isLocal: false,
  fallbackUsed: false,
  complexityScore: 0.5,
  reasoningPath: ['step1'],
  piiMetadata: { policyDecision: { reasoningPath: [] } },
  routeToAgent: true,
} as any;

const createDispatchResult = (content: string): AgentRuntimeDispatchResult => ({
  response: {
    content,
    metadata: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      requestId: 'req-1',
      timestamp: new Date().toISOString(),
      usage: { inputTokens: 10, outputTokens: 25, totalTokens: 35 },
      timing: { startTime: Date.now(), endTime: Date.now(), duration: 10 },
      status: 'completed',
    },
  } as any,
  config: {
    provider: 'openai',
    model: 'gpt-4o-mini',
  } as any,
  params: {
    systemPrompt: 'system prompt',
    userMessage: 'user message',
  } as any,
  routingDecision,
});

describe('AgentModeRouterService', () => {
  let agentRegistry: jest.Mocked<AgentRegistryService>;
  let runtimeDefinitions: jest.Mocked<AgentRuntimeDefinitionService>;
  let promptBuilder: jest.Mocked<AgentRuntimePromptService>;
  let dispatcher: jest.Mocked<AgentRuntimeDispatchService>;
  let streamService: jest.Mocked<AgentRuntimeStreamService>;
  let definition: AgentRuntimeDefinition;
  let lifecycle: { start: jest.Mock; progress: jest.Mock; complete: jest.Mock; fail: jest.Mock };
  let deliverables: { maybeCreateFromBuild: jest.Mock };
  let service: AgentModeRouterService;

  beforeEach(() => {
    agentRegistry = {
      getAgent: jest.fn(),
      listAgents: jest.fn(),
      invalidate: jest.fn(),
      clearAll: jest.fn(),
    } as unknown as jest.Mocked<AgentRegistryService>;
    definition = {
      id: baseAgent.id,
      slug: baseAgent.slug,
      organizationSlug: baseAgent.organization_slug,
      displayName: baseAgent.display_name,
      description: baseAgent.description,
      agentType: baseAgent.agent_type,
      modeProfile: baseAgent.mode_profile,
      status: baseAgent.status,
      metadata: {
        name: baseAgent.display_name,
        displayName: baseAgent.display_name,
        description: baseAgent.description,
        category: null,
        version: baseAgent.version,
        type: baseAgent.agent_type,
        provider: null,
        tags: [],
        raw: null,
      },
      hierarchy: undefined,
      capabilities: [],
      skills: [],
      communication: { inputModes: [], outputModes: [] },
      execution: {
        modeProfile: baseAgent.mode_profile,
        canConverse: true,
        canPlan: false,
        canBuild: false,
        requiresHumanGate: false,
        executionProfile: undefined,
        timeoutSeconds: undefined,
      },
      transport: undefined,
      llm: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: undefined,
        maxTokens: undefined,
        systemPrompt: 'You are Agent One.',
        raw: undefined,
      },
      prompts: {
        system: 'You are Agent One.',
        plan: undefined,
        build: undefined,
        human: undefined,
        additional: undefined,
      },
      context: baseAgent.context,
      config: baseAgent.config,
      agentCard: null,
      rawDescriptor: null,
      record: baseAgent,
    };

    promptBuilder = {
      buildPromptPayload: jest
        .fn()
        .mockImplementation(({ request, mode }): PromptPayload => ({
          systemPrompt: mode === 'build' ? 'build system prompt' : 'system prompt',
          userMessage: mode === 'build' ? 'build message' : 'user message',
          metadata: {
            agentId: baseAgent.id,
            agentSlug: baseAgent.slug,
            agentType: baseAgent.agent_type,
            modeProfile: baseAgent.mode_profile,
            organizationSlug: baseAgent.organization_slug,
            ...(request.metadata ?? {}),
          },
          optionMetadata: {
            agentId: baseAgent.id,
            agentSlug: baseAgent.slug,
            agentType: baseAgent.agent_type,
            modeProfile: baseAgent.mode_profile,
            organizationSlug: baseAgent.organization_slug,
            ...(request.metadata ?? {}),
          },
          conversationId: request.conversationId,
          sessionId: request.sessionId,
          userId: request.metadata?.userId ?? null,
        })),
      mapComplexity: jest.fn().mockReturnValue('medium'),
    } as unknown as jest.Mocked<AgentRuntimePromptService>;

    dispatcher = {
      dispatch: jest
        .fn()
        .mockResolvedValue(createDispatchResult('Hello there!')),
      dispatchStream: jest.fn().mockImplementation((options: any) => {
        options?.onStreamChunk?.({ type: 'partial', content: 'chunk' });
        return {
          response: Promise.resolve(createDispatchResult('Stream output')),
          stream: (async function* () {})(),
          cancel: jest.fn(),
        };
      }),
    } as unknown as jest.Mocked<AgentRuntimeDispatchService>;

    streamService = {
      start: jest.fn().mockImplementation(() => ({
        streamId: 'stream-1',
        publishChunk: jest.fn(),
        complete: jest.fn(),
        error: jest.fn(),
      })),
    } as unknown as jest.Mocked<AgentRuntimeStreamService>;

    runtimeDefinitions = {
      buildDefinition: jest.fn().mockReturnValue(definition),
    } as unknown as jest.Mocked<AgentRuntimeDefinitionService>;

    lifecycle = {
      start: jest.fn(),
      progress: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
    };
    deliverables = { maybeCreateFromBuild: jest.fn().mockResolvedValue(null) } as any;

    service = new AgentModeRouterService(
      agentRegistry,
      runtimeDefinitions,
      promptBuilder,
      dispatcher,
      streamService,
      lifecycle as any,
      deliverables as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildContext = (
    request: Partial<TaskRequestDto>,
    metadata: Record<string, any> | undefined = routingDecision,
  ): AgentExecutionContext => ({
    agent: baseAgent,
    request: {
      mode: AgentTaskMode.CONVERSE,
      conversationId: 'conv-1',
      payload: {},
      ...request,
    } as TaskRequestDto,
    routingMetadata: metadata,
  });

  it('generates LLM response for converse mode', async () => {
    const result = await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hi agent',
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'Answer' },
        ],
      }),
    );

    expect(promptBuilder.buildPromptPayload).toHaveBeenCalledWith({
      definition,
      request: expect.objectContaining({ userMessage: 'Hi agent' }),
      mode: 'converse',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        definition,
        prompt: expect.objectContaining({ userMessage: 'user message' }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.payload?.content?.message).toBe('Hello there!');
  });

  it('fails when routing metadata missing for converse', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.CONVERSE }, null as any),
    );

    expect(result.success).toBe(false);
    expect(promptBuilder.buildPromptPayload).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('returns failure when dispatcher throws', async () => {
    dispatcher.dispatch.mockRejectedValueOnce(new Error('boom'));

    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.CONVERSE }),
    );

    expect(result.success).toBe(false);
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });

  it('generates build output when orchestration fallback occurs', async () => {
    dispatcher.dispatch.mockResolvedValueOnce(
      createDispatchResult('Build output'),
    );

    // Simulate deliverable created
    deliverables.maybeCreateFromBuild.mockResolvedValueOnce({ kind: 'deliverable', deliverable: { id: 'd1' } });
    const result = await service.execute(
      buildContext(
        {
          mode: AgentTaskMode.BUILD,
          userMessage: 'Create launch plan',
          payload: { options: { stream: false } },
        },
        routingDecision,
      ),
    );

    expect(promptBuilder.buildPromptPayload).toHaveBeenCalledWith({
      definition,
      request: expect.objectContaining({ mode: AgentTaskMode.BUILD }),
      mode: 'build',
    });
    expect(dispatcher.dispatch).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.payload?.content?.status).toBe('build_completed');
    expect(result.payload?.content?.output).toBe('Build output');
    expect(result.payload?.deliverables?.[0]?.id).toBe('d1');
  });

  it('attaches version metadata when enhancement path returns version', async () => {
    deliverables.maybeCreateFromBuild.mockResolvedValueOnce({ kind: 'version', deliverableId: 'deliv-1', version: { id: 'v2' } });
    const result = await service.execute(
      buildContext(
        {
          mode: AgentTaskMode.BUILD,
          userMessage: 'Enhance',
          payload: { options: { stream: false } },
        },
        routingDecision,
      ),
    );
    expect(result.payload?.metadata?.deliverableId).toBe('deliv-1');
    expect(result.payload?.metadata?.newVersionId).toBe('v2');
  });

  it('returns failure when dispatcher returns error metadata for converse', async () => {
    // Make dispatcher return error status
    dispatcher.dispatch.mockResolvedValueOnce({
      response: {
        content: 'error text',
        metadata: {
          provider: 'external_api',
          model: 'api_endpoint',
          requestId: 'req-err',
          timestamp: new Date().toISOString(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          timing: { startTime: Date.now(), endTime: Date.now(), duration: 1 },
          status: 'error',
          errorMessage: 'External service error (status 500)'
        }
      }
    } as any);

    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.CONVERSE, userMessage: 'Hello' }),
    );

    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toMatch(/External service error/i);
  });

  it('returns failure when dispatcher returns error metadata for build', async () => {
    dispatcher.dispatch.mockResolvedValueOnce({
      response: {
        content: 'error text',
        metadata: {
          provider: 'external_api',
          model: 'api_endpoint',
          requestId: 'req-err',
          timestamp: new Date().toISOString(),
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          timing: { startTime: Date.now(), endTime: Date.now(), duration: 1 },
          status: 'error',
          errorMessage: 'External service error (status 502)'
        }
      }
    } as any);

    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.BUILD, userMessage: 'Do it' }),
    );

    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toMatch(/External service error/i);
  });

  it('merges top-level metadata into prompt payload', async () => {
    await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hello',
        metadata: { userId: 'top-user', requestId: 'top-req' },
        payload: {
          metadata: { userId: 'payload-user' },
        },
      }),
    );

    const [call] = promptBuilder.buildPromptPayload.mock.calls;
    expect(call?.[0]?.request?.metadata).toEqual(
      expect.objectContaining({ userId: 'top-user', requestId: 'top-req' }),
    );
  });

  it('passes session id through to dispatcher prompt payload', async () => {
    await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        sessionId: 'session-123',
        userMessage: 'Hi',
      }),
    );

    const [dispatchCall] = dispatcher.dispatch.mock.calls;
    expect(dispatchCall?.[0]?.prompt.sessionId).toBe('session-123');
    expect(dispatcher.dispatchStream).not.toHaveBeenCalled();
  });

  it('returns failure if build lacks routing metadata', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.BUILD }, null as any),
    );

    expect(result.success).toBe(false);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(dispatcher.dispatchStream).not.toHaveBeenCalled();
  });

  it('returns failure for plan mode (handled by gateway)', async () => {
    const result = await service.execute(buildContext({ mode: AgentTaskMode.PLAN }));
    expect(result.success).toBe(false);
    expect(result.mode).toBe(AgentTaskMode.PLAN);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(dispatcher.dispatchStream).not.toHaveBeenCalled();
  });

  it('handles human response mode without dispatcher call', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.HUMAN_RESPONSE }),
    );
    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('resolves agent via registry when not provided', async () => {
    agentRegistry.getAgent.mockResolvedValue(baseAgent);

    const result = await service.execute({
      organizationSlug: 'acme',
      agentSlug: 'agent-1',
      request: {
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Ping',
        payload: {},
      } as TaskRequestDto,
      routingMetadata: routingDecision,
    });

    expect(agentRegistry.getAgent).toHaveBeenCalledWith('acme', 'agent-1');
    expect(dispatcher.dispatch).toHaveBeenCalled();
    expect(dispatcher.dispatchStream).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('fails when agent cannot be resolved', async () => {
    agentRegistry.getAgent.mockResolvedValue(null as any);

    const result = await service.execute({
      organizationSlug: 'acme',
      agentSlug: 'missing-agent',
      request: {
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Ping',
        payload: {},
      } as TaskRequestDto,
      routingMetadata: routingDecision,
    });

    expect(agentRegistry.getAgent).toHaveBeenCalledWith('acme', 'missing-agent');
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(dispatcher.dispatchStream).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it('reuses provided runtime definition without rebuilding', async () => {
    runtimeDefinitions.buildDefinition.mockClear();

    await service.execute({
      agent: baseAgent,
      definition: { ...definition },
      request: {
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hello',
      } as TaskRequestDto,
      routingMetadata: routingDecision,
    });

    expect(runtimeDefinitions.buildDefinition).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).toHaveBeenCalled();
    expect(dispatcher.dispatchStream).not.toHaveBeenCalled();
  });

  it('streams when request payload requests streaming', async () => {
    const result = await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        payload: { options: { stream: true } },
      }),
    );

    expect(streamService.start).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        agentSlug: baseAgent.slug,
        mode: AgentTaskMode.CONVERSE,
      }),
    );
    expect(dispatcher.dispatchStream).toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    const sessionCall = streamService.start.mock.results[0];
    if (!sessionCall) {
      throw new Error('streamService.start was not invoked');
    }
    const session = sessionCall.value as any;
    expect(session.publishChunk).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'partial', content: 'chunk' }),
    );
    expect(session.complete).toHaveBeenCalled();
    expect(result.payload?.metadata?.metadata?.streamId).toBe('stream-1');
  });

  it('propagates streaming errors and invokes session.error', async () => {
    const streamingError = new Error('stream failure');
    dispatcher.dispatchStream.mockImplementationOnce(() => ({
      response: Promise.reject(streamingError),
      stream: (async function* () {})(),
      cancel: jest.fn(),
    }));

    const result = await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        payload: { options: { stream: true } },
      }),
    );

    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toBe('Failed to generate response');
    expect(dispatcher.dispatchStream).toHaveBeenCalled();
    const session = streamService.start.mock.results.at(-1)?.value as any;
    expect(session?.error).toHaveBeenCalledWith(streamingError);
    expect(session?.complete).not.toHaveBeenCalled();
  });
});
