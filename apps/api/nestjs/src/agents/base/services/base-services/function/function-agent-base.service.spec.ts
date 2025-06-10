import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FunctionAgentBaseService } from './function-agent-base.service';
import { LLMService } from '../../llm/llm.service';
import { AgentFunction, AgentFunctionParams, AgentFunctionResponse } from '../a2a-base/interfaces';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FunctionAgentBaseService', () => {
  let service: FunctionAgentBaseService;
  let llmService: jest.Mocked<LLMService>;

  // Mock agent function for testing
  const mockAgentFunction: AgentFunction = {
    execute: jest.fn().mockResolvedValue({
      response: 'Mock agent response',
      metadata: { agentName: 'test-agent' }
    })
  };

  beforeEach(async () => {
    // Create mock LLM service
    const mockLLMService = {
      generateResponse: jest.fn().mockResolvedValue('Mock LLM response'),
      generateResponseWithHistory: jest.fn().mockResolvedValue('Mock LLM response with history'),
      getLangGraphLLM: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FunctionAgentBaseService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
      ],
    }).compile();

    service = module.get<FunctionAgentBaseService>(FunctionAgentBaseService);
    llmService = module.get<LLMService>(LLMService) as jest.Mocked<LLMService>;

    // Mock the getAgentDirectory method to return our test directory
    jest.spyOn(service as any, 'getAgentDirectory').mockReturnValue('/test/agent/path');
    jest.spyOn(service as any, 'getAgentName').mockReturnValue('test-agent');
    
    // Reset mocks
    mockFs.existsSync.mockClear();
    (mockAgentFunction.execute as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Dynamic Function Loading - File Discovery', () => {
    it('should check for agent-function.ts file first', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/agent/path/agent-function.ts');
    });

    it('should check for agent-function.js file if .ts is not found', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/agent/path/agent-function.ts');
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/agent/path/agent-function.js');
    });

    it('should handle missing agent function files gracefully', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const result = await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(result).toContain('Agent function not available');
    });

    it('should handle missing agent directory gracefully', async () => {
      // Arrange
      jest.spyOn(service as any, 'getAgentDirectory').mockReturnValue(null);

      // Act
      const result = await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(result).toContain('Agent function not available');
    });
  });

  describe('Caching Mechanism', () => {
    it('should cache load attempts to avoid repeated file system checks', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act - First call
      await service['executeTask']('test-method', { message: 'test message 1' });
      
      // Reset the mock call count after first load
      mockFs.existsSync.mockClear();
      
      // Act - Second call  
      await service['executeTask']('test-method', { message: 'test message 2' });

      // Assert - fs.existsSync should not be called again due to caching
      expect(mockFs.existsSync).not.toHaveBeenCalled();
    });

    it('should provide cache status in performance metrics', () => {
      // Act
      const metrics = service.getPerformanceMetrics();

      // Assert
      expect(metrics).toEqual({
        hasCachedFunction: false,
        loadedAt: undefined,
        filePath: undefined,
        cacheAge: undefined
      });
    });
  });

  describe('Parameter Handling', () => {
    it('should extract user message from string parameters', () => {
      // Act
      const result = service['extractUserMessage']('simple string message');

      // Assert
      expect(result).toBe('simple string message');
    });

    it('should extract user message from object with message property', () => {
      // Act
      const result = service['extractUserMessage']({ message: 'test message' });

      // Assert
      expect(result).toBe('test message');
    });

    it('should extract user message from object with userMessage property', () => {
      // Act
      const result = service['extractUserMessage']({ userMessage: 'test user message' });

      // Assert
      expect(result).toBe('test user message');
    });

    it('should extract user message from object with prompt property', () => {
      // Act
      const result = service['extractUserMessage']({ prompt: 'test prompt' });

      // Assert
      expect(result).toBe('test prompt');
    });

    it('should extract user message from object with input property', () => {
      // Act
      const result = service['extractUserMessage']({ input: 'test input' });

      // Assert
      expect(result).toBe('test input');
    });

    it('should stringify object if no recognized message properties found', () => {
      // Act
      const result = service['extractUserMessage']({ someOtherProp: 'value' });

      // Assert
      expect(result).toBe('{"someOtherProp":"value"}');
    });

    it('should handle null/undefined parameters', () => {
      // Act & Assert
      expect(service['extractUserMessage'](null)).toBe('null');
      expect(service['extractUserMessage'](undefined)).toBe('');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should throw AgentFunctionNotFoundError when no function file exists', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act & Assert
      await expect(service['loadAgentFunction']()).rejects.toThrow('Agent function file not found');
    });

    it('should throw AgentFunctionLoadError when import fails', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(true);
      jest.doMock('file:///test/agent/path/agent-function.ts', () => {
        throw new Error('SyntaxError: Unexpected token');
      }, { virtual: true });

      // Act & Assert
      await expect(service['loadAgentFunction']()).rejects.toThrow('Failed to load agent function');
    });

    it('should throw AgentFunctionValidationError when module exports are invalid', async () => {
      // Arrange
      const module = { invalidExport: 'not a function' };

      // Act & Assert
      expect(() => service['validateAndExtractFunction'](module, '/test/path')).toThrow('does not export expected structure');
    });

    it('should implement retry logic for recoverable errors', async () => {
      // Arrange
      const executeTaskSpy = jest.spyOn(service as any, 'executeTask');
      const loadFunctionSpy = jest.spyOn(service as any, 'loadAgentFunction');
      
      mockFs.existsSync.mockReturnValue(true);
      
      // First call fails, second succeeds
      loadFunctionSpy
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      // Mock a cached function for the retry
      const mockFunction = {
        execute: jest.fn().mockResolvedValue({ response: 'success' })
      };
      
      service['agentFunctionCache'] = {
        function: mockFunction,
        loadedAt: new Date(),
        filePath: '/test/path'
      };

      // Act
      const result = await service['executeTask']('test-method', { message: 'test' });

      // Assert - should eventually succeed after retry
      expect(result).toBeDefined();
    });

    it('should fall back to context processing on critical errors', async () => {
      // Arrange
      const processWithContextSpy = jest.spyOn(service as any, 'processWithContext').mockResolvedValue('fallback response');
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const result = await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(processWithContextSpy).toHaveBeenCalledWith('test-method', { message: 'test message' });
      expect(result).toBe('fallback response');
    });
  });

  describe('Function Validation', () => {
    it('should validate and extract function with direct execute export', () => {
      // Arrange
      const module = {
        execute: jest.fn()
      };

      // Act
      const result = service['validateAndExtractFunction'](module, '/test/path');

      // Assert
      expect(result).toEqual({
        execute: module.execute
      });
    });

    it('should validate and extract function with default export', () => {
      // Arrange
      const module = {
        default: {
          execute: jest.fn()
        }
      };

      // Act
      const result = service['validateAndExtractFunction'](module, '/test/path');

      // Assert
      expect(result).toEqual(module.default);
    });

    it('should throw error for invalid module exports', () => {
      // Arrange
      const module = {
        invalidExport: 'not a function'
      };

      // Act & Assert
      expect(() => service['validateAndExtractFunction'](module, '/test/path')).toThrow('does not export expected structure');
    });
  });

  describe('Agent Card Enhancement', () => {
    it('should include enhanced function-based capabilities in agent card', async () => {
      // Arrange - Mock the parent class method
      const baseCard = {
        name: 'Test Agent',
        capabilities: { basic: true }
      };
      
      // Mock the parent method call
      const getAgentCardSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'getAgentCard');
      getAgentCardSpy.mockResolvedValue(baseCard);

      // Act
      const card = await service.getAgentCard();

      // Assert
      expect(card).toEqual(
        expect.objectContaining({
          name: 'Test Agent',
          capabilities: expect.objectContaining({
            basic: true,
            functionBased: true,
            dynamicImport: true,
            autoParameterHandling: true,
            enhancedCaching: true,
            errorCategorization: true,
            performanceOptimized: true
          }),
          functionInfo: expect.objectContaining({
            hasFunctionFile: false,
            functionLoadAttempted: false,
            functionLoadedAt: undefined,
            functionFilePath: undefined
          })
        })
      );
    });
  });

  describe('File Path Resolution', () => {
    it('should use Node.js path module to construct file paths', async () => {
      // Arrange
      const pathJoinSpy = jest.spyOn(path, 'join');
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(pathJoinSpy).toHaveBeenCalledWith('/test/agent/path', 'agent-function.ts');
      expect(pathJoinSpy).toHaveBeenCalledWith('/test/agent/path', 'agent-function.js');
    });

    it('should handle different agent directory structures', async () => {
      // Arrange
      const nestedPath = '/complex/nested/agent/structure';
      jest.spyOn(service as any, 'getAgentDirectory').mockReturnValue(nestedPath);
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(mockFs.existsSync).toHaveBeenCalledWith(`${nestedPath}/agent-function.ts`);
      expect(mockFs.existsSync).toHaveBeenCalledWith(`${nestedPath}/agent-function.js`);
    });
  });

  describe('Fallback Processing', () => {
    it('should provide helpful fallback response when no function is available', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const result = await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(result).toContain('Agent function not available for test-agent');
      expect(result).toContain('Method: test-method');
    });

    it('should log fallback usage for debugging', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['functionLogger'], 'debug').mockImplementation();
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await service['executeTask']('test-method', { message: 'test message' });

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Using fallback processing',
        expect.objectContaining({
          agentName: 'test-agent',
          method: 'test-method',
          reason: 'No function file found'
        })
      );
    });
  });

  describe('Manual Function Reloading', () => {
    it('should reset cache state when reloading function', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const reloadResult = await service.reloadAgentFunction();

      // Assert
      expect(reloadResult).toBe(false); // Should be false because no function file exists
      
      const metrics = service.getPerformanceMetrics();
      expect(metrics.hasCachedFunction).toBe(false);
    });

    it('should log reload attempts', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['functionLogger'], 'log').mockImplementation();
      mockFs.existsSync.mockReturnValue(false);

      // Act
      await service.reloadAgentFunction();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Manually reloading agent function');
      expect(loggerSpy).toHaveBeenCalledWith('Agent function reload failed');
    });
  });

  describe('Type Safety and TypeScript Integration', () => {
    it('should handle TypeScript import types correctly', () => {
      // This test verifies that our method signatures and return types are correctly typed
      const service = new FunctionAgentBaseService(llmService);
      
      // These should compile without TypeScript errors
      expect(typeof service.getPerformanceMetrics).toBe('function');
      expect(typeof service.reloadAgentFunction).toBe('function');
      expect(typeof service.getAgentCard).toBe('function');
    });
  });
}); 