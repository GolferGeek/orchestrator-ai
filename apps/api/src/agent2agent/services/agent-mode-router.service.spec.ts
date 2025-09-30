import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { LLMResponse } from '@llm/services/llm-interfaces';
import { AgentExecutionContext } from './agent-mode-router.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';

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

const createResponse = (content: string): LLMResponse => ({
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
});

describe('AgentModeRouterService', () => {
  let llmFactory: jest.Mocked<LLMServiceFactory>;
  let agentRegistry: jest.Mocked<AgentRegistryService>;
  let service: AgentModeRouterService;

  beforeEach(() => {
    agentRegistry = {
      getAgent: jest.fn(),
      listAgents: jest.fn(),
      invalidate: jest.fn(),
      clearAll: jest.fn(),
    } as unknown as jest.Mocked<AgentRegistryService>;
    llmFactory = {
      generateResponse: jest.fn(),
    } as unknown as jest.Mocked<LLMServiceFactory>;
    service = new AgentModeRouterService(agentRegistry, llmFactory);
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
    llmFactory.generateResponse.mockResolvedValue(
      createResponse('Hello there!'),
    );

    const result = await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hi agent',
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'Answer' },
          { role: 'user', content: 'Follow-up' },
        ],
      }),
    );

    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
    expect(llmFactory.generateResponse).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.payload?.content?.message).toBe('Hello there!');
    const [, params] = llmFactory.generateResponse.mock.calls[0] ?? [];
    expect(params).toBeDefined();
    if (!params) {
      throw new Error('LLM params not provided');
    }
    expect(params.conversationId).toBe('conv-1');
    expect(params.sessionId).toBeUndefined();
    expect(params.options?.metadata).toEqual({});
    expect(params.userMessage).toContain('Recent conversation history');
  });

  it('fails when routing metadata missing for converse', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.CONVERSE }, null as any),
    );

    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toMatch(/Routing decision/);
  });

  it('returns failure when LLM generation throws', async () => {
    llmFactory.generateResponse.mockRejectedValue(new Error('boom'));

    const result = await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hi agent',
      }),
    );

    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toBe(
      'Failed to generate response',
    );
    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
  });

  it('generates build output when orchestration fallback occurs', async () => {
    llmFactory.generateResponse.mockResolvedValue(
      createResponse('Build output'),
    );

    const result = await service.execute(
      buildContext(
        {
          mode: AgentTaskMode.BUILD,
          userMessage: 'Create launch plan',
          payload: { instructions: ['Do X'], metadata: { userId: 'user-1' } },
        },
        routingDecision,
      ),
    );

    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
    expect(llmFactory.generateResponse).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.payload?.content?.status).toBe('build_completed');
    expect(result.payload?.content?.output).toBe('Build output');
    const [, params] = llmFactory.generateResponse.mock.calls[0] ?? [];
    expect(params?.options?.metadata).toMatchObject({ userId: 'user-1' });
  });

  it('merges top-level metadata into LLM call', async () => {
    llmFactory.generateResponse.mockResolvedValue(createResponse('ok'));

    await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hello',
        metadata: { userId: 'top-user', requestId: 'top-req' },
        payload: {
          metadata: { userId: 'payload-user', providerName: 'provider-x' },
        },
      }),
    );

    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
    const [, params] = llmFactory.generateResponse.mock.calls[0] ?? [];
    expect(params?.options?.metadata).toMatchObject({
      userId: 'top-user',
      requestId: 'top-req',
      providerName: 'provider-x',
    });
  });

  it('passes session id through to LLM params when provided', async () => {
    llmFactory.generateResponse.mockResolvedValue(createResponse('ok'));

    await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        sessionId: 'session-123',
        userMessage: 'Hi',
      }),
    );

    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
    const [, params] = llmFactory.generateResponse.mock.calls[0] ?? [];
    expect(params?.sessionId).toBe('session-123');
  });

  it('returns failure if build lacks routing metadata', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.BUILD }, null as any),
    );

    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toMatch(/Routing decision/);
  });

  it('handles plan mode without LLM call', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.PLAN }),
    );
    expect(result.mode).toBe(AgentTaskMode.PLAN);
    expect(llmFactory.generateResponse).not.toHaveBeenCalled();
    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
  });

  it('handles human response mode without LLM call', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.HUMAN_RESPONSE }),
    );
    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(llmFactory.generateResponse).not.toHaveBeenCalled();
    expect(agentRegistry.getAgent).not.toHaveBeenCalled();
  });

  it('resolves agent via registry when not provided', async () => {
    agentRegistry.getAgent.mockResolvedValue(baseAgent);
    llmFactory.generateResponse.mockResolvedValue(createResponse('hello'));

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

    expect(agentRegistry.getAgent).toHaveBeenCalledWith(
      'acme',
      'missing-agent',
    );
    expect(result.success).toBe(false);
    expect(result.payload?.metadata?.reason).toBe(
      'Agent record unavailable for execution',
    );
  });
});
