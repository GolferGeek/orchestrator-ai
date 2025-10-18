import { Test } from '@nestjs/testing';
import { AgentBuilderService } from './agent-builder.service';
import { AgentValidationService } from './agent-validation.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentDryRunService } from './agent-dry-run.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { LLMService } from '@/llms/llm.service';

describe('AgentBuilderService - Code Generation', () => {
  let service: AgentBuilderService;
  let llmService: LLMService;

  beforeEach(async () => {
    // Mock LLM service
    const mockLLMService = {
      generateResponse: jest.fn()
        .mockResolvedValue(`async function handler(input, ctx) {
  if (!input || !input.text) {
    throw new Error('Missing required input.text');
  }

  const wordCount = input.text.split(/\\s+/).length;

  return {
    count: wordCount,
    text: \`Word count: \${wordCount}\`
  };
}`),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentBuilderService,
        { provide: AgentValidationService, useValue: {} },
        { provide: AgentPolicyService, useValue: {} },
        { provide: AgentDryRunService, useValue: {} },
        { provide: AgentsRepository, useValue: {} },
        { provide: LLMService, useValue: mockLLMService },
      ],
    }).compile();

    service = moduleRef.get<AgentBuilderService>(AgentBuilderService);
    llmService = moduleRef.get<LLMService>(LLMService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate function code from description', async () => {
    const result = await service.generateFunctionCode(
      'Count the words in the input text and return the count',
      ['text/plain'],
      ['application/json'],
    );

    expect(result.code).toBeDefined();
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
    expect(result.code).toContain('async function handler');
    expect(result.code).toContain('input');
    expect(result.code).toContain('ctx');
  });

  it('should call LLM service with correct parameters', async () => {
    await service.generateFunctionCode(
      'Process the input and return a greeting',
      ['text/plain'],
      ['text/markdown'],
    );

    const generateResponseMock = llmService['generateResponse'] as jest.Mock;
    expect(generateResponseMock).toHaveBeenCalledWith(
      expect.stringContaining('JavaScript code generator'),
      expect.stringContaining('Process the input and return a greeting'),
      expect.objectContaining({
        providerName: 'openai',
        modelName: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2000,
        callerType: 'service',
        callerName: 'agent-builder-code-gen',
      }),
    );
  });

  it('should remove markdown code fences from generated code', async () => {
    // Mock response with code fences
    (llmService.generateResponse as jest.Mock)
      .mockResolvedValueOnce(`\`\`\`javascript
async function handler(input, ctx) {
  return { ok: true };
}
\`\`\``);

    const result = await service.generateFunctionCode(
      'Simple handler',
      ['text/plain'],
      ['application/json'],
    );

    expect(result.code).not.toContain('```');
    expect(result.code).toContain('async function handler');
  });

  it('should handle LLM service errors gracefully', async () => {
    (llmService.generateResponse as jest.Mock).mockRejectedValueOnce(
      new Error('LLM service unavailable'),
    );

    const result = await service.generateFunctionCode(
      'Generate something',
      ['text/plain'],
      ['application/json'],
    );

    expect(result.code).toBe('');
    expect(result.error).toBe('LLM service unavailable');
  });

  it('should include input/output modes in the prompt', async () => {
    await service.generateFunctionCode(
      'Transform data',
      ['application/json', 'text/plain'],
      ['text/markdown'],
    );

    const mockCalls = (llmService.generateResponse as jest.Mock).mock.calls;
    const systemPromptCall = (mockCalls[0] as unknown[])[0] as string;
    expect(systemPromptCall).toContain('application/json, text/plain');
    expect(systemPromptCall).toContain('text/markdown');
  });

  it('should mention ctx helpers in system prompt', async () => {
    await service.generateFunctionCode(
      'Generate an image',
      ['text/plain'],
      ['application/json'],
    );

    const mockCalls = (llmService.generateResponse as jest.Mock).mock.calls;
    const systemPromptCall = (mockCalls[0] as unknown[])[0] as string;
    expect(systemPromptCall).toContain("ctx.require('axios')");
    expect(systemPromptCall).toContain('ctx.deliverables.create');
  });
});
