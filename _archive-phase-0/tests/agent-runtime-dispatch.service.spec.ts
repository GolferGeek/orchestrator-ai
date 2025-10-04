import { AgentRuntimeDispatchService } from './agent-runtime-dispatch.service';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { HttpService } from '@nestjs/axios';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { AgentTaskMode, TaskRequestDto } from '@agent2agent/dto/task-request.dto';

describe('AgentRuntimeDispatchService (API/external minimal)', () => {
  const makeService = (axiosImpl: any) => {
    const llmFactory = {
      generateResponse: jest.fn(),
    } as unknown as LLMServiceFactory;
    const http = { axiosRef: axiosImpl } as unknown as HttpService;
    const metrics = { record: jest.fn(), snapshot: jest.fn() } as any;
    return new AgentRuntimeDispatchService(llmFactory, http, metrics);
  };

  const baseDefinition = (api: any): AgentRuntimeDefinition => ({
    id: 'agent-id',
    slug: 'jokes_agent',
    organizationSlug: null,
    displayName: 'Jokes Agent',
    description: 'Demo jokes agent',
    agentType: 'api',
    modeProfile: 'conversation_only',
    status: 'active',
    metadata: { name: 'Jokes Agent', tags: [] },
    communication: { inputModes: ['text/plain'], outputModes: ['text/plain'] },
    capabilities: [],
    skills: [],
    execution: {
      modeProfile: 'conversation_only',
      canConverse: true,
      canPlan: false,
      canBuild: false,
      requiresHumanGate: false,
    },
    transport: { kind: 'api', api },
    prompts: {},
    context: null,
    config: null,
    agentCard: null,
    rawDescriptor: null,
    record: {} as any,
  });

  const baseRequest = (overrides: Partial<TaskRequestDto> = {}): TaskRequestDto => ({
    mode: AgentTaskMode.CONVERSE,
    userMessage: 'Tell me a joke',
    payload: {},
    ...overrides,
  } as any);

  const baseRouting = { provider: 'dummy', model: 'dummy', isLocal: false } as any;

  it('sends minimal {prompt} body when no transform is configured', async () => {
    const called: any[] = [];
    const axios = {
      request: jest.fn(async (args: any) => {
        called.push(args);
        return { status: 200, headers: {}, data: { output: 'here' } };
      }),
    };
    const service = makeService(axios);

    const definition = baseDefinition({
      endpoint: 'https://example.test/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1000,
    });

    const prompt = {
      systemPrompt: 'You are jokes agent',
      userMessage: 'Tell me a joke',
      metadata: {},
      optionMetadata: {},
      conversationId: undefined,
      sessionId: undefined,
      userId: null,
    };

    const result = await service.dispatch({
      definition,
      routingDecision: baseRouting,
      prompt,
      request: baseRequest(),
    });

    expect(axios.request).toHaveBeenCalledTimes(1);
    const sent = called[0];
    expect(sent.data).toEqual({ prompt: 'Tell me a joke' });
    expect(result.response.content).toBe(JSON.stringify({ output: 'here' }));
  });

  it('renders request template and extracts response field when configured', async () => {
    const called: any[] = [];
    const axios = {
      request: jest.fn(async (args: any) => {
        called.push(args);
        return { status: 200, headers: {}, data: { output: 'A funny line' } };
      }),
    };
    const service = makeService(axios);

    const definition = baseDefinition({
      endpoint: 'https://example.test/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1000,
      requestTransform: {
        format: 'custom',
        template: '{"sessionId": "{{sessionId}}", "prompt": "{{userMessage}}"}',
      },
      responseTransform: {
        format: 'field_extraction',
        field: 'output',
      },
    });

    const prompt = {
      systemPrompt: 'You are jokes agent',
      userMessage: 'Tell me a joke',
      metadata: {},
      optionMetadata: {},
      conversationId: 'conv-1',
      sessionId: 'sess-1',
      userId: null,
    };

    const result = await service.dispatch({
      definition,
      routingDecision: baseRouting,
      prompt,
      request: baseRequest({ conversationId: 'conv-1', sessionId: 'sess-1' }),
    });

    const sent = called[0];
    expect(sent.data).toEqual({ sessionId: 'sess-1', prompt: 'Tell me a joke' });
    expect(result.response.content).toBe('A funny line');
  });

  it('supports dotted field extraction from nested payload', async () => {
    const called: any[] = [];
    const axios = {
      request: jest.fn(async (args: any) => {
        called.push(args);
        return { status: 200, headers: {}, data: { result: { data: { output: 'Nested OK' } } } };
      }),
    };
    const service = makeService(axios);

    const definition = baseDefinition({
      endpoint: 'https://example.test/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1000,
      responseTransform: {
        format: 'field_extraction',
        field: 'data.output',
      },
    });

    const prompt = {
      systemPrompt: 'system',
      userMessage: 'go',
      metadata: {},
      optionMetadata: {},
    };

    const result = await service.dispatch({
      definition,
      routingDecision: baseRouting,
      prompt,
      request: baseRequest(),
    });

    expect(result.response.content).toBe('Nested OK');
  });

  it('forwards JSON-RPC to external agents and unwraps result', async () => {
    const called: any[] = [];
    const axios = {
      post: jest.fn(async (url: string, body: any) => {
        called.push({ url, body });
        return { status: 200, headers: {}, data: { jsonrpc: '2.0', id: 1, result: { response: 'Hi from external' } } };
      }),
    };
    // Provide both request() and post() since external path uses post()
    (axios as any).request = axios.post;

    const service = makeService(axios);

    const definition: AgentRuntimeDefinition = {
      ...baseDefinition({}),
      transport: {
        kind: 'external',
        external: { endpoint: 'https://external.agent/jsonrpc', timeout: 2000 },
      },
    } as AgentRuntimeDefinition;

    const prompt = {
      systemPrompt: 'You are external wrapper',
      userMessage: 'hello',
      metadata: {},
      optionMetadata: {},
      conversationId: 'conv-x',
      sessionId: 'sess-x',
      userId: null,
    };

    const result = await service.dispatch({
      definition,
      routingDecision: baseRouting,
      prompt,
      request: baseRequest({ conversationId: 'conv-x', sessionId: 'sess-x' }),
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    const sent = called[0];
    expect(sent.url).toBe('https://external.agent/jsonrpc');
    expect(sent.body.jsonrpc).toBe('2.0');
    expect(sent.body.method).toBe('converse');
    expect(result.response.content).toBe('Hi from external');
  });
});
