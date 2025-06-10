import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from './python-function-agent-base.service';
import { LLMService } from '../../llm/llm.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('PythonFunctionAgentBaseService', () => {
  let service: PythonFunctionAgentBaseService;
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
        PythonFunctionAgentBaseService,
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

    service = module.get<PythonFunctionAgentBaseService>(PythonFunctionAgentBaseService);
    llmService = module.get<LLMService>(LLMService) as jest.Mocked<LLMService>;

    // Mock the required methods
    jest.spyOn(service as any, 'getAgentName').mockReturnValue('test-python-agent');
    jest.spyOn(service as any, 'getAgentType').mockReturnValue('python');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setPythonScriptPath', () => {
    it('should set the Python script path successfully', () => {
      // Arrange
      const scriptPath = '/path/to/agent.py';

      // Act
      service.setPythonScriptPath(scriptPath);

      // Assert - We can't directly test the private property, but executeTask will verify it worked
      expect(service).toBeDefined();
    });
  });

  describe('setPythonExecutable', () => {
    it('should set the Python executable successfully', () => {
      // Arrange
      const executable = 'python3.9';

      // Act
      service.setPythonExecutable(executable);

      // Assert
      expect(service).toBeDefined();
    });
  });

  describe('executeTask with Python script', () => {
    it('should execute Python script successfully', async () => {
      // Arrange
      const scriptPath = '/path/to/agent.py';
      const mockPythonProcess = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback('{"response": "Python script executed successfully"}');
            }
          }),
        },
        stderr: {
          on: jest.fn(),
        },
        stdin: {
          write: jest.fn(),
          end: jest.fn(),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        }),
        kill: jest.fn(),
        killed: false,
      };

      mockSpawn.mockReturnValue(mockPythonProcess as any);
      mockFs.existsSync.mockReturnValue(true);
      
      service.setPythonScriptPath(scriptPath);

      const params = {
        message: 'test message',
        sessionId: 'test-session',
        conversationHistory: [],
        currentUser: 'test-user'
      };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/path/to'
      });

      expect(result).toEqual({
        success: true,
        response: 'Python script executed successfully',
        metadata: expect.objectContaining({
          agentName: 'test-python-agent',
          agentType: 'python',
          executionType: 'python_script',
          scriptPath: scriptPath,
          processedAt: expect.any(String)
        })
      });
    });

    it('should handle Python script execution errors gracefully', async () => {
      // Arrange
      const scriptPath = '/path/to/agent.py';
      const mockPythonProcess = {
        stdout: {
          on: jest.fn(),
        },
        stderr: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback('Python error occurred');
            }
          }),
        },
        stdin: {
          write: jest.fn(),
          end: jest.fn(),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Error exit code
          }
        }),
        kill: jest.fn(),
        killed: false,
      };

      mockSpawn.mockReturnValue(mockPythonProcess as any);
      mockFs.existsSync.mockReturnValue(true);
      
      service.setPythonScriptPath(scriptPath);

      const params = { message: 'test message' };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Python script exited with code 1. Error: Python error occurred',
        response: 'I apologize, but I encountered an error while processing your request. Falling back to basic processing.',
        metadata: expect.objectContaining({
          agentName: 'test-python-agent',
          agentType: 'python',
          executionType: 'python_script_error',
          scriptPath: scriptPath,
          errorDetails: 'Python script exited with code 1. Error: Python error occurred',
          processedAt: expect.any(String)
        })
      });
    });

    it('should handle non-JSON output from Python script', async () => {
      // Arrange
      const scriptPath = '/path/to/agent.py';
      const mockPythonProcess = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback('Simple text output from Python');
            }
          }),
        },
        stderr: {
          on: jest.fn(),
        },
        stdin: {
          write: jest.fn(),
          end: jest.fn(),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        }),
        kill: jest.fn(),
        killed: false,
      };

      mockSpawn.mockReturnValue(mockPythonProcess as any);
      mockFs.existsSync.mockReturnValue(true);
      
      service.setPythonScriptPath(scriptPath);

      const params = { message: 'test message' };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(result).toEqual({
        success: true,
        response: 'Simple text output from Python',
        metadata: expect.objectContaining({
          agentName: 'test-python-agent',
          agentType: 'python',
          executionType: 'python_script',
          scriptPath: scriptPath,
          processedAt: expect.any(String)
        })
      });
    });
  });

  describe('executeTask without Python script', () => {
    it('should fall back to context processing when no script is set', async () => {
      // Arrange
      const params = { message: 'test message' };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(result).toEqual({
        success: true,
        response: "Hello! I'm the test-python-agent agent. I'm ready to help, but my Python script isn't available yet. Please check back soon!",
        metadata: expect.objectContaining({
          agentName: 'test-python-agent',
          agentType: 'python',
          executionType: 'fallback',
          reason: 'No Python script available',
          method: 'test-method',
          processedAt: expect.any(String)
        })
      });
    });

    it('should fall back to context processing when script file does not exist', async () => {
      // Arrange
      service.setPythonScriptPath('/nonexistent/script.py');
      mockFs.existsSync.mockReturnValue(false);
      
      const params = { message: 'test message' };

      // Act
      const result = await service['executeTask']('test-method', params);

      // Assert
      expect(result).toEqual({
        success: true,
        response: "Hello! I'm the test-python-agent agent. I'm ready to help, but my Python script isn't available yet. Please check back soon!",
        metadata: expect.objectContaining({
          agentName: 'test-python-agent',
          agentType: 'python',
          executionType: 'fallback',
          reason: 'No Python script available',
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
    it('should return agent card with script status when script is available', async () => {
      // Arrange
      const scriptPath = '/path/to/agent.py';
      service.setPythonScriptPath(scriptPath);
      mockFs.existsSync.mockReturnValue(true);
      
      // Mock the parent getAgentCard method
      const baseCard = { name: 'test-python-agent', type: 'python' };
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'getAgentCard').mockResolvedValue(baseCard);

      // Act
      const result = await service.getAgentCard();

      // Assert
      expect(result).toEqual({
        ...baseCard,
        pythonScriptStatus: 'available',
        pythonScriptPath: scriptPath,
        pythonExecutable: 'python3',
        loadedAt: expect.any(String)
      });
    });

    it('should return agent card with not_available status when script is not set', async () => {
      // Arrange
      const baseCard = { name: 'test-python-agent', type: 'python' };
      jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'getAgentCard').mockResolvedValue(baseCard);

      // Act
      const result = await service.getAgentCard();

      // Assert
      expect(result).toEqual({
        ...baseCard,
        pythonScriptStatus: 'not_available',
        pythonScriptPath: null,
        pythonExecutable: 'python3',
        loadedAt: null
      });
    });
  });
}); 