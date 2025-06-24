import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';

describe('LLMService', () => {
  let service: LLMService;

  beforeEach(async () => {
    // Set test environment variables
    process.env.OPENAI_API_KEY =
      process.env.OPENAI_API_KEY || 'test-openai-key';
    process.env.ANTHROPIC_API_KEY =
      process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';
    process.env.GOOGLE_API_KEY =
      process.env.GOOGLE_API_KEY || 'test-google-key';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../../.env.local', '../../../.env'],
          expandVariables: true,
        }),
      ],
      providers: [LLMService],
    }).compile();

    service = module.get<LLMService>(LLMService);
  });

  afterEach(() => {
    // Clean up test environment variables if they were set by the test
    if (process.env.OPENAI_API_KEY === 'test-openai-key') {
      delete process.env.OPENAI_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY === 'test-anthropic-key') {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.GOOGLE_API_KEY === 'test-google-key') {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('LangGraph LLM Creation', () => {
    it('should create OpenAI LLM instance', () => {
      const llm = service.getLangGraphLLM('openai');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create Anthropic LLM instance', () => {
      const llm = service.getLangGraphLLM('anthropic');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create Ollama LLM instance', () => {
      const llm = service.getLangGraphLLM('ollama');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create Google LLM instance', () => {
      const llm = service.getLangGraphLLM('google');
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should fall back to OpenAI for unknown providers', () => {
      const llm = service.getLangGraphLLM('unknown' as any);
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });
  });

  describe('Custom LangGraph LLM Creation', () => {
    it('should create custom OpenAI LLM with configuration', () => {
      const config = {
        provider: 'openai' as const,
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 1000,
      };

      const llm = service.createCustomLangGraphLLM(config);
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should create custom Anthropic LLM with configuration', () => {
      const config = {
        provider: 'anthropic' as const,
        model: 'claude-3-opus-20240229',
        temperature: 0.3,
        maxTokens: 2000,
      };

      const llm = service.createCustomLangGraphLLM(config);
      expect(llm).toBeDefined();
      expect(typeof llm.invoke).toBe('function');
    });

    it('should throw error for unsupported provider', () => {
      const config = {
        provider: 'unsupported' as any,
      };

      expect(() => service.createCustomLangGraphLLM(config)).toThrow(
        'Unsupported provider: unsupported',
      );
    });
  });

  describe('Orchestration Decision Making', () => {
    it('should have orchestration decision method available', () => {
      expect(service.generateOrchestrationDecision).toBeDefined();
      expect(typeof service.generateOrchestrationDecision).toBe('function');
    });
  });
});
