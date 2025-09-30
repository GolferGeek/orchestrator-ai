import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import {
  SourceBlindingService,
  SourceBlindingConfig,
} from './source-blinding.service';
import { AxiosResponse } from 'axios';

describe('SourceBlindingService', () => {
  let service: SourceBlindingService;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockHttpService = {
      request: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceBlindingService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<SourceBlindingService>(SourceBlindingService);
    httpService = module.get(HttpService);
  });

  describe('blindRequest', () => {
    it('should strip identifying headers from request', () => {
      const originalConfig = {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
          'User-Agent': 'MyApp/1.0',
          Host: 'internal.company.com',
          Origin: 'https://company.com',
          Referer: 'https://company.com/dashboard',
          'X-Forwarded-For': '192.168.1.100',
          'X-Company-ID': 'company-123',
          'X-Request-ID': 'req-456',
          'X-Environment': 'production',
        },
      };

      const blindedRequest = service.blindRequest(originalConfig, {
        provider: 'openai',
        noTrain: true,
        noRetain: false,
      });

      // Should keep essential headers
      expect(blindedRequest.headers['authorization']).toBe('Bearer sk-test');
      expect(blindedRequest.headers['content-type']).toBe('application/json');
      expect(blindedRequest.headers['x-no-train']).toBe('true');

      // Should strip identifying headers
      expect(blindedRequest.headers['host']).toBeUndefined();
      expect(blindedRequest.headers['origin']).toBeUndefined();
      expect(blindedRequest.headers['referer']).toBeUndefined();
      expect(blindedRequest.headers['x-forwarded-for']).toBeUndefined();
      expect(blindedRequest.headers['x-company-id']).toBeUndefined();
      expect(blindedRequest.headers['x-request-id']).toBeUndefined();
      expect(blindedRequest.headers['x-environment']).toBeUndefined();

      // Should have custom user agent
      expect(blindedRequest.headers['user-agent']).toBe('OrchestratorAI/1.0');

      // Should track stripped headers
      expect(blindedRequest.strippedHeaders).toContain('host');
      expect(blindedRequest.strippedHeaders).toContain('origin');
      expect(blindedRequest.strippedHeaders).toContain('referer');
      expect(blindedRequest.strippedHeaders).toContain('x-forwarded-for');
      expect(blindedRequest.strippedHeaders).toContain('x-company-id');
      expect(blindedRequest.strippedHeaders).toContain('x-request-id');
      expect(blindedRequest.strippedHeaders).toContain('x-environment');

      expect(blindedRequest.sourceBlindingApplied).toBe(true);
    });

    it('should add provider-specific headers', () => {
      const originalConfig = {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
        },
      };

      const blindedRequest = service.blindRequest(originalConfig, {
        provider: 'openai',
        noTrain: true,
        noRetain: true,
        policyProfile: 'strict',
        dataClass: 'confidential',
        sovereignMode: 'true',
      });

      expect(blindedRequest.headers['x-no-train']).toBe('true');
      expect(blindedRequest.headers['x-no-retain']).toBe('true');
      expect(blindedRequest.headers['x-policy-profile']).toBe('strict');
      expect(blindedRequest.headers['x-data-class']).toBe('confidential');
      expect(blindedRequest.headers['x-sovereign-mode']).toBe('true');
    });

    it('should preserve essential API headers', () => {
      const originalConfig = {
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-ant-test',
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': 'key-123',
          accept: 'application/json',
        },
      };

      const blindedRequest = service.blindRequest(originalConfig, {
        provider: 'anthropic',
      });

      expect(blindedRequest.headers['authorization']).toBe(
        'Bearer sk-ant-test',
      );
      expect(blindedRequest.headers['content-type']).toBe('application/json');
      expect(blindedRequest.headers['anthropic-version']).toBe('2023-06-01');
      expect(blindedRequest.headers['x-api-key']).toBe('key-123');
      expect(blindedRequest.headers['accept']).toBe('application/json');
    });
  });

  describe('makeBlindedRequest', () => {
    it('should make request with blinded headers', async () => {
      const mockResponse: AxiosResponse = {
        data: { choices: [{ message: { content: 'Test response' } }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any;

      httpService.request.mockReturnValue(of(mockResponse));

      const config = {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-test',
          Host: 'internal.company.com',
          Origin: 'https://company.com',
        },
        data: { model: 'gpt-4', messages: [] },
      };

      const _result = await service.makeBlindedRequest(config, {
        provider: 'openai',
        noTrain: true,
      });

      expect(result).toBe(mockResponse);

      // Verify the request was made with blinded headers
      const requestConfig = httpService.request.mock.calls[0][0];
      expect(requestConfig.headers['authorization']).toBe('Bearer sk-test');
      expect(requestConfig.headers['x-no-train']).toBe('true');
      expect(requestConfig.headers['host']).toBeUndefined();
      expect(requestConfig.headers['origin']).toBeUndefined();
    });

    it('should apply proxy configuration when enabled', async () => {
      // Update config to enable proxy
      service.updateConfig({
        stripIdentifyingHeaders: true,
        stripReferrer: true,
        useCustomUserAgent: true,
        customUserAgent: 'OrchestratorAI/1.0',
        stripNetworkMetadata: true,
        allowedHeaders: ['authorization', 'content-type'],
        blockedHeaders: ['host', 'origin'],
        proxyConfig: {
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          protocol: 'http',
          auth: {
            username: 'user',
            password: 'pass',
          },
        },
      });

      const mockResponse: AxiosResponse = {
        data: { test: 'response' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any;

      httpService.request.mockReturnValue(of(mockResponse));

      const config = {
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: { Authorization: 'Bearer sk-test' },
      };

      await service.makeBlindedRequest(config, { provider: 'openai' });

      const requestConfig = httpService.request.mock.calls[0][0];
      expect(requestConfig.proxy).toEqual({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user',
          password: 'pass',
        },
      });
    });
  });

  describe('createBlindedHttpClient', () => {
    it('should create axios instance with source blinding interceptors', () => {
      const client = service.createBlindedHttpClient('openai', {
        provider: 'openai',
        policyProfile: 'standard',
      });

      expect(client).toBeDefined();
      expect(client.defaults.transformRequest).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return configuration statistics', () => {
      const stats = service.getStats();

      expect(stats).toEqual({
        allowedHeaders: expect.any(Number),
        blockedHeaders: expect.any(Number),
        customUserAgent: 'OrchestratorAI/1.0',
        proxyEnabled: false,
        config: expect.any(Object),
      });
    });
  });

  describe('testSourceBlinding', () => {
    it('should demonstrate header stripping', () => {
      const originalHeaders = {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
        Host: 'internal.company.com',
        Origin: 'https://company.com',
        'X-Company-ID': 'company-123',
      };

      const _result = service.testSourceBlinding(originalHeaders, 'openai');

      expect(result.originalHeaders).toEqual(originalHeaders);
      expect(result.blindedHeaders['authorization']).toBe('Bearer token');
      expect(result.blindedHeaders['content-type']).toBe('application/json');
      expect(result.blindedHeaders['host']).toBeUndefined();
      expect(result.blindedHeaders['origin']).toBeUndefined();
      expect(result.blindedHeaders['x-company-id']).toBeUndefined();
      expect(result.strippedHeaders).toContain('host');
      expect(result.strippedHeaders).toContain('origin');
      expect(result.strippedHeaders).toContain('x-company-id');
    });
  });
});
