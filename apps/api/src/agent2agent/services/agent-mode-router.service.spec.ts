import { AgentModeRouterService } from './agent-mode-router.service';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { LLMResponse } from '@llm/services/llm-interfaces';
import { AgentExecutionContext } from './agent-mode-router.service';
import { AgentRecord } from '@agent-platform/interfaces/agent-record.interface';

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
  let service: AgentModeRouterService;

  beforeEach(() => {
    llmFactory = {
      generateResponse: jest.fn(),
    } as unknown as jest.Mocked<LLMServiceFactory>;
    service = new AgentModeRouterService(llmFactory);
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
    llmFactory.generateResponse.mockResolvedValue(createResponse('Hello there!'));

    const result = await service.execute(
      buildContext({
        mode: AgentTaskMode.CONVERSE,
        userMessage: 'Hi agent',
      }),
    );

    expect(llmFactory.generateResponse).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.payload?.content?.message).toBe('Hello there!');
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
    expect(result.payload?.metadata?.reason).toBe('Failed to generate response');
  });

  it('generates build output when orchestration fallback occurs', async () => {
    llmFactory.generateResponse.mockResolvedValue(createResponse('Build output'));

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

    expect(llmFactory.generateResponse).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.payload?.content?.status).toBe('build_completed');
    expect(result.payload?.content?.output).toBe('Build output');
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
  });

  it('handles human response mode without LLM call', async () => {
    const result = await service.execute(
      buildContext({ mode: AgentTaskMode.HUMAN_RESPONSE }),
    );
    expect(result.mode).toBe(AgentTaskMode.HUMAN_RESPONSE);
    expect(llmFactory.generateResponse).not.toHaveBeenCalled();
  });
});
