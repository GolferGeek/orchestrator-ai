import { AgentRuntimeDispatchService } from './agent-runtime-dispatch.service';
import { LLMServiceFactory } from '@llm/services/llm-service-factory';
import { HttpService } from '@nestjs/axios';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { AgentTaskMode, TaskRequestDto } from '@agent2agent/dto/task-request.dto';

describe('AgentRuntimeDispatchService - metrics integration', () => {
  const baseDefinition = (transport: any): AgentRuntimeDefinition => ({
    id: 'id-1',
    slug: 'demo-agent',
    organizationSlug: null,
    displayName: 'Demo Agent',
    description: null,
    agentType: 'api',
    modeProfile: 'conversation_only',
    status: 'active',
    metadata: { name: 'Demo Agent', tags: [] },
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
    transport,
    prompts: {},
    context: null,
    config: null,
    agentCard: null,
    rawDescriptor: null,
    record: {} as any,
  });

  const baseRequest = (overrides: Partial<TaskRequestDto> = {}): TaskRequestDto => ({
    mode: AgentTaskMode.CONVERSE,
    userMessage: 'hi',
    payload: {},
    ...overrides,
  } as any);

  const basePrompt = {
    systemPrompt: 'system',
    userMessage: 'hi',
    metadata: {},
    optionMetadata: {},
    conversationId: 'c1',
    sessionId: 's1',
    userId: null,
  };

  const routing = { provider: 'dummy', model: 'dummy', isLocal: false } as any;

  it('records success=false for API 500 responses', async () => {
    const axios = {
      request: jest.fn(async () => ({ status: 500, headers: {}, data: { error: 'bad' } })),
    };
    const llmFactory = {} as unknown as LLMServiceFactory;
    const http = { axiosRef: axios } as unknown as HttpService;
    const metrics = { record: jest.fn(), snapshot: jest.fn() } as any;
    const svc = new AgentRuntimeDispatchService(llmFactory, http, metrics);

    const definition = baseDefinition({ kind: 'api', api: { endpoint: 'https://example.test', method: 'POST' } });
    await svc.dispatch({ definition, routingDecision: routing, prompt: basePrompt, request: baseRequest() });

    expect(metrics.record).toHaveBeenCalled();
    const calls = metrics.record.mock.calls.filter((c: any[]) => c[0] === 'api');
    expect(calls.length).toBeGreaterThan(0);
    const last = calls.at(-1);
    expect(last?.[2]).toBe(false); // success=false
  });

  it('records success=true for External 200 responses', async () => {
    const axios = {
      post: jest.fn(async () => ({ status: 200, headers: {}, data: { jsonrpc: '2.0', id: 1, result: { response: 'ok' } } })),
    };
    (axios as any).request = axios.post;
    const llmFactory = {} as unknown as LLMServiceFactory;
    const http = { axiosRef: axios } as unknown as HttpService;
    const metrics = { record: jest.fn(), snapshot: jest.fn() } as any;
    const svc = new AgentRuntimeDispatchService(llmFactory, http, metrics);

    const definition = baseDefinition({ kind: 'external', external: { endpoint: 'https://api.ext/jsonrpc' } });
    await svc.dispatch({ definition, routingDecision: routing, prompt: basePrompt, request: baseRequest() });

    const calls = metrics.record.mock.calls.filter((c: any[]) => c[0] === 'external');
    expect(calls.length).toBeGreaterThan(0);
    const last = calls.at(-1);
    expect(last?.[2]).toBe(true); // success=true
  });
});

