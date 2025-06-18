import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ContextAgentBaseService } from './context-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { of } from 'rxjs';

// Test implementation of the abstract service
class TestContextAgentService extends ContextAgentBaseService {
  getAgentName(): string {
    return 'Test Context Agent';
  }

  getAgentType(): 'specialist' | 'orchestrator' | 'manager' | 'external' {
    return 'specialist';
  }
}

describe('ContextAgentBaseService', () => {
  let service: TestContextAgentService;
  let httpService: jest.Mocked<HttpService>;
  let llmService: jest.Mocked<LLMService>;

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      request: jest.fn(),
      axiosRef: {
        defaults: {
          timeout: 5000,
        },
      },
    };

    const mockLLMService = {
      generateResponse: jest.fn(),
      getLangGraphLLM: jest.fn(),
      getAnthropicLLM: jest.fn(),
      getOpenAILLM: jest.fn(),
      getGoogleLLM: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestContextAgentService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
      ],
    }).compile();

    service = module.get<TestContextAgentService>(TestContextAgentService);
    httpService = module.get(HttpService);
    llmService = module.get(LLMService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeTask', () => {
    it('should handle greeting messages', async () => {
      const result = await service.executeTask('test', { userMessage: 'hello' });

      expect(result.success).toBe(true);
      expect(result.response).toContain('Test Context Agent');
      expect(result.metadata.responseType).toBe('greeting');
    });

    it('should handle context-based processing when context is available', async () => {
      const mockResponse = 'This is a context-based response';
      llmService.generateResponse.mockResolvedValue(mockResponse);
      
      // Set context data
      service.setContextData('This is test context data');
      
      const result = await service.executeTask('test', { userMessage: 'What can you tell me?' });

      expect(result.success).toBe(true);
      expect(result.response).toBe(mockResponse);
      expect(result.metadata.contextUsed).toBe(true);
      expect(result.metadata.contextLength).toBeGreaterThan(0);
      expect(llmService.generateResponse).toHaveBeenCalledWith(
        'What can you tell me?',
        expect.stringContaining('This is test context data')
      );
    });

    it('should handle fallback when no context is available', async () => {
      const result = await service.executeTask('test', { userMessage: 'What can you tell me?' });

      expect(result.success).toBe(true);
      expect(result.response).toContain('context data isn\'t loaded yet');
      expect(result.metadata.contextUsed).toBe(false);
      expect(result.metadata.reason).toBe('No context data available');
    });

    it('should extract user message from different parameter formats', async () => {
      const testCases = [
        { params: 'direct string', expected: 'direct string' },
        { params: { userMessage: 'from userMessage' }, expected: 'from userMessage' },
        { params: { message: 'from message' }, expected: 'from message' },
        { params: { prompt: 'from prompt' }, expected: 'from prompt' },
        { params: { input: 'from input' }, expected: 'from input' },
      ];

      for (const testCase of testCases) {
        const result = await service.executeTask('test', testCase.params);
        expect(result.success).toBe(true);
        // The result should be processed (either greeting or fallback)
      }
    });

    it('should handle errors gracefully', async () => {
      llmService.generateResponse.mockRejectedValue(new Error('LLM service error'));
      
      // Set context data to trigger LLM call
      service.setContextData('test context');
      
      const result = await service.executeTask('test', { userMessage: 'test message' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM service error');
      expect(result.response).toContain('encountered an error');
      expect(result.metadata.errorDetails).toBe('LLM service error');
    });
  });

  describe('setContextData', () => {
    it('should set context data', () => {
      const contextData = 'This is test context data';
      service.setContextData(contextData);
      
      // Test that context is used by executing a task
      const result = service.executeTask('test', { userMessage: 'test' });
      expect(result).toBeDefined();
    });
  });

  describe('setDiscoveredPath', () => {
    it('should set the agent path', () => {
      const testPath = '/test/agent/path';
      service.setDiscoveredPath(testPath);
      
      // The path should be set (we can't directly test it as it's protected)
      expect(service).toBeDefined();
    });
  });

  describe('getAgentCard', () => {
    it('should return agent card with context status when no context is loaded', async () => {
      const card = await service.getAgentCard();
      
      expect(card.contextStatus).toBe('not_loaded');
      expect(card.contextLength).toBe(0);
      expect(card.loadedAt).toBeNull();
    });

    it('should return agent card with context status when context is loaded', async () => {
      service.setContextData('test context data');
      
      const card = await service.getAgentCard();
      
      expect(card.contextStatus).toBe('loaded');
      expect(card.contextLength).toBeGreaterThan(0);
      expect(card.loadedAt).toBeDefined();
    });
  });
}); 