import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  ApiAgentBaseService,
  ApiConfiguration,
  ApiAgentParams,
} from './api-agent-base.service';
import { AgentRegistrationService } from '../../../sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService } from '../../../sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService } from '../../../sub-services/logging/logging.service';
import { AuthService } from '../../../sub-services/auth/auth.service';

// Mock implementation of ApiAgentBaseService for testing
class TestApiAgentBaseService extends ApiAgentBaseService {
  getAgentName(): string {
    return 'test-api-agent';
  }

  getAgentType(): 'orchestrator' | 'specialist' | 'manager' | 'external' {
    return 'specialist';
  }
}

describe('ApiAgentBaseService', () => {
  let service: TestApiAgentBaseService;
  let httpService: jest.Mocked<HttpService>;
  let agentRegistrationService: jest.Mocked<AgentRegistrationService>;
  let jsonRpcProtocolService: jest.Mocked<JsonRpcProtocolService>;
  let loggingService: jest.Mocked<LoggingService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockHttpService = {
      request: jest.fn(),
    };

    const mockAgentRegistrationService = {
      registerAgent: jest.fn(),
      unregisterAgent: jest.fn(),
    };

    const mockJsonRpcProtocolService = {
      processRequest: jest.fn(),
      createSuccessResponse: jest.fn(),
      createErrorResponse: jest.fn(),
    };

    const mockLoggingService = {
      logAgentEvent: jest.fn(),
      logRequest: jest.fn(),
      logResponse: jest.fn(),
      logError: jest.fn(),
    };

    const mockAuthService = {
      extractAuthContext: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestApiAgentBaseService,
        { provide: HttpService, useValue: mockHttpService },
        {
          provide: AgentRegistrationService,
          useValue: mockAgentRegistrationService,
        },
        {
          provide: JsonRpcProtocolService,
          useValue: mockJsonRpcProtocolService,
        },
        { provide: LoggingService, useValue: mockLoggingService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<TestApiAgentBaseService>(TestApiAgentBaseService);
    httpService = module.get(HttpService);
    agentRegistrationService = module.get(AgentRegistrationService);
    jsonRpcProtocolService = module.get(JsonRpcProtocolService);
    loggingService = module.get(LoggingService);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setApiConfiguration', () => {
    it('should set API configuration with environment variable substitution', () => {
      process.env.TEST_API_KEY = 'secret-key';
      process.env.TEST_ENDPOINT = 'https://api.example.com';

      const config: ApiConfiguration = {
        endpoint: '${TEST_ENDPOINT}/v1/chat',
        method: 'POST',
        authentication: {
          type: 'api_key',
          header: 'X-API-Key',
          value: '${TEST_API_KEY}',
        },
      };

      service.setApiConfiguration(config);

      // Access the private configuration through a public method
      const agentCard = service.getAgentCard();
      expect(agentCard).resolves.toMatchObject({
        apiStatus: 'configured',
        endpoint: 'https://api.example.com/v1/chat',
      });

      delete process.env.TEST_API_KEY;
      delete process.env.TEST_ENDPOINT;
    });
  });

  describe('executeTask', () => {
    it('should return fallback response when no API configuration is set', async () => {
      const result = await service.executeTask('test', { message: 'Hello' });

      expect(result).toEqual({
        success: true,
        response: expect.stringContaining('test-api-agent API agent'),
        metadata: expect.objectContaining({
          agentName: 'test-api-agent',
          apiStatus: 'fallback',
        }),
      });
    });

    it('should execute successful API call', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
      };

      const mockResponse: AxiosResponse = {
        data: { response: 'Hello from API' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      const result = await service.executeTask('chat', { message: 'Hello' });

      expect(result.success).toBe(true);
      expect(result.response).toBe('Hello from API');
      expect(result.metadata.apiStatus).toBe('executed');
      expect(httpService.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/v1/chat',
        data: {
          message: 'Hello',
          session_id: undefined,
          user: undefined,
          timestamp: expect.any(String),
        },
        params: undefined,
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'User-Agent': 'A2A-Agent/test-api-agent',
        }),
        timeout: 30000,
      });
    });

    it('should handle API call errors', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
      };

      httpService.request.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      service.setApiConfiguration(config);

      const result = await service.executeTask('chat', { message: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.metadata.apiStatus).toBe('error');
    });

    it('should implement retry logic with exponential backoff', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        retry: {
          attempts: 3,
          delay: 100,
          backoff: 'exponential',
        },
      };

      // Mock 2 failures then success
      httpService.request
        .mockReturnValueOnce(throwError(() => new Error('Network error 1')))
        .mockReturnValueOnce(throwError(() => new Error('Network error 2')))
        .mockReturnValueOnce(
          of({
            data: { response: 'Success on third try' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
          }),
        );

      service.setApiConfiguration(config);

      const startTime = Date.now();
      const result = await service.executeTask('chat', { message: 'Hello' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.response).toBe('Success on third try');
      expect(httpService.request).toHaveBeenCalledTimes(3);
      // Should have waited at least 100ms + 200ms (exponential backoff)
      expect(duration).toBeGreaterThan(250);
    });
  });

  describe('authentication', () => {
    it('should add API key authentication headers', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        authentication: {
          type: 'api_key',
          header: 'X-API-Key',
          value: 'secret-key',
        },
      };

      const mockResponse: AxiosResponse = {
        data: { response: 'Authenticated response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      await service.executeTask('chat', { message: 'Hello' });

      expect(httpService.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/v1/chat',
        data: expect.any(Object),
        params: undefined,
        headers: expect.objectContaining({
          'X-API-Key': 'secret-key',
        }),
        timeout: 30000,
      });
    });

    it('should add Bearer token authentication', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        authentication: {
          type: 'bearer',
          value: 'bearer-token',
        },
      };

      const mockResponse: AxiosResponse = {
        data: { response: 'Bearer authenticated' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      await service.executeTask('chat', { message: 'Hello' });

      expect(httpService.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/v1/chat',
        data: expect.any(Object),
        params: undefined,
        headers: expect.objectContaining({
          Authorization: 'Bearer bearer-token',
        }),
        timeout: 30000,
      });
    });

    it('should add Basic authentication', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        authentication: {
          type: 'basic',
          username: 'user',
          password: 'pass',
        },
      };

      const mockResponse: AxiosResponse = {
        data: { response: 'Basic authenticated' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      await service.executeTask('chat', { message: 'Hello' });

      const expectedCredentials = Buffer.from('user:pass').toString('base64');
      expect(httpService.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/v1/chat',
        data: expect.any(Object),
        params: undefined,
        headers: expect.objectContaining({
          Authorization: `Basic ${expectedCredentials}`,
        }),
        timeout: 30000,
      });
    });
  });

  describe('request and response transformation', () => {
    it('should transform request using custom format', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        requestTransform: '{"prompt": {{userMessage}}, "id": {{sessionId}}}',
      };

      const mockResponse: AxiosResponse = {
        data: { answer: 'Transformed response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      await service.executeTask('chat', {
        message: 'Hello',
        sessionId: 'session-123',
      });

      expect(httpService.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://api.example.com/v1/chat',
        data: {
          prompt: 'Hello',
          id: 'session-123',
        },
        params: undefined,
        headers: expect.any(Object),
        timeout: 30000,
      });
    });

    it('should transform response using field extraction', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        responseTransform: 'answer',
      };

      const mockResponse: AxiosResponse = {
        data: {
          answer: 'This is the answer',
          metadata: { tokens: 50 },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      const result = await service.executeTask('chat', { message: 'Hello' });

      expect(result.success).toBe(true);
      expect(result.response).toBe('This is the answer');
    });

    it('should use JSONPath-like extraction for nested fields', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
        responseTransform: '$.data.content',
      };

      const mockResponse: AxiosResponse = {
        data: {
          data: {
            content: 'Nested content',
            other: 'Other data',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      const result = await service.executeTask('chat', { message: 'Hello' });

      expect(result.success).toBe(true);
      expect(result.response).toBe('Nested content');
    });
  });

  describe('HTTP methods', () => {
    it('should handle GET requests with query parameters', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/search',
        method: 'GET',
      };

      const mockResponse: AxiosResponse = {
        data: { results: ['result1', 'result2'] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      await service.executeTask('search', { message: 'query' });

      expect(httpService.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://api.example.com/v1/search',
        data: undefined,
        params: {
          message: 'query',
          session_id: undefined,
          user: undefined,
          timestamp: expect.any(String),
        },
        headers: expect.any(Object),
        timeout: 30000,
      });
    });

    it('should handle PUT requests with body data', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/update',
        method: 'PUT',
      };

      const mockResponse: AxiosResponse = {
        data: { updated: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));
      service.setApiConfiguration(config);

      await service.executeTask('update', { message: 'update data' });

      expect(httpService.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: 'https://api.example.com/v1/update',
        data: {
          message: 'update data',
          session_id: undefined,
          user: undefined,
          timestamp: expect.any(String),
        },
        params: undefined,
        headers: expect.any(Object),
        timeout: 30000,
      });
    });
  });

  describe('getAgentCard', () => {
    it('should return agent card with API status', async () => {
      const config: ApiConfiguration = {
        endpoint: 'https://api.example.com/v1/chat',
        method: 'POST',
      };

      service.setApiConfiguration(config);
      const card = await service.getAgentCard();

      expect(card).toMatchObject({
        name: 'test-api-agent',
        type: 'specialist',
        apiStatus: 'configured',
        endpoint: 'https://api.example.com/v1/chat',
        configuredAt: expect.any(String),
      });
    });

    it('should return not_configured status when no config is set', async () => {
      const card = await service.getAgentCard();

      expect(card).toMatchObject({
        name: 'test-api-agent',
        type: 'specialist',
        apiStatus: 'not_configured',
        endpoint: null,
        configuredAt: null,
      });
    });
  });
});
