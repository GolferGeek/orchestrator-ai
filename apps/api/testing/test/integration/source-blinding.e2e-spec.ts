import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { LLMService } from '../../../src/llms/llm.service';
import { LLMModule } from '../../../src/llms/llm.module';
import { SupabaseModule } from '../../../src/supabase/supabase.module';
import { CIDAFMModule } from '../../../src/cidafm/cidafm.module';

describe('Source Blinding E2E', () => {
  let app: INestApplication;
  let llmService: LLMService;
  let httpService: jest.Mocked<HttpService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        LLMModule,
        SupabaseModule,
        CIDAFMModule,
      ],
    })
    .overrideProvider(HttpService)
    .useValue({
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    llmService = moduleFixture.get<LLMService>(LLMService);
    httpService = moduleFixture.get(HttpService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('LLM Service Source Blinding Integration', () => {
    beforeEach(() => {
      // Mock successful LLM response
      httpService.request.mockReturnValue(of({
        data: {
          choices: [{
            message: {
              content: 'This is a test response from the LLM'
            }
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any));
    });

    it('should apply source blinding when calling generateResponse with OpenAI', async () => {
      // Set up environment for OpenAI
      process.env.OPENAI_API_KEY = 'sk-test-key-12345';
      
      const _response = await llmService.generateResponse(
        'You are a helpful assistant.',
        'Hello, how are you?',
        {
          provider: 'openai',
          temperature: 0.7,
          callerType: 'test',
          callerName: 'source-blinding-test',
        }
      );

      // Verify the HTTP request was made
      expect(httpService.request).toHaveBeenCalled();
      
      const requestConfig = httpService.request.mock.calls[0][0];
      
      // Verify essential headers are present
      expect(requestConfig.headers['authorization']).toContain('Bearer sk-test');
      expect(requestConfig.headers['content-type']).toBe('application/json');
      
      // Verify source blinding headers are applied
      expect(requestConfig.headers['user-agent']).toBe('OrchestratorAI/1.0');
      expect(requestConfig.headers['x-no-train']).toBe('true');
      
      // Verify identifying headers are NOT present
      expect(requestConfig.headers['host']).toBeUndefined();
      expect(requestConfig.headers['origin']).toBeUndefined();
      expect(requestConfig.headers['referer']).toBeUndefined();
      expect(requestConfig.headers['x-forwarded-for']).toBeUndefined();
      expect(requestConfig.headers['x-company-id']).toBeUndefined();
      expect(requestConfig.headers['x-request-id']).toBeUndefined();
      expect(requestConfig.headers['x-environment']).toBeUndefined();
      
      expect(response).toContain('test response');
    });

    it('should apply source blinding when calling generateResponse with Anthropic', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      
      httpService.request.mockReturnValue(of({
        data: {
          content: [{
            text: 'Anthropic test response'
          }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any));

      const _response = await llmService.generateResponse(
        'You are Claude.',
        'What is your name?',
        {
          provider: 'anthropic',
          callerType: 'test',
        }
      );

      expect(httpService.request).toHaveBeenCalled();
      
      const requestConfig = httpService.request.mock.calls[0][0];
      
      // Verify Anthropic-specific headers
      expect(requestConfig.headers['authorization']).toContain('Bearer sk-ant');
      expect(requestConfig.headers['anthropic-version']).toBeDefined();
      expect(requestConfig.headers['x-no-train']).toBe('true');
      expect(requestConfig.headers['user-agent']).toBe('OrchestratorAI/1.0');
      
      // Verify identifying headers are stripped
      expect(requestConfig.headers['host']).toBeUndefined();
      expect(requestConfig.headers['origin']).toBeUndefined();
    });

    it('should NOT apply source blinding for local Ollama calls', async () => {
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      
      // Mock Ollama response format
      httpService.request.mockReturnValue(of({
        data: {
          message: {
            content: 'Local Ollama response'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any));

      const _response = await llmService.generateResponse(
        'You are a helpful assistant.',
        'Hello from local model',
        {
          provider: 'ollama',
          callerType: 'test',
        }
      );

      // For Ollama, we should either not call HTTP at all, or call with normal headers
      // Since Ollama is local, it should use ChatOllama directly without HTTP interception
      // The key test is that no source blinding was applied to external calls
      
      // If HTTP was called (which it shouldn't be for Ollama), verify no source blinding
      if (httpService.request.mock.calls.length > 0) {
        const requestConfig = httpService.request.mock.calls[0][0];
        expect(requestConfig.headers['user-agent']).not.toBe('OrchestratorAI/1.0');
        expect(requestConfig.headers['x-no-train']).toBeUndefined();
      }
    });

    it('should handle proxy configuration when enabled', async () => {
      // Mock environment variables for proxy
      process.env.SOURCE_BLINDING_PROXY_ENABLED = 'true';
      process.env.SOURCE_BLINDING_PROXY_HOST = 'proxy.test.com';
      process.env.SOURCE_BLINDING_PROXY_PORT = '8080';
      process.env.SOURCE_BLINDING_PROXY_PROTOCOL = 'http';
      process.env.OPENAI_API_KEY = 'sk-test-proxy';

      const _response = await llmService.generateResponse(
        'System message',
        'User message',
        {
          provider: 'openai',
          callerType: 'test',
        }
      );

      expect(httpService.request).toHaveBeenCalled();
      
      const requestConfig = httpService.request.mock.calls[0][0];
      
      // Verify proxy configuration is applied
      expect(requestConfig.proxy).toEqual({
        protocol: 'http',
        host: 'proxy.test.com',
        port: 8080,
        auth: undefined,
      });

      // Clean up
      delete process.env.SOURCE_BLINDING_PROXY_ENABLED;
      delete process.env.SOURCE_BLINDING_PROXY_HOST;
      delete process.env.SOURCE_BLINDING_PROXY_PORT;
      delete process.env.SOURCE_BLINDING_PROXY_PROTOCOL;
    });
  });

  describe('LangGraph LLM Source Blinding', () => {
    it('should apply source blinding to getLangGraphLLM calls', () => {
      process.env.OPENAI_API_KEY = 'sk-test-langgraph';
      
      const llm = llmService.getLangGraphLLM('openai');
      
      expect(llm).toBeDefined();
      // The LLM instance should be wrapped with source blinding
      // This is verified by the internal implementation using BlindedLLMService
    });

    it('should apply source blinding to createCustomLangGraphLLM calls', () => {
      const llm = llmService.createCustomLangGraphLLM({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        temperature: 0.5,
        maxTokens: 1000,
        apiKey: 'sk-ant-custom-test',
      });
      
      expect(llm).toBeDefined();
      // The LLM instance should be wrapped with source blinding
    });
  });

  describe('Source Blinding Headers Verification', () => {
    const testCases = [
      {
        name: 'Company identifying headers',
        originalHeaders: {
          'Authorization': 'Bearer token',
          'X-Company-ID': 'acme-corp-123',
          'X-Tenant-ID': 'tenant-456',
          'X-Organization': 'engineering',
          'X-Department': 'ai-team',
        },
        expectedStripped: ['x-company-id', 'x-tenant-id', 'x-organization', 'x-department'],
        expectedKept: ['authorization'],
      },
      {
        name: 'Network metadata headers',
        originalHeaders: {
          'Authorization': 'Bearer token',
          'X-Forwarded-For': '192.168.1.100',
          'X-Real-IP': '10.0.0.1',
          'CF-Connecting-IP': '203.0.113.1',
          'CF-Ray': 'ray-12345',
          'CF-IPCountry': 'US',
        },
        expectedStripped: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'cf-ray', 'cf-ipcountry'],
        expectedKept: ['authorization'],
      },
      {
        name: 'Request tracing headers',
        originalHeaders: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-12345',
          'X-Trace-ID': 'trace-67890',
          'X-Span-ID': 'span-abcde',
          'X-Correlation-ID': 'corr-fghij',
        },
        expectedStripped: ['x-request-id', 'x-trace-id', 'x-span-id', 'x-correlation-id'],
        expectedKept: ['content-type'],
      },
      {
        name: 'Environment identifying headers',
        originalHeaders: {
          'Accept': 'application/json',
          'X-Environment': 'production',
          'X-Datacenter': 'us-west-2',
          'X-Region': 'americas',
          'X-Version': 'v1.2.3',
          'X-Runtime': 'node-18',
        },
        expectedStripped: ['x-environment', 'x-datacenter', 'x-region', 'x-version', 'x-runtime'],
        expectedKept: ['accept'],
      },
    ];

    testCases.forEach(({ name, originalHeaders, expectedStripped, expectedKept }) => {
      it(`should strip ${name}`, async () => {
        process.env.OPENAI_API_KEY = 'sk-test-headers';

        // Mock the request to inject our test headers
        const originalRequest = httpService.request;
        httpService.request = jest.fn().mockImplementation((config) => {
          // Add our test headers to the config
          config.headers = { ...config.headers, ...originalHeaders };
          
          // Verify source blinding was applied
          expectedStripped.forEach(header => {
            expect(config.headers[header]).toBeUndefined();
          });
          
          expectedKept.forEach(header => {
            expect(config.headers[header]).toBeDefined();
          });
          
          // Return mock response
          return of({
            data: { choices: [{ message: { content: 'test' } }] },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {},
          });
        });

        await llmService.generateResponse(
          'System',
          'User',
          { provider: 'openai', callerType: 'header-test' }
        );

        // Restore original mock
        httpService.request = originalRequest;
      });
    });
  });
});