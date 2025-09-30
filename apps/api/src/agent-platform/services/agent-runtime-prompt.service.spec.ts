import { AgentRuntimePromptService } from './agent-runtime-prompt.service';
import { AgentRuntimeDefinition } from '../interfaces/database-agent-definition.interface';
import { TaskRequestDto } from '@agent2agent/dto/task-request.dto';

const baseDefinition: AgentRuntimeDefinition = {
  id: 'agent-1',
  slug: 'agent-1',
  organizationSlug: 'acme',
  displayName: 'Agent One',
  description: 'Helpful assistant.',
  agentType: 'specialist',
  modeProfile: 'full_cycle',
  status: 'active',
  metadata: {
    name: 'Agent One',
    displayName: 'Agent One',
    description: 'Helpful assistant.',
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
  context: { system_prompt: 'You are Agent One.' },
  config: { prompt_prefix: 'Always greet the user politely.' },
  agentCard: null,
  rawDescriptor: null,
  record: null as any,
};

describe('AgentRuntimePromptService', () => {
  let service: AgentRuntimePromptService;

  beforeEach(() => {
    service = new AgentRuntimePromptService();
  });

  const buildRequest = (overrides: Partial<TaskRequestDto> = {}): TaskRequestDto => ({
    mode: overrides.mode ?? ('converse' as any),
    conversationId: 'conv-1',
    userMessage: 'Explain the rollout plan.',
    metadata: { userId: 'user-1', requestId: 'req-123' },
    messages: [
      { role: 'user', content: 'Hi there' },
      { role: 'assistant', content: 'Hello' },
    ],
    payload: {
      metadata: { sessionType: 'demo' },
      prompt: 'Focus on safety impacts.',
      requirements: ['Meet compliance', 'Notify stakeholders'],
      options: { metadata: { caller: 'ui' } },
    },
    ...overrides,
  });

  it('builds system prompt from definition metadata', () => {
    const prompt = service.buildSystemPrompt(baseDefinition, 'converse');
    expect(prompt).toContain('Agent One');
  });

  it('falls back to default prompt when none configured', () => {
    const definition = {
      ...baseDefinition,
      prompts: {},
      context: {},
      config: {},
      description: undefined,
    } as AgentRuntimeDefinition;

    const prompt = service.buildSystemPrompt(definition, 'build');
    expect(prompt).toContain('Produce actionable deliverables');
  });

  it('includes conversation history, user message, prompt, and requirements', () => {
    const request = buildRequest();
    const message = service.buildUserMessage(baseDefinition, request, 'converse');

    expect(message).toContain('Recent conversation history');
    expect(message).toContain('Explain the rollout plan.');
    expect(message).toContain('Focus on safety impacts.');
    expect(message).toContain('Requirements:');
  });

  it('includes instructions when in build mode', () => {
    const request = buildRequest({
      payload: {
        metadata: {},
        instructions: ['Gather requirements', 'Draft plan'],
        requirements: [],
        options: {},
      },
    });

    const message = service.buildUserMessage(baseDefinition, request, 'build');
    expect(message).toContain('Instructions:');
  });

  it('collects metadata merging base, payload, top-level, and additional entries', () => {
    const metadata = service.collectMetadata(baseDefinition, buildRequest(), {
      requestId: 'override-req',
      correlationId: 'corr-5',
    });

    expect(metadata).toMatchObject({
      agentId: baseDefinition.id,
      agentSlug: baseDefinition.slug,
      organizationSlug: baseDefinition.organizationSlug,
      userId: 'user-1',
      sessionType: 'demo',
      requestId: 'override-req',
      correlationId: 'corr-5',
    });
  });

  it('builds full prompt payload with merged metadata', () => {
    const payload = service.buildPromptPayload({
      definition: baseDefinition,
      request: buildRequest(),
      mode: 'converse',
    });

    expect(payload.systemPrompt).toContain('Agent One');
    expect(payload.userMessage).toContain('Explain the rollout plan.');
    expect(payload.metadata.userId).toBe('user-1');
    expect(payload.optionMetadata).toMatchObject({
      caller: 'ui',
      userId: 'user-1',
    });
    expect(payload.conversationId).toBe('conv-1');
    expect(payload.userId).toBe('user-1');
  });

  it('derives user id from payload when not present in metadata', () => {
    const request = buildRequest({
      metadata: {},
      payload: {
        metadata: {},
        userId: 'payload-user',
        options: {},
      },
    });

    const payload = service.buildPromptPayload({
      definition: baseDefinition,
      request,
    });

    expect(payload.userId).toBe('payload-user');
  });

  it('maps complexity scores to labels', () => {
    expect(service.mapComplexity(undefined)).toBeUndefined();
    expect(service.mapComplexity(0.1)).toBe('simple');
    expect(service.mapComplexity(0.5)).toBe('medium');
    expect(service.mapComplexity(0.8)).toBe('complex');
  });
});
