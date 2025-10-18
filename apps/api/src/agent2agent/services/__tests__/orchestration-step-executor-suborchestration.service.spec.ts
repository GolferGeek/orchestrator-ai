import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { OrchestrationStepExecutorService } from '../orchestration-step-executor.service';
import { OrchestrationExecutionService } from '@agent-platform/services/orchestration-execution.service';
import { OrchestrationRunnerService } from '@agent-platform/services/orchestration-runner.service';
import { OrchestrationCacheService } from '@agent-platform/services/orchestration-cache.service';
import { OrchestrationDefinitionService } from '@agent-platform/services/orchestration-definition.service';
import { OrchestrationCheckpointService } from '@agent-platform/services/orchestration-checkpoint.service';
import { OrchestrationOutputMapper } from '@agent-platform/services/orchestration-output-mapper.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { RoutingPolicyAdapterService } from '../routing-policy-adapter.service';
import { AgentModeRouterService } from '../agent-mode-router.service';
import { Agent2AgentConversationsService } from '../agent-conversations.service';
import { OrchestrationRunFactoryService } from '@agent-platform/services/orchestration-run-factory.service';
import { OrchestrationRunRecord } from '@agent-platform/interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '@agent-platform/interfaces/orchestration-step-record.interface';
import { OrchestrationResolvedDefinition } from '@agent-platform/types/orchestration-definition.types';

