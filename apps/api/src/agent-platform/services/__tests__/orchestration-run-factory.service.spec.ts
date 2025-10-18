import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrchestrationRunFactoryService } from '../orchestration-run-factory.service';
import { OrchestrationRunnerService } from '../orchestration-runner.service';
import { OrchestrationStateService } from '../orchestration-state.service';
import { OrchestrationExecutionService } from '../orchestration-execution.service';
import { OrchestrationEventsService } from '../orchestration-events.service';
import { OrchestrationMetricsService } from '../orchestration-metrics.service';
import { OrchestrationResolvedDefinition } from '../../types/orchestration-definition.types';
import { OrchestrationRunRecord } from '../../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../../interfaces/orchestration-step-record.interface';

describe('OrchestrationRunFactoryService', () => {
  let service: OrchestrationRunFactoryService;
  let mockRunner: jest.Mocked<OrchestrationRunnerService>;
  let mockState: jest.Mocked<OrchestrationStateService>;
  let mockExecution: jest.Mocked<OrchestrationExecutionService>;
  let mockEvents: jest.Mocked<OrchestrationEventsService>;

  const mockDefinition: OrchestrationResolvedDefinition = {
    recordId: 'def-123',
    name: 'test-orchestration',
    displayName: 'Test Orchestration',
    version: '1.0.0',
    organizationSlug: 'global',
    ownerAgentSlug: 'orchestrator',
    description: 'Test orchestration',
    steps: [
      {
        id: 'step-1',
        name: 'First Step',
        agent: 'agent-1',
        type: 'agent',
        mode: 'BUILD',
        input: {},
        metadata: {},
      },
    ],
    parameters: [],
    rawDefinition: {},
  };

  const mockRunRecord: OrchestrationRunRecord = {
    id: 'run-123',
    orchestration_definition_id: 'def-123',
    orchestration_name: 'test-orchestration',
    plan_id: null,
    conversation_id: null,
    parent_orchestration_run_id: null,
    origin_type: 'plan',
    origin_id: null,
    orchestration_slug: null,
    organization_slug: 'global',
    parameters: {},
    plan: {},
    metadata: {},
    status: 'pending',
    current_step_id: null,
    current_step_index: 0,
    human_checkpoint_id: null,
    step_state: {},
    results: {},
    completed_steps: [],
    error_details: {},
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
    created_by: null,
  };

  const mockStepRecords: OrchestrationStepRecord[] = [
    {
      id: 'step-rec-1',
      orchestration_run_id: 'run-123',
      step_id: 'step-1',
      step_index: 0,
      status: 'pending',
      agent_slug: 'agent-1',
      mode: 'BUILD',
      input: {},
      output: null,
      metadata: {},
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
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationRunFactoryService,
        {
          provide: OrchestrationRunnerService,
          useValue: {
            startRun: jest.fn(),
            updateRun: jest.fn(),
            listSteps: jest.fn(),
          },
        },
        {
          provide: OrchestrationStateService,
          useValue: {
            initializeRun: jest.fn(),
          },
        },
        {
          provide: OrchestrationExecutionService,
          useValue: {
            startExecution: jest.fn(),
          },
        },
        {
          provide: OrchestrationEventsService,
          useValue: {
            emitRunCreated: jest.fn(),
          },
        },
        {
          provide: OrchestrationMetricsService,
          useValue: {
            recordRunCreated: jest.fn(),
            recordRunStarted: jest.fn(),
            recordStepStarted: jest.fn(),
            recordStepCompleted: jest.fn(),
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

    service = module.get<OrchestrationRunFactoryService>(
      OrchestrationRunFactoryService,
    );
    mockRunner = module.get(OrchestrationRunnerService);
    mockState = module.get(OrchestrationStateService);
    mockExecution = module.get(OrchestrationExecutionService);
    mockEvents = module.get(OrchestrationEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRunFromDefinition', () => {
    it('should create a new orchestration run with minimal options', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      const result = await service.createRunFromDefinition({
        definition: mockDefinition,
        agent: {
          slug: 'orchestrator',
        },
      });

      expect(result).toEqual({
        run: executionResult.run,
        steps: mockStepRecords,
        readySteps: mockStepRecords,
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          orchestrationDefinitionId: 'def-123',
          orchestrationName: 'test-orchestration',
          organizationSlug: 'global',
          agentSlug: 'orchestrator',
        }),
      );

      expect(mockState.initializeRun).toHaveBeenCalledWith(
        mockRunRecord,
        mockDefinition,
        {},
      );

      expect(mockEvents.emitRunCreated).toHaveBeenCalledWith(planningRun, {
        totalSteps: 1,
      });

      expect(mockExecution.startExecution).toHaveBeenCalledWith(
        'run-123',
        expect.any(Object),
      );
    });

    it('should include parent run metadata for child orchestrations', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        parentRunId: 'parent-run-123',
        agent: {
          slug: 'orchestrator',
        },
        metadata: {
          parent: {
            runId: 'parent-run-123',
            stepRecordId: 'parent-step-123',
          },
        },
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          parentOrchestrationRunId: 'parent-run-123',
          metadata: expect.objectContaining({
            parent: {
              runId: 'parent-run-123',
              stepRecordId: 'parent-step-123',
            },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should include task link metadata when provided', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        agent: {
          slug: 'orchestrator',
        },
        taskLink: {
          id: 'task-123',
          userId: 'user-456',
        },
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            task: {
              id: 'task-123',
              userId: 'user-456',
            },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should pass parameters through to run and step initialization', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };
      const params = {
        kpi_names: ['revenue', 'costs'],
        start_date: '2025-01-01',
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        parameters: params,
        agent: {
          slug: 'orchestrator',
        },
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: params,
        }),
      );

      expect(mockState.initializeRun).toHaveBeenCalledWith(
        mockRunRecord,
        mockDefinition,
        params,
      );
    });

    it('should build plan snapshot with step metadata', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        agent: {
          slug: 'orchestrator',
        },
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: {
            name: 'test-orchestration',
            steps: [
              {
                id: 'step-1',
                agent: 'agent-1',
                type: 'agent',
                mode: 'BUILD',
              },
            ],
          },
        }),
      );
    });

    it('should update run to planning status with progress stats', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        agent: {
          slug: 'orchestrator',
        },
      });

      expect(mockRunner.updateRun).toHaveBeenCalledWith({
        runId: 'run-123',
        status: 'planning',
        currentStepIndex: 0,
        currentStepId: 'step-1',
        metadata: expect.objectContaining({
          lifecycle: 'initialized',
          stats: {
            totalSteps: 1,
            completedSteps: 0,
            progressPercentage: 0,
          },
        }) as Record<string, unknown>,
      });
    });

    it('should handle multiple steps in definition', async () => {
      const multiStepDefinition: OrchestrationResolvedDefinition = {
        ...mockDefinition,
        steps: [
          mockDefinition.steps[0]!,
          {
            id: 'step-2',
            name: 'Second Step',
            agent: 'agent-2',
            type: 'agent',
            mode: 'BUILD',
            input: {},
            metadata: {},
          },
          {
            id: 'step-3',
            name: 'Third Step',
            agent: 'agent-3',
            type: 'agent',
            mode: 'BUILD',
            input: {},
            metadata: {},
          },
        ],
      };

      const multiStepRecords: OrchestrationStepRecord[] = [
        mockStepRecords[0]!,
        {
          ...mockStepRecords[0]!,
          id: 'step-rec-2',
          step_id: 'step-2',
          step_index: 1,
        },
        {
          ...mockStepRecords[0]!,
          id: 'step-rec-3',
          step_id: 'step-3',
          step_index: 2,
        },
      ];

      const planningRun = { ...mockRunRecord, status: 'planning' };
      const firstStep = multiStepRecords[0];
      if (!firstStep) throw new Error('Missing first step');
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: [firstStep],
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(multiStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(multiStepRecords);

      const result = await service.createRunFromDefinition({
        definition: multiStepDefinition,
        agent: {
          slug: 'orchestrator',
        },
      });

      expect(result.steps).toHaveLength(3);
      expect(mockEvents.emitRunCreated).toHaveBeenCalledWith(planningRun, {
        totalSteps: 3,
      });
    });

    it('should include agent metadata in run metadata', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        agent: {
          id: 'agent-456',
          slug: 'orchestrator',
          type: 'orchestrator',
          displayName: 'Test Orchestrator',
        },
        organizationSlug: 'custom-org',
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-456',
          agentSlug: 'orchestrator',
          agentType: 'orchestrator',
          agentDisplayName: 'Test Orchestrator',
          organizationSlug: 'custom-org',
          metadata: expect.objectContaining({
            agent: {
              id: 'agent-456',
              slug: 'orchestrator',
              type: 'orchestrator',
              displayName: 'Test Orchestrator',
              organizationSlug: 'custom-org',
            },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should handle empty steps array', async () => {
      const emptyDefinition: OrchestrationResolvedDefinition = {
        ...mockDefinition,
        steps: [],
      };

      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: [],
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue([]);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue([]);

      const result = await service.createRunFromDefinition({
        definition: emptyDefinition,
        agent: {
          slug: 'orchestrator',
        },
      });

      expect(result.steps).toHaveLength(0);
      expect(result.readySteps).toHaveLength(0);

      expect(mockRunner.updateRun).toHaveBeenCalledWith({
        runId: 'run-123',
        status: 'planning',
        currentStepIndex: 0,
        currentStepId: null,
        metadata: expect.objectContaining({
          stats: {
            totalSteps: 0,
            completedSteps: 0,
            progressPercentage: null,
          },
        }) as Record<string, unknown>,
      });
    });

    it('should include request metadata when provided', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };
      const requestMetadata = {
        triggeredBy: 'api',
        source: 'test-suite',
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      await service.createRunFromDefinition({
        definition: mockDefinition,
        agent: {
          slug: 'orchestrator',
        },
        requestMetadata,
      });

      expect(mockRunner.startRun).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            requestMetadata,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should support all origin types', async () => {
      const planningRun = { ...mockRunRecord, status: 'planning' };
      const executionResult = {
        run: { ...planningRun, status: 'running' },
        readySteps: mockStepRecords,
      };

      mockRunner.startRun.mockResolvedValue(mockRunRecord);
      mockState.initializeRun.mockResolvedValue(mockStepRecords);
      mockRunner.updateRun.mockResolvedValue(planningRun);
      mockExecution.startExecution.mockResolvedValue(executionResult);
      mockRunner.listSteps.mockResolvedValue(mockStepRecords);

      const origins: Array<'plan' | 'saved_orchestration' | 'ad_hoc'> = [
        'plan',
        'saved_orchestration',
        'ad_hoc',
      ];

      for (const originType of origins) {
        await service.createRunFromDefinition({
          definition: mockDefinition,
          agent: {
            slug: 'orchestrator',
          },
          originType,
          originId: `origin-${originType}`,
        });

        expect(mockRunner.startRun).toHaveBeenCalledWith(
          expect.objectContaining({
            originType,
            originId: `origin-${originType}`,
          }),
        );

        jest.clearAllMocks();
        mockRunner.startRun.mockResolvedValue(mockRunRecord);
        mockState.initializeRun.mockResolvedValue(mockStepRecords);
        mockRunner.updateRun.mockResolvedValue(planningRun);
        mockExecution.startExecution.mockResolvedValue(executionResult);
        mockRunner.listSteps.mockResolvedValue(mockStepRecords);
      }
    });
  });
});
