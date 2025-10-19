import { Test, TestingModule } from '@nestjs/testing';
import { ApiAgentRunnerService } from './api-agent-runner.service';
import { HttpService } from '@nestjs/axios';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { AgentRuntimeDefinition } from '../../agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';

const createMockAxiosResponse = <T = unknown>(
  data: T,
  status = 200,
  statusText = 'OK',
): AxiosResponse<T> => ({
  data,
  status,
  statusText,
  headers: {},
  config: { headers: {} as never },
});

describe('ApiAgentRunnerService', () => {
  let service: ApiAgentRunnerService;
  let httpService: jest.Mocked<HttpService>;
  let deliverablesService: jest.Mocked<DeliverablesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiAgentRunnerService,
        {
          provide: HttpService,
          useValue: {
            request: jest.fn(),
          },
        },
        {
          provide: DeliverablesService,
          useValue: {
            executeAction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApiAgentRunnerService>(ApiAgentRunnerService);
    httpService = module.get(HttpService);
    deliverablesService = module.get(DeliverablesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute - BUILD mode with API call', () => {
    it('should execute GET request and save results', async () => {
      const definition = {
        slug: 'test-api-agent',
        displayName: 'Test API Agent',
        agentType: 'api',
        config: {
          api: {
            url: 'https://api.example.com/users',
            method: 'GET',
            headers: {
              'X-API-Key': 'secret-key',
            },
          },
          deliverable: {
            format: 'json',
            type: 'api-response',
          },
        },
        execution: {
          canBuild: true,
        },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Fetch users',
        payload: {
          title: 'User List',
        },
        metadata: {
          userId: 'user-123',
        },
      };

      // Mock HTTP response
      const httpResponse = createMockAxiosResponse([
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ]);

      httpService.request.mockReturnValue(of(httpResponse));

      // Mock deliverable creation
      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: {
          deliverable: { id: 'del-new', title: 'User List' },
          version: { id: 'ver-1', version: 1 },
        },
      });

      const result = await service.execute(definition, request, 'test-org');

      expect(result.success).toBe(true);
      expect(result.mode).toBe(AgentTaskMode.BUILD);

      // Verify HTTP call
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: expect.objectContaining({
          'X-API-Key': 'secret-key',
          'Content-Type': 'application/json',
        }) as Record<string, string>,
        data: undefined,
        params: {},
        timeout: 30000,
        validateStatus: expect.any(Function) as (status: number) => boolean,
      });

      // Verify deliverable creation
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deliverablesService.executeAction).toHaveBeenCalledWith(
        'create',
        expect.objectContaining({
          title: 'User List',
          format: 'json',
          type: 'api-response',
          agentName: 'test-api-agent',
          namespace: 'test-org',
        }),
        expect.objectContaining({
          conversationId: 'conv-123',
          userId: 'user-123',
        }),
      );
    });

    it('should execute POST request with body', async () => {
      const definition = {
        slug: 'test-api-agent',
        displayName: 'Test API Agent',
        agentType: 'api',
        config: {
          api: {
            url: 'https://api.example.com/users',
            method: 'POST',
            headers: {},
            body: {
              name: '{{payload.userName}}',
              email: '{{payload.userEmail}}',
            },
          },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Create user',
        payload: {
          userName: 'John Doe',
          userEmail: 'john@example.com',
        },
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of(
          createMockAxiosResponse(
            { id: 3, name: 'John Doe', email: 'john@example.com' },
            201,
            'Created',
          ),
        ),
      );

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      await service.execute(definition, request, null);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        }),
      );
    });

    it('should interpolate URL parameters', async () => {
      const definition = {
        slug: 'test-api-agent',
        displayName: 'Test API Agent',
        agentType: 'api',
        config: {
          api: {
            url: 'https://api.example.com/users/{{payload.userId}}',
            method: 'GET',
          },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Fetch user',
        payload: { userId: '42' },
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of({ status: 200, data: { id: 42 } }) as unknown,
      );

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      await service.execute(definition, request, null);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/42',
        }),
      );
    });

    it('should handle query parameters', async () => {
      const definition = {
        slug: 'test-api-agent',
        displayName: 'Test API Agent',
        agentType: 'api',
        config: {
          api: {
            url: 'https://api.example.com/users',
            method: 'GET',
            queryParams: {
              limit: '10',
              page: '{{payload.page}}',
            },
          },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Fetch users',
        payload: { page: '2' },
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of({ status: 200, data: [] }) as unknown,
      );

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      await service.execute(definition, request, null);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            limit: '10',
            page: '2',
          },
        }),
      );
    });
  });

  describe('execute - error handling', () => {
    it('should handle missing userId or conversationId', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: { api: { url: 'https://api.example.com' } },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        userMessage: 'Test',
        payload: {},
      };

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toContain(
        'Missing required userId or conversationId',
      );
    });

    it('should handle missing API configuration', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: {},
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: { userId: 'user-123' },
      };

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toContain(
        'No API configuration found',
      );
    });

    it('should handle HTTP request failure', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: {
          api: { url: 'https://api.example.com/users', method: 'GET' },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        throwError(() => new Error('Network error')) as unknown,
      );

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toContain('API call failed');
    });

    it('should handle non-2xx status codes when failOnError is true', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: {
          api: {
            url: 'https://api.example.com/users',
            method: 'GET',
            failOnError: true,
          },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of({
          status: 404,
          data: { error: 'Not found' },
        }) as unknown,
      );

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toContain(
        'API returned error status 404',
      );
    });

    it('should succeed with non-2xx when failOnError is false', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: {
          api: {
            url: 'https://api.example.com/users',
            method: 'GET',
            failOnError: false,
          },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of({
          status: 404,
          data: { error: 'Not found' },
        }) as unknown,
      );

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(true);
    });

    it('should handle deliverable creation failure', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: {
          api: { url: 'https://api.example.com/users', method: 'GET' },
          deliverable: { format: 'json', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of({ status: 200, data: {} }) as unknown,
      );

      deliverablesService.executeAction.mockResolvedValue({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create deliverable',
        },
      });

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toBe(
        'Failed to create deliverable',
      );
    });
  });

  describe('execute - markdown formatting', () => {
    it('should format response as markdown when configured', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: {
          api: { url: 'https://api.example.com/users', method: 'GET' },
          deliverable: { format: 'markdown', type: 'api-response' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: { userId: 'user-123' },
      };

      httpService.request.mockReturnValue(
        of({ status: 200, data: { users: [] } }) as unknown,
      );

      let capturedContent: string = '';
      deliverablesService.executeAction.mockImplementation(
        (action, params: { content: string }) => {
          capturedContent = params.content;
          return Promise.resolve({
            success: true,
            data: { deliverable: {}, version: {} },
          });
        },
      );

      await service.execute(definition, request, null);

      expect(capturedContent).toContain('# API Response');
      expect(capturedContent).toContain('**Status Code:** 200');
      expect(capturedContent).toContain('**Duration:**');
      expect(capturedContent).toContain('## Response Data');
    });
  });

  describe('execute - non-create actions', () => {
    it('should route read action to DeliverablesService', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'api',
        config: { api: { url: 'https://api.example.com' } },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Read deliverable',
        payload: {
          action: 'read',
          deliverableId: 'del-123',
        },
        metadata: { userId: 'user-123' },
      };

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { id: 'del-123', title: 'Test', content: 'Content' },
      });

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(true);
      expect(
        (result.payload?.content as Record<string, unknown> | undefined)?.id,
      ).toBe('del-123');

      // Should not call HTTP service for non-create actions
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(httpService.request).not.toHaveBeenCalled();
    });
  });
});
