import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from './a2a-agent-base.service';
import { of } from 'rxjs';

// Test implementation of the abstract service
class TestA2AAgentService extends A2AAgentBaseService {
  getAgentName(): string {
    return 'Test Agent';
  }

  getAgentType(): 'specialist' | 'orchestrator' | 'manager' | 'external' {
    return 'specialist';
  }

  public async executeTask(method: string, params: any): Promise<any> {
    if (method === 'test.method') {
      return { result: 'success', params };
    }
    throw new Error(`Unknown method: ${method}`);
  }
}

describe('A2AAgentBaseService', () => {
  let service: TestA2AAgentService;
  let httpService: HttpService;

  beforeEach(async () => {
    // Disable external agent pool registration during tests
    process.env.DISABLE_EXTERNAL_AGENT_POOL = 'true';
    const mockHttpService = {
      post: jest.fn().mockReturnValue(of({ data: { success: true } })),
      get: jest.fn().mockReturnValue(of({ data: { success: true } })),
      put: jest.fn().mockReturnValue(of({ data: { success: true } })),
      delete: jest.fn().mockReturnValue(of({ data: { success: true } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestA2AAgentService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<TestA2AAgentService>(TestA2AAgentService);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(async () => {
    // Clean up environment variables
    delete process.env.DISABLE_EXTERNAL_AGENT_POOL;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have correct agent metadata', () => {
    expect(service.getAgentName()).toBe('Test Agent');
    expect(service.getAgentType()).toBe('specialist');
  });

  describe('JSON-RPC Processing', () => {
    it('should process valid JSON-RPC request', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test.method',
        params: { test: 'data' },
        id: 1
      };

      const response = await service.processTask(request);
      
      expect(response).toBeDefined();
      expect(response?.result).toEqual({ result: 'success', params: { test: 'data' } });
      expect(response?.id).toBe(1);
    });

    it('should handle invalid JSON-RPC request', async () => {
      const invalidRequest = {
        method: 'test.method',
        // Missing jsonrpc field
      };

      const response = await service.processTask(invalidRequest);
      
      expect(response).toBeDefined();
      expect(response?.result).toEqual({ result: 'success', params: undefined });
    });

    it('should handle method execution errors', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'unknown.method',
        params: { test: 'data' },
        id: 1
      };

      const response = await service.processTask(request);
      
      expect(response).toBeDefined();
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(-32603); // Internal Error
    });
  });

  describe('Task Processing', () => {
    it('should execute task directly', async () => {
      const result = await service.executeTask('test.method', { test: 'data' });
      
      expect(result).toEqual({ result: 'success', params: { test: 'data' } });
    });

    it('should throw error for unknown method', async () => {
      await expect(service.executeTask('unknown.method', {}))
        .rejects.toThrow('Unknown method: unknown.method');
    });
  });

  describe('Agent Card', () => {
    it('should generate basic agent card', async () => {
      const agentCard = await service.getAgentCard();
      
      expect(agentCard).toBeDefined();
      expect(agentCard.name).toBeDefined();
      expect(agentCard.description).toBeDefined();
      expect(agentCard.type).toBe('specialist');
    });
  });
}); 