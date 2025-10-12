import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationStepExecutorService } from './orchestration-step-executor.service';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationOutputMapper } from '@agent-platform/services/orchestration-output-mapper.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { AgentModeRouterService } from './agent-mode-router.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { OrchestrationRunRecord } from '@agent-platform/interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '@agent-platform/interfaces/orchestration-step-record.interface';

describe('OrchestrationStepExecutorService', () => {
  let service: OrchestrationStepExecutorService;
  let executionService: jest.Mocked<OrchestrationExecutionService>;
  let runnerService: jest.Mocked<OrchestrationRunnerService>;
  let checkpointService: jest.Mocked<OrchestrationCheckpointService>;
  let outputMapper: jest.Mocked<OrchestrationOutputMapper>;
  let agentRegistry: jest.Mocked<AgentRegistryService>;
  let runtimeDefinitions: jest.Mocked<AgentRuntimeDefinitionService>;
  let runtimeExecution: jest.Mocked<AgentRuntimeExecutionService>;
  let routingPolicy: jest.Mocked<RoutingPolicyAdapterService>;
  let modeRouter: jest.Mocked<AgentModeRouterService>;
  let conversations: jest.Mocked<Agent2AgentConversationsService>;

  const mockRun: OrchestrationRunRecord = {
    id: 'run-123',
    organization_slug: 'test-org',
    orchestration_name: 'kpi-tracking',
    status: 'running',
    parameters: { month: '2024-10' },
    results: {},
    created_at: '2025-10-12T00:00:00Z',
    updated_at: '2025-10-12T00:00:00Z',
  };

  const mockStep: OrchestrationStepRecord = {
    id: 'step-123',
    run_id: 'run-123',
    step_id: 'fetch-kpi-data',
    step_index: 0,
    agent_slug: 'supabase-agent',
    status: 'pending',
    depends_on: [],
    input: { userMessage: 'Fetch KPI data for {{ parameters.month }}' },
    output: null,
    deliverable_id: null,
    metadata: {},
    created_at: '2025-10-12T00:00:00Z',
    updated_at: '2025-10-12T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationStepExecutorService,
        {
          provide: OrchestrationExecutionService,
          useValue: {
            startExecution: jest.fn(),
            updateStepStatus: jest.fn(),
            completeStep: jest.fn(),
          },
        },
        {
          provide: OrchestrationRunnerService,
          useValue: {
            getRun: jest.fn(),
            updateRun: jest.fn(),
          },
        },
        {
          provide: OrchestrationCheckpointService,
          useValue: {
            requestCheckpoint: jest.fn(),
          },
        },
        {
          provide: OrchestrationOutputMapper,
          useValue: {
            map: jest.fn(),
          },
        },
        {
          provide: AgentRegistryService,
          useValue: {
            getAgent: jest.fn(),
          },
        },
        {
          provide: AgentRuntimeDefinitionService,
          useValue: {
            buildDefinitionMetadata: jest.fn(),
          },
        },
        {
          provide: AgentRuntimeExecutionService,
          useValue: {
            buildRunMetadata: jest.fn(),
          },
        },
        {
          provide: RoutingPolicyAdapterService,
          useValue: {
            resolve: jest.fn(),
          },
        },
        {
          provide: AgentModeRouterService,
          useValue: {
            route: jest.fn(),
          },
        },
        {
          provide: Agent2AgentConversationsService,
          useValue: {
            createConversation: jest.fn(),
            getConversationById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrchestrationStepExecutorService>(
      OrchestrationStepExecutorService,
    );
    executionService = module.get(OrchestrationExecutionService);
    runnerService = module.get(OrchestrationRunnerService);
    checkpointService = module.get(OrchestrationCheckpointService);
    outputMapper = module.get(OrchestrationOutputMapper);
    agentRegistry = module.get(AgentRegistryService);
    runtimeDefinitions = module.get(AgentRuntimeDefinitionService);
    runtimeExecution = module.get(AgentRuntimeExecutionService);
    routingPolicy = module.get(RoutingPolicyAdapterService);
    modeRouter = module.get(AgentModeRouterService);
    conversations = module.get(Agent2AgentConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processRun', () => {
    it('should process run with ready steps', async () => {
      executionService.startExecution
        .mockResolvedValueOnce({
          run: mockRun,
          readySteps: [mockStep],
        })
        .mockResolvedValueOnce({
          run: mockRun,
          readySteps: [],
        });

      agentRegistry.getAgent.mockResolvedValue({
        id: 'agent-id',
        slug: 'supabase-agent',
        displayName: 'Supabase Agent',
        organizationSlug: 'test-org',
      } as any);

      runtimeDefinitions.buildDefinitionMetadata.mockResolvedValue({
        agent: {
          id: 'agent-id',
          slug: 'supabase-agent',
          displayName: 'Supabase Agent',
          type: 'tool',
          organizationSlug: 'test-org',
        },
      } as any);

      runtimeExecution.buildRunMetadata.mockReturnValue({
        mode: 'build',
        stream: false,
        resolvedInput: { userMessage: 'Fetch KPI data for 2024-10' },
      } as any);

      routingPolicy.resolve.mockResolvedValue({
        taskRequest: {
          metadata: {},
          input: { userMessage: 'Fetch KPI data for 2024-10' },
          mode: 'build',
          conversationId: null,
        },
      } as any);

      modeRouter.route.mockResolvedValue({
        payload: {
          content: { rows: [{ metric: 'revenue', value: 150000 }] },
          metadata: {},
        },
        conversation: null,
      } as any);

      outputMapper.map.mockReturnValue({
        output: { query_results: [{ metric: 'revenue', value: 150000 }] },
        deliverableId: null,
        deliverableVersionId: null,
      });

      executionService.completeStep.mockResolvedValue({
        ...mockRun,
        results: { 'fetch-kpi-data': { query_results: [{ metric: 'revenue', value: 150000 }] } },
      });

      await service.processRun('run-123');

      expect(executionService.startExecution).toHaveBeenCalledTimes(2);
      expect(executionService.completeStep).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        expect.objectContaining({
          output: { query_results: [{ metric: 'revenue', value: 150000 }] },
        }),
      );
    });

    it('should prevent duplicate processing of same run', async () => {
      executionService.startExecution.mockResolvedValue({
        run: mockRun,
        readySteps: [],
      });

      const promise1 = service.processRun('run-123');
      const promise2 = service.processRun('run-123');

      await promise1;
      await promise2;

      expect(executionService.startExecution).toHaveBeenCalledTimes(1);
    });

    it('should halt on checkpoint', async () => {
      const stepWithCheckpoint: OrchestrationStepRecord = {
        ...mockStep,
        checkpoint: { type: 'manual', message: 'Review results' },
      };

      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [stepWithCheckpoint],
      });

      agentRegistry.getAgent.mockResolvedValue({
        id: 'agent-id',
        slug: 'supabase-agent',
        displayName: 'Supabase Agent',
        organizationSlug: 'test-org',
      } as any);

      runtimeDefinitions.buildDefinitionMetadata.mockResolvedValue({
        agent: { id: 'agent-id', slug: 'supabase-agent' },
      } as any);

      runtimeExecution.buildRunMetadata.mockReturnValue({
        mode: 'build',
        stream: false,
        resolvedInput: {},
      } as any);

      routingPolicy.resolve.mockResolvedValue({
        taskRequest: { metadata: {}, input: {}, mode: 'build', conversationId: null },
      } as any);

      modeRouter.route.mockResolvedValue({
        payload: { content: 'result', metadata: {} },
        conversation: null,
      } as any);

      outputMapper.map.mockReturnValue({
        output: { content: 'result' },
        deliverableId: null,
        deliverableVersionId: null,
      });

      checkpointService.requestCheckpoint.mockResolvedValue({
        decision: 'pending',
        run: mockRun,
      } as any);

      await service.processRun('run-123');

      expect(checkpointService.requestCheckpoint).toHaveBeenCalled();
      expect(executionService.startExecution).toHaveBeenCalledTimes(1);
    });

    it('should handle step execution failure gracefully', async () => {
      const failingStep: OrchestrationStepRecord = {
        ...mockStep,
        agent_slug: undefined,
      };

      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [failingStep],
      });

      executionService.updateStepStatus.mockResolvedValue({
        ...mockRun,
        status: 'failed',
      });

      runnerService.getRun.mockResolvedValue({
        ...mockRun,
        status: 'failed',
      });

      await service.processRun('run-123');

      expect(executionService.updateStepStatus).toHaveBeenCalledWith(
        'run-123',
        failingStep.id,
        'failed',
        expect.objectContaining({
          error: expect.stringContaining('missing agent'),
        }),
      );
    });
  });

  describe('placeholder resolution', () => {
    it('should resolve {{ parameters.field }} placeholders', () => {
      const run: OrchestrationRunRecord = {
        ...mockRun,
        parameters: { month: '2024-10', year: 2024 },
      };

      const resolvedInput = (service as any).resolveStepInput(mockStep, run);

      expect(resolvedInput).toEqual({
        userMessage: 'Fetch KPI data for {{ parameters.month }}',
      });
    });

    it('should resolve {{ steps.step-id.field }} placeholders', () => {
      const run: OrchestrationRunRecord = {
        ...mockRun,
        results: {
          'previous-step': {
            query_results: [{ metric: 'revenue', value: 150000 }],
          },
        },
      };

      const step: OrchestrationStepRecord = {
        ...mockStep,
        input: {
          userMessage: 'Summarize: {{ steps.previous-step.query_results }}',
        },
      };

      const resolvedInput = (service as any).resolveStepInput(step, run);

      expect(resolvedInput.userMessage).toContain('Summarize:');
    });

    it('should handle missing placeholder values', () => {
      const run: OrchestrationRunRecord = {
        ...mockRun,
        parameters: {},
      };

      const step: OrchestrationStepRecord = {
        ...mockStep,
        input: { userMessage: 'Value: {{ parameters.missing }}' },
      };

      const resolvedInput = (service as any).resolveStepInput(step, run);

      expect(resolvedInput.userMessage).toBe('Value: ');
    });

    it('should preserve structured data in standalone placeholders', () => {
      const run: OrchestrationRunRecord = {
        ...mockRun,
        parameters: {
          config: { nested: { value: 42 } },
        },
      };

      const step: OrchestrationStepRecord = {
        ...mockStep,
        input: { data: '{{ parameters.config }}' },
      };

      const resolvedInput = (service as any).resolveStepInput(step, run);

      expect(resolvedInput.data).toEqual({ nested: { value: 42 } });
    });
  });

  describe('checkpoint handling', () => {
    it('should trigger checkpoint with correct options', async () => {
      const stepWithCheckpoint: OrchestrationStepRecord = {
        ...mockStep,
        checkpoint: {
          type: 'manual',
          message: 'Review the query results before summarizing',
        },
        metadata: { name: 'Fetch Data' },
      };

      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [stepWithCheckpoint],
      });

      agentRegistry.getAgent.mockResolvedValue({
        id: 'agent-id',
        slug: 'supabase-agent',
      } as any);

      runtimeDefinitions.buildDefinitionMetadata.mockResolvedValue({
        agent: { id: 'agent-id', slug: 'supabase-agent' },
      } as any);

      runtimeExecution.buildRunMetadata.mockReturnValue({
        mode: 'build',
        stream: false,
        resolvedInput: {},
      } as any);

      routingPolicy.resolve.mockResolvedValue({
        taskRequest: { metadata: {}, input: {}, mode: 'build', conversationId: null },
      } as any);

      modeRouter.route.mockResolvedValue({
        payload: { content: 'result', metadata: {} },
        conversation: null,
      } as any);

      outputMapper.map.mockReturnValue({
        output: { content: 'result' },
        deliverableId: null,
        deliverableVersionId: null,
      });

      checkpointService.requestCheckpoint.mockResolvedValue({
        decision: 'pending',
        run: mockRun,
      } as any);

      await service.processRun('run-123');

      expect(checkpointService.requestCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          stepId: 'fetch-kpi-data',
          stepLabel: 'Fetch Data',
          organizationSlug: 'test-org',
        }),
      );
    });

    it('should continue execution after checkpoint approval', async () => {
      checkpointService.requestCheckpoint.mockResolvedValue({
        decision: 'approved',
        run: mockRun,
      } as any);

      const stepWithCheckpoint: OrchestrationStepRecord = {
        ...mockStep,
        checkpoint: { type: 'manual' },
      };

      executionService.startExecution
        .mockResolvedValueOnce({
          run: mockRun,
          readySteps: [stepWithCheckpoint],
        })
        .mockResolvedValueOnce({
          run: mockRun,
          readySteps: [],
        });

      agentRegistry.getAgent.mockResolvedValue({ id: 'agent-id', slug: 'supabase-agent' } as any);
      runtimeDefinitions.buildDefinitionMetadata.mockResolvedValue({
        agent: { id: 'agent-id', slug: 'supabase-agent' },
      } as any);
      runtimeExecution.buildRunMetadata.mockReturnValue({
        mode: 'build',
        stream: false,
        resolvedInput: {},
      } as any);
      routingPolicy.resolve.mockResolvedValue({
        taskRequest: { metadata: {}, input: {}, mode: 'build', conversationId: null },
      } as any);
      modeRouter.route.mockResolvedValue({
        payload: { content: 'result', metadata: {} },
        conversation: null,
      } as any);
      outputMapper.map.mockReturnValue({
        output: { content: 'result' },
        deliverableId: null,
        deliverableVersionId: null,
      });
      executionService.completeStep.mockResolvedValue(mockRun);

      await service.processRun('run-123');

      expect(executionService.startExecution).toHaveBeenCalledTimes(2);
      expect(executionService.completeStep).toHaveBeenCalled();
    });
  });

  describe('output mapping integration', () => {
    it('should apply output_mapping to agent response', async () => {
      const stepWithMapping: OrchestrationStepRecord = {
        ...mockStep,
        output_mapping: {
          query_results: '$.content.rows',
          summary: '$.content.summary',
        },
      };

      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [stepWithMapping],
      });

      agentRegistry.getAgent.mockResolvedValue({
        id: 'agent-id',
        slug: 'supabase-agent',
      } as any);

      runtimeDefinitions.buildDefinitionMetadata.mockResolvedValue({
        agent: { id: 'agent-id', slug: 'supabase-agent' },
      } as any);

      runtimeExecution.buildRunMetadata.mockReturnValue({
        mode: 'build',
        stream: false,
        resolvedInput: {},
      } as any);

      routingPolicy.resolve.mockResolvedValue({
        taskRequest: { metadata: {}, input: {}, mode: 'build', conversationId: null },
      } as any);

      modeRouter.route.mockResolvedValue({
        payload: {
          content: {
            rows: [{ metric: 'revenue', value: 150000 }],
            summary: 'Query executed successfully',
          },
          metadata: {},
        },
        conversation: null,
      } as any);

      outputMapper.map.mockReturnValue({
        output: {
          query_results: [{ metric: 'revenue', value: 150000 }],
          summary: 'Query executed successfully',
        },
        deliverableId: null,
        deliverableVersionId: null,
      });

      executionService.completeStep.mockResolvedValue(mockRun);
      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [],
      });

      await service.processRun('run-123');

      expect(outputMapper.map).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            rows: [{ metric: 'revenue', value: 150000 }],
            summary: 'Query executed successfully',
          },
        }),
        {
          query_results: '$.content.rows',
          summary: '$.content.summary',
        },
      );
    });

    it('should store deliverable reference when present', async () => {
      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [mockStep],
      });

      agentRegistry.getAgent.mockResolvedValue({ id: 'agent-id', slug: 'supabase-agent' } as any);
      runtimeDefinitions.buildDefinitionMetadata.mockResolvedValue({
        agent: { id: 'agent-id', slug: 'supabase-agent' },
      } as any);
      runtimeExecution.buildRunMetadata.mockReturnValue({
        mode: 'build',
        stream: false,
        resolvedInput: {},
      } as any);
      routingPolicy.resolve.mockResolvedValue({
        taskRequest: { metadata: {}, input: {}, mode: 'build', conversationId: null },
      } as any);
      modeRouter.route.mockResolvedValue({
        payload: { content: 'result', metadata: {} },
        conversation: null,
      } as any);

      outputMapper.map.mockReturnValue({
        output: { content: 'result' },
        deliverableId: 'deliv-123',
        deliverableVersionId: 'ver-456',
      });

      executionService.completeStep.mockResolvedValue(mockRun);
      executionService.startExecution.mockResolvedValueOnce({
        run: mockRun,
        readySteps: [],
      });

      await service.processRun('run-123');

      expect(executionService.completeStep).toHaveBeenCalledWith(
        'run-123',
        'step-123',
        expect.objectContaining({
          deliverable_id: 'deliv-123',
        }),
      );
    });
  });
});
