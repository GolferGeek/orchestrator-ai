import { Test, TestingModule } from '@nestjs/testing';
import { ToolAgentRunnerService } from './tool-agent-runner.service';
import { MCPService } from '../../mcp/mcp.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { AgentRuntimeDefinition } from '../../agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { ActionResult } from '../common/interfaces/action-handler.interface';

describe('ToolAgentRunnerService', () => {
  let service: ToolAgentRunnerService;
  let mcpService: jest.Mocked<MCPService>;
  let deliverablesService: jest.Mocked<DeliverablesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolAgentRunnerService,
        {
          provide: MCPService,
          useValue: {
            callTool: jest.fn(),
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

    service = module.get<ToolAgentRunnerService>(ToolAgentRunnerService);
    mcpService = module.get(MCPService);
    deliverablesService = module.get(DeliverablesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute - BUILD mode with sequential tool execution', () => {
    it('should execute tools sequentially and save results', async () => {
      const definition = {
        slug: 'test-tool-agent',
        displayName: 'Test Tool Agent',
        agentType: 'tool',
        config: {
          tools: ['supabase/query', 'slack/post-message'],
          toolParams: {
            'supabase/query': { table: 'users', limit: 10 },
            'slack/post-message': { channel: '#general', text: 'Hello' },
          },
          deliverable: {
            format: 'json',
            type: 'tool-result',
          },
        },
        execution: {
          canConverse: false,
          canPlan: false,
          canBuild: true,
        },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Execute tools',
        payload: {
          title: 'Tool Execution Test',
        },
        metadata: {
          userId: 'user-123',
        },
      };

      // Mock MCP tool responses
      mcpService.callTool
        .mockResolvedValueOnce({
          isError: false,
          content: [
            { type: 'text', text: JSON.stringify([{ id: 1, name: 'User 1' }]) },
          ],
        })
        .mockResolvedValueOnce({
          isError: false,
          content: [{ type: 'text', text: 'Message posted successfully' }],
        });

      // Mock deliverable creation
      const deliverableResult: ActionResult = {
        success: true,
        data: {
          deliverable: {
            id: 'del-new',
            title: 'Tool Execution Test',
            content: expect.any(String) as string,
          },
          version: {
            id: 'ver-1',
            version: 1,
          },
        },
      };

      deliverablesService.executeAction.mockResolvedValue(deliverableResult);

      // Execute
      const result = await service.execute(definition, request, 'test-org');

      // Assert
      expect(result.success).toBe(true);
      expect(result.mode).toBe(AgentTaskMode.BUILD);

      // Verify MCP tool calls
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenNthCalledWith(1, {
        name: 'supabase/query',
        arguments: { table: 'users', limit: 10 },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenNthCalledWith(2, {
        name: 'slack/post-message',
        arguments: { channel: '#general', text: 'Hello' },
      });

      // Verify deliverable creation
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deliverablesService.executeAction).toHaveBeenCalledWith(
        'create',
        expect.objectContaining({
          title: 'Tool Execution Test',
          format: 'json',
          type: 'tool-result',
          agentName: 'test-tool-agent',
          namespace: 'test-org',
        }),
        expect.objectContaining({
          conversationId: 'conv-123',
          userId: 'user-123',
          agentSlug: 'test-tool-agent',
        }),
      );
    });

    it('should stop on first error when stopOnError is true (default)', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['tool-1', 'tool-2', 'tool-3'],
          toolParams: {},
          deliverable: { format: 'json', type: 'tool-result' },
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

      // First tool succeeds, second fails
      mcpService.callTool
        .mockResolvedValueOnce({
          isError: false,
          content: [{ type: 'text', text: 'Success 1' }],
        })
        .mockResolvedValueOnce({
          isError: true,
          content: [{ type: 'text', text: 'Tool error' }],
        });

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      const result = await service.execute(definition, request, null);

      // Should only call 2 tools (stopped on error)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.payload?.metadata?.failedTools).toBe(1);
    });

    it('should continue on error when stopOnError is false', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['tool-1', 'tool-2', 'tool-3'],
          toolParams: {},
          stopOnError: false,
          deliverable: { format: 'json', type: 'tool-result' },
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

      // Second tool fails but execution continues
      mcpService.callTool
        .mockResolvedValueOnce({
          isError: false,
          content: [{ type: 'text', text: 'Success 1' }],
        })
        .mockResolvedValueOnce({
          isError: true,
          content: [{ type: 'text', text: 'Tool error' }],
        })
        .mockResolvedValueOnce({
          isError: false,
          content: [{ type: 'text', text: 'Success 3' }],
        });

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      const result = await service.execute(definition, request, null);

      // Should call all 3 tools
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.payload?.metadata?.successfulTools).toBe(2);
      expect(result.payload?.metadata?.failedTools).toBe(1);
    });
  });

  describe('execute - BUILD mode with parallel tool execution', () => {
    it('should execute tools in parallel', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['tool-1', 'tool-2', 'tool-3'],
          toolParams: {},
          toolExecutionMode: 'parallel',
          deliverable: { format: 'json', type: 'tool-result' },
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

      mcpService.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'Success' }],
      });

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenCalledTimes(3);
      expect(result.payload?.metadata?.executionMode).toBe('parallel');
      expect(result.payload?.metadata?.successfulTools).toBe(3);
    });

    it('should handle parallel execution with some failures', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['tool-1', 'tool-2', 'tool-3'],
          toolParams: {},
          toolExecutionMode: 'parallel',
          deliverable: { format: 'json', type: 'tool-result' },
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

      mcpService.callTool
        .mockResolvedValueOnce({
          isError: false,
          content: [{ type: 'text', text: 'Success' }],
        })
        .mockRejectedValueOnce(new Error('Tool failed'))
        .mockResolvedValueOnce({
          isError: false,
          content: [{ type: 'text', text: 'Success' }],
        });

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(true);
      expect(result.payload?.metadata?.successfulTools).toBe(2);
      expect(result.payload?.metadata?.failedTools).toBe(1);
    });
  });

  describe('execute - BUILD mode with parameter interpolation', () => {
    it('should interpolate request data into tool parameters', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['supabase/query'],
          toolParams: {
            'supabase/query': {
              table: '{{payload.tableName}}',
              id: '{{payload.recordId}}',
            },
          },
          deliverable: { format: 'json', type: 'tool-result' },
        },
        execution: { canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {
          tableName: 'users',
          recordId: '42',
        },
        metadata: { userId: 'user-123' },
      };

      mcpService.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: '{"id":42,"name":"User"}' }],
      });

      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: { deliverable: {}, version: {} },
      });

      await service.execute(definition, request, null);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).toHaveBeenCalledWith({
        name: 'supabase/query',
        arguments: {
          table: 'users',
          id: '42',
        },
      });
    });
  });

  describe('execute - BUILD mode with markdown formatting', () => {
    it('should format results as markdown when configured', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['tool-1'],
          toolParams: {},
          deliverable: { format: 'markdown', type: 'tool-result' },
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

      mcpService.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'Success' }],
      });

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

      expect(capturedContent).toContain('# Tool Execution Results');
      expect(capturedContent).toContain('## tool-1');
      expect(capturedContent).toContain('✅ Success');
    });
  });

  describe('execute - BUILD mode error handling', () => {
    it('should handle missing userId or conversationId', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: { tools: ['tool-1'] },
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

    it('should handle no tools configured', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: { tools: [] },
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
      expect(result.payload?.metadata?.reason).toContain('No tools configured');
    });

    it('should handle deliverable creation failure', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: {
          tools: ['tool-1'],
          toolParams: {},
          deliverable: { format: 'json', type: 'tool-result' },
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

      mcpService.callTool.mockResolvedValue({
        isError: false,
        content: [{ type: 'text', text: 'Success' }],
      });

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

  describe('execute - BUILD mode with non-create actions', () => {
    it('should route read action to DeliverablesService', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'tool',
        config: { tools: ['tool-1'] },
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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deliverablesService.executeAction).toHaveBeenCalledWith(
        'read',
        expect.objectContaining({ action: 'read', deliverableId: 'del-123' }),
        expect.objectContaining({
          conversationId: 'conv-123',
          userId: 'user-123',
          agentSlug: 'test-agent',
        }),
      );

      // Should not call MCP service for non-create actions
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcpService.callTool).not.toHaveBeenCalled();
    });
  });
});
