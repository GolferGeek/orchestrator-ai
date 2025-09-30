import { AgentRuntimeDispatchService } from './agent-runtime-dispatch.service';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { RoutingDecision } from '@llm/centralized-routing.service';
import { PromptPayload } from './agent-runtime-prompt.service';
import { TaskRequestDto } from '@agent2agent/dto/task-request.dto';

const definition: AgentRuntimeDefinition = {
  id: 'agent-1',
  slug: 'agent-1',
  organizationSlug: 'acme',
  displayName: 'Agent One',
  description: 'Helpful assistant',
  agentType: 'specialist',
  modeProfile: 'full_cycle',
  status: 'active',
  metadata: {
    name: 'Agent One',
    displayName: 'Agent One',
    description: 'Helpful assistant',
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
    executionProfile: undefined,
    timeoutSeconds: undefined,
  },
  transport: undefined,
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 4000,
    raw: undefined,
    systemPrompt: 'You are Agent One.',
  },
  prompts: {
    system: 'You are Agent One.',
    plan: undefined,
    build: undefined,
    human: undefined,
    additional: undefined,
  },
  context: {},
  config: {},
  agentCard: null,
  rawDescriptor: null,
  record: null as any,
};

const routingDecision: RoutingDecision = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  isLocal: false,
  fallbackUsed: false,
  complexityScore: 0.5,
  reasoningPath: ['select-openai'],
  piiMetadata: { policyDecision: { reasoningPath: [] } },
  routeToAgent: true,
  temperature: 0.2,
} as any;

const prompt: PromptPayload = {
  systemPrompt: 'You are Agent One.',
  userMessage: 'Hello there',
  metadata: {
    agentId: definition.id,
    maxComplexity: 'medium',
  },
  optionMetadata: {
    agentId: definition.id,
    agentSlug: definition.slug,
  },
  conversationId: 'conv-1',
  sessionId: 'session-1',
  userId: 'user-1',
};

const request: TaskRequestDto = {
  mode: 'converse' as any,
  conversationId: 'conv-1',
  sessionId: 'session-1',
  userMessage: 'Hello there',
  metadata: { traceId: 'trace-1' },
  payload: {
    options: {
      metadata: { userId: 'payload-user' },
      extraOption: 'value',
    },
  },
};

const response = {
  content: 'Hi!',
  metadata: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    requestId: 'req-1',
    timestamp: new Date().toISOString(),
    usage: {
      inputTokens: 5,
      outputTokens: 15,
      totalTokens: 20,
    },
    timing: {
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 5,
    },
    status: 'completed',
  },
};

describe('AgentRuntimeDispatchService', () => {
  let dispatcher: AgentRuntimeDispatchService;
  let llmFactory: jest.Mocked<LLMServiceFactory>;

  beforeEach(() => {
    llmFactory = {
      generateResponse: jest.fn().mockResolvedValue(response as any),
    } as unknown as jest.Mocked<LLMServiceFactory>;

    dispatcher = new AgentRuntimeDispatchService(llmFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches to LLM factory with merged metadata and options', async () => {
    const result = await dispatcher.dispatch({
      definition,
      routingDecision,
      prompt,
      request,
    });

    expect(llmFactory.generateResponse).toHaveBeenCalledTimes(1);
    const call = llmFactory.generateResponse.mock.calls[0];
    if (!call) {
      throw new Error('generateResponse not called');
    }
    const [config, params] = call;

    expect(config.provider).toBe('openai');
    expect(config.temperature).toBe(0.2);
    expect(params.userMessage).toBe('Hello there');
    expect(params.options?.metadata).toEqual({
      agentId: 'agent-1',
      agentSlug: 'agent-1',
    });
    expect(params.options?.extraOption).toBe('value');
    expect(params.options?.stream).toBe(false);
    expect(result.response).toBe(response as any);
  });

  it('applies overrides and emits final stream chunk when handler provided', async () => {
    const handler = jest.fn();

    await dispatcher.dispatch({
      definition,
      routingDecision,
      prompt,
      request,
      stream: true,
      onStreamChunk: handler,
      overrides: {
        config: { temperature: 0.6 },
        options: { stream: true },
      },
    });

    const call = llmFactory.generateResponse.mock.calls[0];
    if (!call) {
      throw new Error('generateResponse not called');
    }
    const [config, params] = call;
    expect(config.temperature).toBe(0.6);
    expect(params.options?.stream).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'final', content: 'Hi!' }),
    );
  });
});
