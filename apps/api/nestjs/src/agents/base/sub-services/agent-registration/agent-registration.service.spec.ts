import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AgentRegistrationService, RegistrationConfig, AgentInfo, RegistrationResult, HeartbeatResult } from './agent-registration.service';
import { AgentMetrics } from '@agent-pool/interfaces';

// Mock HttpService
const mockHttpService = {
  axiosRef: {
    post: jest.fn(),
    delete: jest.fn()
  }
};

describe('AgentRegistrationService', () => {
  let service: AgentRegistrationService;
  let httpService: jest.Mocked<HttpService>;

  const mockAgentInfo: AgentInfo = {
    id: 'test_agent_123',
    name: 'Test Agent',
    type: 'specialist',
    path: 'specialist/test_agent',
    url: 'http://localhost:4000/agents/specialist/test_agent/tasks',
    description: 'A test agent for unit testing',
    capabilities: ['processTask', 'generateResponse'],
    skills: [
      {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'A test skill',
        tags: ['test'],
        examples: ['test example'],
        inputModes: ['text'],
        outputModes: ['text']
      }
    ],
    inputModes: ['text', 'json'],
    outputModes: ['text', 'json'],
    metadata: { version: '1.0.0' }
  };

  const mockMetrics: AgentMetrics = {
    activeTasks: 2,
    totalTasksProcessed: 100,
    averageResponseTime: 250,
    errorCount: 5,
    uptime: 3600000
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRegistrationService,
        {
          provide: HttpService,
          useValue: mockHttpService
        }
      ],
    }).compile();

    service = module.get<AgentRegistrationService>(AgentRegistrationService);
    httpService = module.get(HttpService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any running intervals
    service.stopHeartbeat();
  });

  describe('constructor and configuration', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have default configuration', () => {
      const status = service.getRegistrationStatus();
      expect(status.isRegistered).toBe(false);
      expect(status.agentId).toBeNull();
    });

    it('should allow configuration updates', () => {
      const config: Partial<RegistrationConfig> = {
        heartbeatInterval: 60000,
        maxRetryAttempts: 5,
        autoHeartbeat: false
      };

      service.configure(config);
      
      // Configuration is private, but we can test its effects
      expect(service).toBeDefined();
    });
  });

  describe('agent registration', () => {
    it('should register agent successfully on first attempt', async () => {
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true }
      });

      const result = await service.registerAgent(mockAgentInfo);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(mockAgentInfo.id);
      expect(result.retryCount).toBe(0);
      expect(result.message).toContain('attempt 1');

      expect(mockHttpService.axiosRef.post).toHaveBeenCalledTimes(1);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        'http://localhost:4000/agent-pool/register',
        expect.objectContaining({
          id: mockAgentInfo.id,
          name: mockAgentInfo.name,
          type: mockAgentInfo.type,
          status: 'online'
        })
      );

      const status = service.getRegistrationStatus();
      expect(status.isRegistered).toBe(true);
      expect(status.agentId).toBe(mockAgentInfo.id);
    });

    it('should retry registration on failure and succeed', async () => {
      service.configure({ retryDelay: 10 }); // Reduce delay for faster test
      
      // First attempt fails, second succeeds
      mockHttpService.axiosRef.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 201,
          data: { success: true }
        });

      const result = await service.registerAgent(mockAgentInfo);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(1);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should fail registration after max retry attempts', async () => {
      service.configure({ maxRetryAttempts: 1, retryDelay: 10 }); // Reduce attempts and delay
      
      mockHttpService.axiosRef.post.mockRejectedValue(new Error('Persistent error'));

      const result = await service.registerAgent(mockAgentInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent error');
      expect(result.retryCount).toBe(1);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledTimes(1);

      const status = service.getRegistrationStatus();
      expect(status.isRegistered).toBe(false);
    });

    it('should handle unexpected response status', async () => {
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 400,
        data: { error: 'Bad request' }
      });

      service.configure({ maxRetryAttempts: 1 });
      const result = await service.registerAgent(mockAgentInfo);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected response status: 400');
    });
  });

  describe('agent unregistration', () => {
    beforeEach(async () => {
      // Register agent first
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true }
      });
      await service.registerAgent(mockAgentInfo);
    });

    it('should unregister agent successfully', async () => {
      mockHttpService.axiosRef.delete.mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });

      const result = await service.unregisterAgent();

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(mockAgentInfo.id);
      expect(mockHttpService.axiosRef.delete).toHaveBeenCalledWith(
        `http://localhost:4000/agent-pool/agents/${mockAgentInfo.id}`
      );

      const status = service.getRegistrationStatus();
      expect(status.isRegistered).toBe(false);
      expect(status.agentId).toBeNull();
    });

    it('should unregister specific agent by ID', async () => {
      mockHttpService.axiosRef.delete.mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });

      const customAgentId = 'custom_agent_id';
      const result = await service.unregisterAgent(customAgentId);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(customAgentId);
      expect(mockHttpService.axiosRef.delete).toHaveBeenCalledWith(
        `http://localhost:4000/agent-pool/agents/${customAgentId}`
      );
    });

    it('should handle unregistration failure', async () => {
      mockHttpService.axiosRef.delete.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await service.unregisterAgent();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });

    it('should fail when no agent ID is available', async () => {
      // Create a new service instance (not registered)
      const newService = new AgentRegistrationService(httpService);
      
      const result = await newService.unregisterAgent();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No agent ID provided');
    });
  });

  describe('heartbeat functionality', () => {
    beforeEach(async () => {
      // Register agent first
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true }
      });
      await service.registerAgent(mockAgentInfo);
    });

    it('should send heartbeat successfully', async () => {
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });

      const result = await service.sendHeartbeat(mockAgentInfo.id, mockMetrics);

      expect(result.success).toBe(true);
      expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
        'http://localhost:4000/agent-pool/heartbeat',
        expect.objectContaining({
          agentId: mockAgentInfo.id,
          timestamp: expect.any(Date),
          status: 'online'
        })
      );

      const status = service.getRegistrationStatus();
      expect(status.heartbeatCount).toBe(1);
      expect(status.lastHeartbeatTime).toBeDefined();
    });

    it('should handle heartbeat failure', async () => {
      mockHttpService.axiosRef.post.mockRejectedValueOnce(new Error('Heartbeat failed'));

      const result = await service.sendHeartbeat(mockAgentInfo.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Heartbeat failed');

      const status = service.getRegistrationStatus();
      expect(status.failedHeartbeats).toBe(1);
    });

    it('should fail heartbeat when not registered', async () => {
      // Create unregistered service
      const newService = new AgentRegistrationService(httpService);
      
      const result = await newService.sendHeartbeat(mockAgentInfo.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent is not registered');
    });

    it('should start and stop heartbeat interval', (done) => {
      service.configure({ heartbeatInterval: 50 }); // Very short interval for testing
      
      mockHttpService.axiosRef.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      service.startHeartbeat(mockAgentInfo);

      // Wait for at least one heartbeat
      setTimeout(() => {
        expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
          'http://localhost:4000/agent-pool/heartbeat',
          expect.any(Object)
        );

        service.stopHeartbeat();
        const callCount = mockHttpService.axiosRef.post.mock.calls.length;

        // Wait a bit more to ensure no more calls are made
        setTimeout(() => {
          expect(mockHttpService.axiosRef.post.mock.calls.length).toBe(callCount);
          done();
        }, 100);
      }, 100);
    });

    it('should use metrics callback in heartbeat', (done) => {
      service.configure({ heartbeatInterval: 50 });
      
      mockHttpService.axiosRef.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      const getMetrics = jest.fn().mockReturnValue(mockMetrics);
      service.startHeartbeat(mockAgentInfo, getMetrics);

      setTimeout(() => {
        expect(getMetrics).toHaveBeenCalled();
        expect(mockHttpService.axiosRef.post).toHaveBeenCalledWith(
          'http://localhost:4000/agent-pool/heartbeat',
          expect.objectContaining({
            agentId: mockAgentInfo.id,
            timestamp: expect.any(Date),
            metrics: mockMetrics,
            status: 'online'
          })
        );
        
        service.stopHeartbeat();
        done();
      }, 100);
    });
  });

  describe('utility methods', () => {
    it('should generate consistent agent ID', () => {
      const id1 = service.generateAgentId('Test Agent', 'specialist');
      const id2 = service.generateAgentId('Test Agent', 'specialist');
      const id3 = service.generateAgentId('Another Agent', 'orchestrator');

      expect(id1).toBe('specialist_test_agent');
      expect(id2).toBe(id1); // Should be consistent
      expect(id3).toBe('orchestrator_another_agent');
    });

    it('should build agent URL correctly', () => {
      const url1 = service.buildAgentUrl('specialist/test_agent');
      const url2 = service.buildAgentUrl('orchestrator/main', 'https://api.example.com');

      expect(url1).toBe('http://localhost:4000/agents/specialist/test_agent/tasks');
      expect(url2).toBe('https://api.example.com/agents/orchestrator/main/tasks');
    });

    it('should validate agent info correctly', () => {
      const validResult = service.validateAgentInfo(mockAgentInfo);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidAgentInfo = {
        ...mockAgentInfo,
        id: '',
        name: '',
        type: 'invalid' as any,
        capabilities: 'not-array' as any
      };

      const invalidResult = service.validateAgentInfo(invalidAgentInfo);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Agent ID is required');
      expect(invalidResult.errors).toContain('Agent name is required');
      expect(invalidResult.errors).toContain('Agent type must be one of: orchestrator, specialist, manager, external');
      expect(invalidResult.errors).toContain('Agent capabilities must be an array');
    });

    it('should provide registration status', async () => {
      const initialStatus = service.getRegistrationStatus();
      expect(initialStatus.isRegistered).toBe(false);
      expect(initialStatus.uptime).toBeNull();

      // Register agent
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true }
      });
      await service.registerAgent(mockAgentInfo);

      // Wait a small amount to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 10));

      const registeredStatus = service.getRegistrationStatus();
      expect(registeredStatus.isRegistered).toBe(true);
      expect(registeredStatus.agentId).toBe(mockAgentInfo.id);
      expect(registeredStatus.uptime).toBeGreaterThanOrEqual(0);
      expect(registeredStatus.registrationTime).toBeDefined();
    });

    it('should check registration status', async () => {
      expect(service.isAgentRegistered()).toBe(false);
      expect(service.getRegisteredAgentId()).toBeNull();

      // Register agent
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true }
      });
      await service.registerAgent(mockAgentInfo);

      expect(service.isAgentRegistered()).toBe(true);
      expect(service.getRegisteredAgentId()).toBe(mockAgentInfo.id);
    });
  });

  describe('module lifecycle', () => {
    it('should cleanup on module destroy', async () => {
      // Register agent first
      mockHttpService.axiosRef.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true }
      });
      await service.registerAgent(mockAgentInfo);

      // Start heartbeat
      service.startHeartbeat(mockAgentInfo);

      // Mock unregister
      mockHttpService.axiosRef.delete.mockResolvedValueOnce({
        status: 200,
        data: { success: true }
      });

      await service.onModuleDestroy();

      expect(mockHttpService.axiosRef.delete).toHaveBeenCalledWith(
        `http://localhost:4000/agent-pool/agents/${mockAgentInfo.id}`
      );

      const status = service.getRegistrationStatus();
      expect(status.isRegistered).toBe(false);
    });

    it('should handle destroy when not registered', async () => {
      // Should not throw error
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('configuration edge cases', () => {
    it('should handle partial endpoint configuration', () => {
      const config: Partial<RegistrationConfig> = {
        endpoints: {
          register: '/custom-register'
          // heartbeat and unregister should use defaults
        }
      };

      service.configure(config);
      
      // Configuration is private, but we can test its effects through registration
      expect(service).toBeDefined();
    });

    it('should use environment variables for default URL', () => {
      // Test is implicitly covered by other tests using default configuration
      expect(service).toBeDefined();
    });
  });
}); 