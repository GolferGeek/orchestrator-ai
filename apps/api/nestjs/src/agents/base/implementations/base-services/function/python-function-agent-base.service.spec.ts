import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from './python-function-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Mock child_process
jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Mock fs
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Test implementation of the abstract service
class TestPythonFunctionAgentService extends PythonFunctionAgentBaseService {
  getAgentName(): string {
    return 'Test Python Agent';
  }

  getAgentType(): 'specialist' | 'orchestrator' | 'manager' | 'external' {
    return 'specialist';
  }
}

describe('PythonFunctionAgentBaseService', () => {
  let service: TestPythonFunctionAgentService;
  let llmService: jest.Mocked<LLMService>;
  let httpService: jest.Mocked<HttpService>;

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
      axiosRef: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestPythonFunctionAgentService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<TestPythonFunctionAgentService>(TestPythonFunctionAgentService);
    llmService = module.get<LLMService>(LLMService) as jest.Mocked<LLMService>;
    httpService = module.get<HttpService>(HttpService) as jest.Mocked<HttpService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      const result = await service.executeTask('test-method', params);

      // Assert
      expect(mockSpawn).toHaveBeenCalledWith('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: '/path/to'
      });

      expect(result).toEqual({
        success: true,
        response: 'Python script executed successfully',
        metadata: expect.objectContaining({
          agentType: 'specialist',
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
      const result = await service.executeTask('test-method', params);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Python script exited with code 1. Error: Python error occurred',
        response: 'I apologize, but I encountered an error while processing your request. Falling back to basic processing.',
        metadata: expect.objectContaining({
          agentName: 'Test Python Agent',
          agentType: 'specialist',
          executionType: 'python_script_error',
          scriptPath: scriptPath,
          errorDetails: 'Python script exited with code 1. Error: Python error occurred',
          processedAt: expect.any(String)
        })
      });
    });

    it('should fall back to context processing when no Python script is available', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);
      
      const params = { message: 'test message' };

      // Act
      const result = await service.executeTask('test-method', params);

      // Assert
      expect(result).toEqual({
        success: true,
        response: "Hello! I'm the Test Python Agent agent. I'm ready to help, but my Python script isn't available yet. Please check back soon!",
        metadata: expect.objectContaining({
          agentName: 'Test Python Agent',
          agentType: 'specialist',
          executionType: 'fallback',
          reason: 'No Python script available',
          method: 'test-method',
          processedAt: expect.any(String)
        })
      });
    });
  });

  describe('setDiscoveredPath', () => {
    it('should set the discovered agent path', () => {
      // Arrange
      const path = 'specialists/test-agent';

      // Act
      service.setDiscoveredPath(path);

      // Assert
      expect(service).toBeDefined();
      // Path is set internally, can't directly test but method should not throw
    });
  });

  describe('getAgentCard', () => {
    it('should return agent card with Python script status', async () => {
      // Arrange
      const scriptPath = '/path/to/agent.py';
      mockFs.existsSync.mockReturnValue(true);
      service.setPythonScriptPath(scriptPath);

      // Act
      const card = await service.getAgentCard();

      // Assert
      expect(card).toEqual(expect.objectContaining({
        pythonScriptStatus: 'available',
        pythonScriptPath: scriptPath,
        pythonExecutable: 'python3',
        loadedAt: expect.any(String)
      }));
    });

    it('should return agent card with unavailable status when no script', async () => {
      // Arrange
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const card = await service.getAgentCard();

      // Assert
      expect(card).toEqual(expect.objectContaining({
        pythonScriptStatus: 'not_available',
        pythonScriptPath: null,
        pythonExecutable: 'python3',
        loadedAt: null
      }));
    });
  });
}); 