describe('OrchestrationStepExecutorService - Sub-Orchestration', () => {
  let service: OrchestrationStepExecutorService;
  let mockExecution: jest.Mocked<OrchestrationExecutionService>;
  let mockRunner: jest.Mocked<OrchestrationRunnerService>;
  let mockDefinitionService: jest.Mocked<OrchestrationDefinitionService>;
  let mockRunFactory: jest.Mocked<OrchestrationRunFactoryService>;
  let mockAgentRegistry: jest.Mocked<AgentRegistryService>;
  let _mockEventEmitter: jest.Mocked<EventEmitter2>;

  const mockParentRun: OrchestrationRunRecord = {
    id: 'parent-run-123',
    orchestration_definition_id: 'parent-def-123',
    orchestration_name: 'parent-orchestration',
    plan_id: null,
    conversation_id: 'conv-123',
    parent_orchestration_run_id: null,
    origin_type: 'plan',
    origin_id: null,
    orchestration_slug: null,
    organization_slug: 'global',
    parameters: {
      kpi_names: ['revenue'],
      start_date: '2025-01-01',
      end_date: '2025-03-31',
    },
    plan: {},
    metadata: {
      agent: { slug: 'finance-manager' },
    },
    status: 'running',
    current_step_id: 'run-kpi-tracking',
    current_step_index: 0,
    human_checkpoint_id: null,
    step_state: {},
    results: {},
    completed_steps: [],
    error_details: {},
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: null,
    updated_at: new Date().toISOString(),
    created_by: 'user-123',
  };

  const mockOrchestrationStep: OrchestrationStepRecord = {
    id: 'step-rec-123',
    orchestration_run_id: 'parent-run-123',
    step_id: 'run-kpi-tracking',
    step_index: 0,
    status: 'pending',
    agent_slug: 'finance-manager',
    mode: 'ORCHESTRATION',
    input: {},
    output: null,
    metadata: {
      type: 'orchestration',
      orchestration: {
        name: 'kpi-tracking',
        version: '1.0.0',
        owner: 'finance-manager',
        inherit_conversation: true,
        parameters: {
          kpi_names: '{{ parameters.kpi_names }}',
          start_date: '{{ parameters.start_date }}',
          end_date: '{{ parameters.end_date }}',
        },
      },
    },
    attempt_number: 1,
    conversation_id: null,
    plan_id: null,
    deliverable_id: null,
    error_details: null,
    depends_on: [],
    checkpoint_decision: null,
    checkpoint_decided_by: null,
    checkpoint_decided_at: null,
    invalidated_at: null,
    invalidated_reason: null,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  };

  const mockChildDefinition: OrchestrationResolvedDefinition = {
    recordId: 'child-def-123',
    name: 'kpi-tracking',
    displayName: 'KPI Tracking',
    version: '1.0.0',
    organizationSlug: 'global',
    ownerAgentSlug: 'finance-manager',
    description: 'Track KPIs',
    steps: [
      {
        id: 'fetch-data',
        name: 'Fetch Data',
        agent: 'supabase-agent',
        type: 'agent',
        mode: 'BUILD',
        input: {},
        metadata: {},
      },
    ],
    parameters: [],
    rawDefinition: {},
  };

  const mockChildRun: OrchestrationRunRecord = {
    id: 'child-run-456',
    orchestration_definition_id: 'child-def-123',
    orchestration_name: 'kpi-tracking',
    plan_id: null,
    conversation_id: 'conv-123',
    parent_orchestration_run_id: 'parent-run-123',
    origin_type: 'plan',
    origin_id: null,
    orchestration_slug: null,
    organization_slug: 'global',
    parameters: {
      kpi_names: ['revenue'],
      start_date: '2025-01-01',
      end_date: '2025-03-31',
    },
    plan: {},
    metadata: {},
    status: 'completed',
    current_step_id: null,
    current_step_index: 0,
    human_checkpoint_id: null,
    step_state: {},
    results: {
      'fetch-data': { kpi_data: [{ name: 'revenue', value: 100000 }] },
    },
    completed_steps: ['fetch-data'],
    error_details: {},
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'user-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationStepExecutorService,
        {
          provide: OrchestrationExecutionService,
          useValue: {
            startExecution: jest.fn(),
            markStepRunning: jest.fn(),
            markStepCompleted: jest.fn(),
            markStepFailed: jest.fn(),
          },
        },
        {
          provide: OrchestrationRunnerService,
          useValue: {
            getRun: jest.fn(),
            updateRun: jest.fn(),
            updateStep: jest.fn(),
            listSteps: jest.fn(),
          },
        },
        {
          provide: OrchestrationCacheService,
          useValue: {
            getRunCache: jest.fn(),
            setRunCache: jest.fn(),
            clearRunCache: jest.fn(),
          },
        },
        {
          provide: OrchestrationDefinitionService,
          useValue: {
            getDefinitionForExecution: jest.fn(),
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
            buildDefinition: jest.fn(),
          },
        },
        {
          provide: AgentRuntimeExecutionService,
          useValue: {
            getAgentMetadataFromDefinition: jest.fn(),
            buildRunMetadata: jest.fn(),
          },
        },
        {
          provide: RoutingPolicyAdapterService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: AgentModeRouterService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: Agent2AgentConversationsService,
          useValue: {
            createConversation: jest.fn(),
          },
        },
        {
          provide: OrchestrationRunFactoryService,
          useValue: {
            createRunFromDefinition: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrchestrationStepExecutorService>(
      OrchestrationStepExecutorService,
    );
    mockExecution = module.get(OrchestrationExecutionService);
    mockRunner = module.get(OrchestrationRunnerService);
    mockDefinitionService = module.get(OrchestrationDefinitionService);
    mockRunFactory = module.get(OrchestrationRunFactoryService);
    mockAgentRegistry = module.get(AgentRegistryService);
    _mockEventEmitter = module.get(EventEmitter2);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeSubOrchestrationStep', () => {
    it('should successfully execute a child orchestration to completion', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };
      const completedChildRun = {
        ...mockChildRun,
        status: 'completed' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
        agent_type: 'orchestrator',
        display_name: 'Finance Manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'running' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue(completedChildRun);
      mockExecution.markStepCompleted.mockResolvedValue({
        run: { ...mockParentRun, status: 'running' as const },
        step: { ...runningStep, status: 'completed' as const },
        nextSteps: [],
      });

      const result = await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(result.status).toBe('completed');
      expect(
        mockDefinitionService.getDefinitionForExecution,
      ).toHaveBeenCalledWith({
        ownerAgentSlug: 'finance-manager',
        organizationSlug: 'global',
        name: 'kpi-tracking',
        version: '1.0.0',
      });

      expect(mockRunFactory.createRunFromDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          definition: mockChildDefinition,
          parameters: {
            kpi_names: ['revenue'],
            start_date: '2025-01-01',
            end_date: '2025-03-31',
          },
          conversationId: 'conv-123',
          parentRunId: 'parent-run-123',
        }),
      );

      expect(mockExecution.markStepCompleted).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          orchestrationRunId: 'child-run-456',
          status: 'completed',
          results: mockChildRun.results,
        }),
        expect.any(Object),
      );
    });

    it('should interpolate child parameters from parent run', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
        agent_type: 'orchestrator',
        display_name: 'Finance Manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'completed' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue({
        ...mockChildRun,
        status: 'completed' as const,
      });
      mockExecution.markStepCompleted.mockResolvedValue({
        run: mockParentRun,
        step: runningStep,
        nextSteps: [],
      });

      await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(mockRunFactory.createRunFromDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: {
            kpi_names: ['revenue'],
            start_date: '2025-01-01',
            end_date: '2025-03-31',
          },
        }),
      );
    });

    it('should inherit conversation when configured', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'completed' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue({
        ...mockChildRun,
        status: 'completed' as const,
      });
      mockExecution.markStepCompleted.mockResolvedValue({
        run: mockParentRun,
        step: runningStep,
        nextSteps: [],
      });

      await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(mockRunFactory.createRunFromDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-123',
        }),
      );
    });

    it('should not inherit conversation when inherit_conversation is false', async () => {
      const stepWithoutInheritance: OrchestrationStepRecord = {
        ...mockOrchestrationStep,
        metadata: {
          ...mockOrchestrationStep.metadata,
          orchestration: {
            ...(mockOrchestrationStep.metadata as any).orchestration,
            inherit_conversation: false,
          },
        },
      };

      const runningStep = {
        ...stepWithoutInheritance,
        status: 'running' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'completed' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue({
        ...mockChildRun,
        status: 'completed' as const,
      });
      mockExecution.markStepCompleted.mockResolvedValue({
        run: mockParentRun,
        step: runningStep,
        nextSteps: [],
      });

      await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        stepWithoutInheritance,
      );

      expect(mockRunFactory.createRunFromDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: null,
        }),
      );
    });

    it('should fail step when child orchestration definition not found', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockRejectedValue(
        new Error('Definition not found'),
      );

      mockExecution.markStepFailed.mockResolvedValue({
        run: { ...mockParentRun, status: 'failed' as const },
        step: { ...runningStep, status: 'failed' as const },
      });

      mockRunner.getRun.mockResolvedValue({
        ...mockParentRun,
        status: 'failed' as const,
      });

      const result = await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(result.status).toBe('failed');
      expect(mockExecution.markStepFailed).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          message: expect.stringContaining(
            'Failed to resolve sub-orchestration definition',
          ),
        }),
      );
    });

    it('should fail step when orchestration name is missing', async () => {
      const stepWithoutName: OrchestrationStepRecord = {
        ...mockOrchestrationStep,
        metadata: {
          ...mockOrchestrationStep.metadata,
          orchestration: {
            ...(mockOrchestrationStep.metadata as any).orchestration,
            name: undefined,
          },
        },
      };

      const runningStep = { ...stepWithoutName, status: 'running' as const };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockExecution.markStepFailed.mockResolvedValue({
        run: { ...mockParentRun, status: 'failed' as const },
        step: { ...runningStep, status: 'failed' as const },
      });
      mockRunner.getRun.mockResolvedValue({
        ...mockParentRun,
        status: 'failed' as const,
      });

      const result = await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        stepWithoutName,
      );

      expect(result.status).toBe('failed');
      expect(mockExecution.markStepFailed).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          message: 'Sub-orchestration step missing orchestration name',
        }),
      );
    });

    it('should fail step when owner agent slug cannot be resolved', async () => {
      const stepWithoutOwner: OrchestrationStepRecord = {
        ...mockOrchestrationStep,
        agent_slug: null,
        metadata: {
          ...mockOrchestrationStep.metadata,
          orchestration: {
            ...(mockOrchestrationStep.metadata as any).orchestration,
            owner: undefined,
          },
        },
      };

      const runningStep = { ...stepWithoutOwner, status: 'running' as const };
      const parentWithoutAgent = { ...mockParentRun, metadata: {} };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockExecution.markStepFailed.mockResolvedValue({
        run: { ...parentWithoutAgent, status: 'failed' as const },
        step: { ...runningStep, status: 'failed' as const },
      });
      mockRunner.getRun.mockResolvedValue({
        ...parentWithoutAgent,
        status: 'failed' as const,
      });

      const result = await (service as any).executeSubOrchestrationStep(
        parentWithoutAgent,
        stepWithoutOwner,
      );

      expect(result.status).toBe('failed');
      expect(mockExecution.markStepFailed).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          message: 'Sub-orchestration step missing owner agent slug',
        }),
      );
    });

    it('should fail step when owner agent not found in registry', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue(null);

      mockExecution.markStepFailed.mockResolvedValue({
        run: { ...mockParentRun, status: 'failed' as const },
        step: { ...runningStep, status: 'failed' as const },
      });
      mockRunner.getRun.mockResolvedValue({
        ...mockParentRun,
        status: 'failed' as const,
      });

      const result = await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(result.status).toBe('failed');
      expect(mockExecution.markStepFailed).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          message: 'Orchestrator agent finance-manager not found',
        }),
      );
    });

    it('should fail step when child orchestration fails', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };
      const failedChildRun = {
        ...mockChildRun,
        status: 'failed' as const,
        error_details: { message: 'Child orchestration failed' },
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'running' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue(failedChildRun);
      mockExecution.markStepFailed.mockResolvedValue({
        run: { ...mockParentRun, status: 'failed' as const },
        step: { ...runningStep, status: 'failed' as const },
      });

      const result = await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(result.status).toBe('failed');
      expect(mockExecution.markStepFailed).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          type: 'child_orchestration_failed',
          childRunId: 'child-run-456',
          status: 'failed',
        }),
      );
    });

    it('should fail step when child orchestration is aborted', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };
      const abortedChildRun = {
        ...mockChildRun,
        status: 'aborted' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'running' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue(abortedChildRun);
      mockExecution.markStepFailed.mockResolvedValue({
        run: { ...mockParentRun, status: 'failed' as const },
        step: { ...runningStep, status: 'failed' as const },
      });

      const result = await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(result.status).toBe('failed');
      expect(mockExecution.markStepFailed).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          type: 'child_orchestration_aborted',
        }),
      );
    });

    it('should include child run metadata in step metadata', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };
      const completedChildRun = {
        ...mockChildRun,
        status: 'completed' as const,
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'running' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue(completedChildRun);
      mockExecution.markStepCompleted.mockResolvedValue({
        run: mockParentRun,
        step: runningStep,
        nextSteps: [],
      });

      await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      // Metadata with completedAt + status should be passed to markStepCompleted
      expect(mockExecution.markStepCompleted).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          orchestrationRunId: 'child-run-456',
          status: 'completed',
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            runtime: expect.objectContaining({
              subOrchestration: expect.objectContaining({
                childRunId: 'child-run-456',
                completedAt: expect.any(String),
                status: 'completed',
              }),
            }),
          }),
        }),
      );
    });

    it('should build correct child run output structure', async () => {
      const runningStep = {
        ...mockOrchestrationStep,
        status: 'running' as const,
      };
      const completedChildRun = {
        ...mockChildRun,
        status: 'completed' as const,
        results: {
          'fetch-data': { kpi_data: [{ name: 'revenue', value: 100000 }] },
          summarize: { summary: 'All KPIs trending up' },
        },
        completed_steps: ['fetch-data', 'summarize'],
      };

      mockExecution.markStepRunning.mockResolvedValue(runningStep);
      mockDefinitionService.getDefinitionForExecution.mockResolvedValue(
        mockChildDefinition,
      );
      mockAgentRegistry.getAgent.mockResolvedValue({
        id: 'agent-123',
        slug: 'finance-manager',
      } as any);

      mockRunFactory.createRunFromDefinition.mockResolvedValue({
        run: { ...mockChildRun, status: 'running' as const },
        steps: [],
        readySteps: [],
      });

      mockRunner.getRun.mockResolvedValue(completedChildRun);
      mockExecution.markStepCompleted.mockResolvedValue({
        run: mockParentRun,
        step: runningStep,
        nextSteps: [],
      });

      await (service as any).executeSubOrchestrationStep(
        mockParentRun,
        mockOrchestrationStep,
      );

      expect(mockExecution.markStepCompleted).toHaveBeenCalledWith(
        runningStep.id,
        expect.objectContaining({
          orchestrationRunId: 'child-run-456',
          status: 'completed',
          results: completedChildRun.results,
          completedSteps: ['fetch-data', 'summarize'],
          parameters: completedChildRun.parameters,
        }),
        expect.any(Object),
      );
    });
  });
});
