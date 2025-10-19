import { Test, TestingModule } from '@nestjs/testing';
import { ContextAgentRunnerService } from './context-agent-runner.service';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { LLMService } from '@llm/llm.service';
import { PlansService } from '../plans/services/plans.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { ActionResult } from '../common/interfaces/action-handler.interface';

describe('ContextAgentRunnerService', () => {
  let service: ContextAgentRunnerService;
  let contextOptimization: jest.Mocked<ContextOptimizationService>;
  let llmService: jest.Mocked<LLMService>;
  let plansService: jest.Mocked<PlansService>;
  let deliverablesService: jest.Mocked<DeliverablesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextAgentRunnerService,
        {
          provide: ContextOptimizationService,
          useValue: {
            optimizeContext: jest.fn(),
          },
        },
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
        {
          provide: PlansService,
          useValue: {
            executeAction: jest.fn(),
            findByConversationId: jest.fn(),
          },
        },
        {
          provide: DeliverablesService,
          useValue: {
            executeAction: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: Agent2AgentConversationsService,
          useValue: {
            findByConversationId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContextAgentRunnerService>(ContextAgentRunnerService);
    contextOptimization = module.get(ContextOptimizationService);
    llmService = module.get(LLMService);
    plansService = module.get(PlansService);
    deliverablesService = module.get(DeliverablesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute - BUILD mode with create action', () => {
    it('should fetch context, call LLM, and create deliverable', async () => {
      // Arrange
      const definition = {
        slug: 'test-context-agent',
        displayName: 'Test Context Agent',
        agentType: 'context',
        context: { instructions: 'Test agent instructions' },
        config: {
          context: {
            sources: ['plans', 'deliverables'],
            systemPromptTemplate:
              'Context: {{plan.content}}\n\nDeliverables: {{deliverables}}',
            tokenBudget: 8000,
          },
          deliverable: {
            format: 'markdown',
            type: 'document',
          },
        },
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          temperature: 0.7,
          maxTokens: 2000,
        },
        capabilities: ['converse', 'plan', 'build'],
        execution: {
          canConverse: true,
          canPlan: true,
          canBuild: true,
        },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Generate analysis',
        payload: {
          title: 'Test Analysis',
          action: 'create',
        },
        metadata: {
          userId: 'user-123',
        },
      };

      const planData = {
        content: 'Test plan content',
      };

      const optimizedContext = [
        {
          role: 'user',
          content: 'Previous message',
          timestamp: '2025-01-01T00:00:00Z',
        },
      ];

      const llmResponse = {
        content: 'Generated analysis content',
        metadata: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          usage: {
            inputTokens: 100,
            outputTokens: 200,
          },
        },
      };

      const deliverableResult: ActionResult = {
        success: true,
        data: {
          deliverable: {
            id: 'del-new',
            title: 'Test Analysis',
            content: 'Generated analysis content',
          },
          version: {
            id: 'ver-1',
            version: 1,
          },
          isNew: true,
        },
      };

      // Mock service responses
      plansService.findByConversationId.mockResolvedValue({
        id: 'plan-123',
        title: 'Test Plan',
        content: 'Test plan content',
        currentVersion: {
          id: 'ver-1',
          content: 'Test plan content',
        },
      } as Record<string, unknown>);

      plansService.executeAction.mockResolvedValue({
        success: true,
        data: planData,
      });

      deliverablesService.executeAction.mockResolvedValue(deliverableResult);

      contextOptimization.optimizeContext.mockResolvedValue(optimizedContext);
      llmService.generateResponse.mockResolvedValue(llmResponse);

      // Act
      const result = await service.execute(definition, request, 'test-org');

      // Assert
      expect(result.success).toBe(true);
      expect(result.mode).toBe(AgentTaskMode.BUILD);
      expect(
        (result.payload?.content as Record<string, unknown> | undefined)
          ?.deliverable,
      ).toEqual(deliverableResult.data.deliverable);
      expect(
        (result.payload?.content as Record<string, unknown> | undefined)
          ?.version,
      ).toEqual(deliverableResult.data.version);
      expect(result.payload?.metadata?.provider).toBe('anthropic');

      // Verify service calls
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(plansService.findByConversationId).toHaveBeenCalledWith(
        'conv-123',
        'user-123',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Test plan content'),
        'Generate analysis',
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 2000,
          provider: 'anthropic',
          conversationId: 'conv-123',
          userId: 'user-123',
        }),
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deliverablesService.executeAction).toHaveBeenCalledWith(
        'create',
        expect.objectContaining({
          title: 'Test Analysis',
          content: 'Generated analysis content',
          format: 'markdown',
          type: 'document',
          agentName: 'Test Context Agent',
        }),
        expect.objectContaining({
          conversationId: 'conv-123',
          userId: 'user-123',
          agentSlug: 'test-context-agent',
        }),
      );
    });

    it('should handle missing userId or conversationId', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'context',
        capabilities: ['build'],
        execution: { canConverse: false, canPlan: false, canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        userMessage: 'Test',
        payload: {},
      };

      const result = await service.execute(definition, request, null);

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toContain(
        'User identity is required for build execution',
      );
    });

    it('should handle LLM service errors', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'context',
        config: {
          context: {
            sources: [],
          },
        },
        capabilities: ['build'],
        execution: { canConverse: false, canPlan: false, canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: {
          userId: 'user-123',
        },
      };

      plansService.findByConversationId.mockResolvedValue(null);
      contextOptimization.optimizeContext.mockResolvedValue([]);
      llmService.generateResponse.mockRejectedValue(
        new Error('LLM service unavailable'),
      );

      const result = await service.execute(definition, request, 'test-org');

      expect(result.success).toBe(false);
      expect(result.payload?.metadata?.reason).toContain(
        'LLM service unavailable',
      );
    });

    it('should handle deliverable creation failure', async () => {
      const definition = {
        slug: 'test-agent',
        displayName: 'Test Agent',
        agentType: 'context',
        config: {
          context: {
            sources: [],
          },
        },
        capabilities: ['build'],
        execution: { canConverse: false, canPlan: false, canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Test',
        payload: {},
        metadata: {
          userId: 'user-123',
        },
      };

      contextOptimization.optimizeContext.mockResolvedValue([]);
      llmService.generateResponse.mockResolvedValue({
        content: 'Test content',
        metadata: {},
      });

      deliverablesService.executeAction.mockResolvedValue({
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create deliverable',
        },
      });

      const result = await service.execute(definition, request, 'test-org');

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
        agentType: 'context',
        capabilities: ['build'],
        execution: { canConverse: false, canPlan: false, canBuild: true },
      } as unknown as AgentRuntimeDefinition;

      const request: TaskRequestDto = {
        mode: AgentTaskMode.BUILD,
        conversationId: 'conv-123',
        userMessage: 'Read deliverable',
        payload: {
          action: 'read',
          deliverableId: 'del-123',
        },
        metadata: {
          userId: 'user-123',
        },
      };

      // Mock finding existing deliverable by conversation
      deliverablesService.executeAction.mockResolvedValue({
        success: true,
        data: {
          deliverables: [{ id: 'del-123' }],
        },
      });

      // Mock findOne to return the deliverable
      deliverablesService.findOne.mockResolvedValue({
        id: 'del-123',
        title: 'Test Deliverable',
        content: 'Test content',
        format: 'markdown',
        type: 'document' as string,
        agentName: 'test-agent',
        userId: 'user-123',
        conversationId: 'conv-123',
        currentVersion: {
          id: 'ver-1',
          versionNumber: 1,
          content: 'Test content',
        } as Record<string, unknown>,
      } as Record<string, unknown>);

      const result = await service.execute(definition, request, 'test-org');

      expect(result.success).toBe(true);
      expect(
        (
          (result.payload?.content as Record<string, unknown> | undefined)
            ?.deliverable as Record<string, unknown> | undefined
        )?.id,
      ).toBe('del-123');

      // Deliverable is fetched by conversation context
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deliverablesService.findOne).toHaveBeenCalledWith(
        'del-123',
        'user-123',
      );
    });
  });
});
