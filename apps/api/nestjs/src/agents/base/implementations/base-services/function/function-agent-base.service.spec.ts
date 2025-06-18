import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FunctionAgentBaseService } from './function-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import { AgentFunctionParams } from '../a2a-base/interfaces';

describe('FunctionAgentBaseService', () => {
  let service: FunctionAgentBaseService;
  let llmService: jest.Mocked<LLMService>;

  beforeEach(async () => {
    const mockLLMService = {
      generateResponse: jest.fn().mockResolvedValue('Mock LLM response'),
      generateResponseWithHistory: jest.fn().mockResolvedValue('Mock LLM response with history'),
      getLangGraphLLM: jest.fn(),
    };

    const mockHttpService = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    const mockContextService = {
      loadAgentContext: jest.fn().mockResolvedValue('Mock context'),
      getContextData: jest.fn().mockReturnValue('Mock context data'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FunctionAgentBaseService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: AgentContextService,
          useValue: mockContextService,
        },
      ],
    }).compile();

    service = module.get<FunctionAgentBaseService>(FunctionAgentBaseService);
    llmService = module.get<LLMService>(LLMService) as jest.Mocked<LLMService>;

    // Mock the required methods
    jest.spyOn(service as any, 'getAgentName').mockReturnValue('test-agent');
    jest.spyOn(service as any, 'getAgentType').mockReturnValue('function');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setAgentFunction', () => {
    it('should set the agent function successfully', () => {
      // Arrange
      const mockFunction = jest.fn().mockResolvedValue({ response: 'test response' });

      // Act
      service.setAgentFunction(mockFunction);

      // Assert - We can't directly test the private property, but executeTask will verify it worked
      expect(service).toBeDefined();
    });
  });

  describe('executeTask with pre-loaded function', () => {
    it('should execute pre-loaded function successfully', async () => {
      // Arrange
      const mockFunction = jest.fn().mockResolvedValue({ response: 'Function executed successfully' });
      service.setAgentFunction(mockFunction);

      const params = {
        message: 'test message',
        sessionId: 'test-session',
        conversationHistory: [],
        currentUser: 'test-user'
      };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(mockFunction).toHaveBeenCalledWith({
        userMessage: 'test message',
        sessionId: 'test-session',
        conversationHistory: [],
        currentUser: 'test-user',
        authToken: undefined,
        llmService: llmService,
        metadata: expect.objectContaining({
          method: 'test-method',
          agentName: 'test-agent',
          timestamp: expect.any(String)
        })
      });

      expect(result).toEqual({
        success: true,
        response: 'Function executed successfully',
        metadata: expect.objectContaining({
          agentName: 'test-agent',
          agentType: 'function',
          functionStatus: 'executed',
          processedAt: expect.any(String)
        })
      });
    });

    it('should handle function execution errors gracefully', async () => {
      // Arrange
      const mockFunction = jest.fn().mockRejectedValue(new Error('Function execution failed'));
      service.setAgentFunction(mockFunction);

      const params = { message: 'test message' };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Function execution failed',
        response: 'I apologize, but I encountered an error while processing your request. Falling back to basic processing.',
        metadata: expect.objectContaining({
          agentName: 'test-agent',
          agentType: 'function',
          functionStatus: 'error',
          errorDetails: 'Function execution failed',
          processedAt: expect.any(String)
        })
      });
    });
  });

  describe('executeTask without pre-loaded function', () => {
    it('should fall back to context processing when no function is set', async () => {
      // Arrange
      const params = { message: 'test message' };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(result).toEqual({
        success: true,
        response: "Hello! I'm the test-agent agent. I'm ready to help, but my function isn't loaded yet. Please check back soon!",
        metadata: expect.objectContaining({
          agentName: 'test-agent',
          agentType: 'function',
          functionStatus: 'fallback',
          reason: 'No pre-loaded function available',
          method: 'test-method',
          processedAt: expect.any(String)
        })
      });
    });
  });

  describe('extractUserMessage', () => {
    it('should extract message from string input', () => {
      // Act
      const result = service['extractUserMessage']('simple string message');

      // Assert
      expect(result).toBe('simple string message');
    });

    it('should extract message from object with message property', () => {
      // Act
      const result = service['extractUserMessage']({ message: 'test message' });

      // Assert
      expect(result).toBe('test message');
    });

    it('should extract message from object with userMessage property', () => {
      // Act
      const result = service['extractUserMessage']({ userMessage: 'test user message' });

      // Assert
      expect(result).toBe('test user message');
    });

    it('should stringify object if no recognized message properties found', () => {
      // Act
      const result = service['extractUserMessage']({ someOtherProp: 'value' });

      // Assert
      expect(result).toBe('{"someOtherProp":"value"}');
    });

    it('should handle null/undefined parameters', () => {
      // Act & Assert
      expect(service['extractUserMessage'](null)).toBe('');
      expect(service['extractUserMessage'](undefined)).toBe('');
    });
  });

  describe('getAgentCard', () => {
    it('should return agent card with function status when function is loaded', async () => {
      // Arrange
      const mockFunction = jest.fn();
      service.setAgentFunction(mockFunction);
      
      // Mock the parent getAgentCard method
      const baseCard = { name: 'test-agent', type: 'function' };
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'getAgentCard').mockResolvedValue(baseCard);

      // Act
      const result = await service.getAgentCard();

      // Assert
      expect(result).toEqual({
        ...baseCard,
        functionStatus: 'loaded',
        loadedAt: expect.any(String)
      });
    });

    it('should return agent card with not_loaded status when function is not set', async () => {
      // Arrange
      const baseCard = { name: 'test-agent', type: 'function' };
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'getAgentCard').mockResolvedValue(baseCard);

      // Act
      const result = await service.getAgentCard();

      // Assert
      expect(result).toEqual({
        ...baseCard,
        functionStatus: 'not_loaded',
        loadedAt: null
      });
    });
  });
}); 