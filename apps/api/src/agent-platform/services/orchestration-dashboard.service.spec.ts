import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationDashboardService } from './orchestration-dashboard.service';
import { OrchestrationRunsRepository } from '../repositories/orchestration-runs.repository';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import { OrchestrationEventsService } from './orchestration-events.service';
import { OrchestrationStatusService } from './orchestration-status.service';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationCheckpointService } from './orchestration-checkpoint.service';
import { OrchestrationDefinitionService } from './orchestration-definition.service';
import { OrchestrationExecutionService } from './orchestration-execution.service';
import { OrchestrationStepExecutorService } from '@/agent2agent/services/orchestration-step-executor.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { HumanApprovalRecord } from '../interfaces/human-approval-record.interface';
import { OrchestrationRunSnapshot } from '../types/orchestration-events.types';

function createMockSnapshot(overrides: Partial<OrchestrationRunSnapshot> = {}): OrchestrationRunSnapshot {
  return {
    id: 'run-test',
    status: 'running',
    name: null,
    definitionId: null,
    planId: null,
    parentRunId: null,
    organizationSlug: null,
    conversationId: null,
    completedSteps: [],
    humanCheckpointId: null,
    plan: {},
    results: {},
    parameters: {},
    errorDetails: {},
    metadata: {},
    agent: { id: null, slug: 'test-agent', displayName: null, type: null },
    stats: { totalSteps: 0, completedSteps: 0 },
    timings: {
      createdAt: '2025-10-12T10:00:00Z',
      updatedAt: '2025-10-12T10:00:00Z',
      startedAt: null,
      completedAt: null,
    },
    currentStepId: null,
    currentStepIndex: null,
    ...overrides,
  };
}

describe('OrchestrationDashboardService', () => {
  let service: OrchestrationDashboardService;
  let runsRepo: jest.Mocked<OrchestrationRunsRepository>;
  let approvalsRepo: jest.Mocked<HumanApprovalsRepository>;
  let eventsService: jest.Mocked<OrchestrationEventsService>;
  let statusService: jest.Mocked<OrchestrationStatusService>;
  let runnerService: jest.Mocked<OrchestrationRunnerService>;
  let checkpointService: jest.Mocked<OrchestrationCheckpointService>;
  let definitionService: jest.Mocked<OrchestrationDefinitionService>;
  let executionService: jest.Mocked<OrchestrationExecutionService>;
  let stepExecutorService: jest.Mocked<OrchestrationStepExecutorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationDashboardService,
        {
          provide: OrchestrationRunsRepository,
          useValue: {
            list: jest.fn(),
            listByIds: jest.fn(),
          },
        },
        {
          provide: HumanApprovalsRepository,
          useValue: {
            countPendingByRunIds: jest.fn(),
            list: jest.fn(),
          },
        },
        {
          provide: OrchestrationEventsService,
          useValue: {
            snapshotRun: jest.fn(),
            emitRunFailed: jest.fn(),
          },
        },
        {
          provide: OrchestrationStatusService,
          useValue: {
            getRunStatus: jest.fn(),
          },
        },
        {
          provide: OrchestrationRunnerService,
          useValue: {
            getRun: jest.fn(),
            listSteps: jest.fn(),
            updateStep: jest.fn(),
            updateRun: jest.fn(),
            getStep: jest.fn(),
          },
        },
        {
          provide: OrchestrationCheckpointService,
          useValue: {
            resolveCheckpoint: jest.fn(),
          },
        },
        {
          provide: OrchestrationDefinitionService,
          useValue: {
            getDefinitionById: jest.fn(),
          },
        },
        {
          provide: OrchestrationExecutionService,
          useValue: {
            markStepCompleted: jest.fn(),
          },
        },
        {
          provide: OrchestrationStepExecutorService,
          useValue: {
            processRun: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrchestrationDashboardService>(
      OrchestrationDashboardService,
    );
    runsRepo = module.get(OrchestrationRunsRepository);
    approvalsRepo = module.get(HumanApprovalsRepository);
    eventsService = module.get(OrchestrationEventsService);
    statusService = module.get(OrchestrationStatusService);
    runnerService = module.get(OrchestrationRunnerService);
    checkpointService = module.get(OrchestrationCheckpointService);
    definitionService = module.get(OrchestrationDefinitionService);
    executionService = module.get(OrchestrationExecutionService);
    stepExecutorService = module.get(OrchestrationStepExecutorService);
  });

  describe('listRuns', () => {
    it('should return paginated runs with active lifecycle filter', async () => {
      const mockRuns: OrchestrationRunRecord[] = [
        {
          id: 'run-1',
          status: 'running',
          orchestration_name: 'Test Orchestration',
          organization_slug: 'test-org',
          created_at: '2025-10-12T10:00:00Z',
          orchestration_definition_id: 'def-1',
          orchestration_slug: 'test-orch',
        } as OrchestrationRunRecord,
      ];

      runsRepo.list.mockResolvedValue({
        data: mockRuns,
        count: 1,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 2 });

      eventsService.snapshotRun.mockReturnValue({
        id: 'run-1',
        status: 'running',
        name: 'Test Orchestration',
        definitionId: 'def-1',
        planId: null,
        parentRunId: null,
        organizationSlug: 'test-org',
        conversationId: null,
        completedSteps: [],
        humanCheckpointId: null,
        plan: {},
        results: {},
        parameters: {},
        errorDetails: {},
        metadata: {},
        agent: { id: 'agent-1', slug: 'test-agent', displayName: 'Test Agent', type: 'orchestrator' },
        stats: { totalSteps: 5, completedSteps: 2 },
        timings: { createdAt: '2025-10-12T10:00:00Z', updatedAt: '2025-10-12T10:00:00Z', startedAt: null, completedAt: null },
        currentStepId: 'step-1',
        currentStepIndex: 0,
      });

      const result = await service.listRuns({ lifecycle: 'active' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.id).toBe('run-1');
      expect(result.items[0]!.pendingApprovals).toBe(2);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(runsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: ['pending', 'planning', 'running', 'checkpoint'],
        }),
      );
    });

    it('should return paginated runs with completed lifecycle filter', async () => {
      const mockRuns: OrchestrationRunRecord[] = [
        {
          id: 'run-2',
          status: 'completed',
          orchestration_name: 'Completed Orchestration',
          organization_slug: 'test-org',
          created_at: '2025-10-12T09:00:00Z',
          orchestration_definition_id: 'def-2',
        } as OrchestrationRunRecord,
      ];

      runsRepo.list.mockResolvedValue({
        data: mockRuns,
        count: 1,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({
        id: 'run-2',
        status: 'completed',
        name: 'Completed Orchestration',
        definitionId: 'def-2',
        organizationSlug: 'test-org',
        agent: { id: 'agent-2', slug: 'test-agent-2', displayName: 'Test Agent 2', type: 'orchestrator' },
        stats: { totalSteps: 3, completedSteps: 3 },
        timings: { createdAt: '2025-10-12T09:00:00Z', updatedAt: '2025-10-12T09:10:00Z', startedAt: '2025-10-12T09:01:00Z', completedAt: '2025-10-12T09:10:00Z' },
      }));

      const result = await service.listRuns({ lifecycle: 'completed' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.status).toBe('completed');
      expect(runsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: ['completed', 'failed', 'cancelled', 'canceled', 'aborted'],
        }),
      );
    });

    it('should support search filtering', async () => {
      runsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      await service.listRuns({ search: 'finance' });

      expect(runsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'finance',
        }),
      );
    });

    it('should support organizationSlug filtering', async () => {
      runsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      await service.listRuns({ organizationSlug: 'acme-corp' });

      expect(runsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationSlug: 'acme-corp',
        }),
      );
    });

    it('should support definitionId filtering', async () => {
      runsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      await service.listRuns({ definitionId: 'def-123' });

      expect(runsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          definitionId: 'def-123',
        }),
      );
    });

    it('should support parentRunId filtering', async () => {
      runsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      await service.listRuns({ parentRunId: 'parent-run-1' });

      expect(runsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          parentRunId: 'parent-run-1',
        }),
      );
    });

    it('should calculate hasMore correctly when more results exist', async () => {
      const mockRuns = Array.from({ length: 25 }, (_, i) => ({
        id: `run-${i}`,
        status: 'running',
        created_at: '2025-10-12T10:00:00Z',
      })) as OrchestrationRunRecord[];

      runsRepo.list.mockResolvedValue({
        data: mockRuns,
        count: 100,
        limit: 25,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      eventsService.snapshotRun.mockImplementation((run) => createMockSnapshot({
        id: run.id,
        status: run.status,
        timings: { createdAt: run.created_at, updatedAt: run.created_at, startedAt: null, completedAt: null },
      }));

      const result = await service.listRuns({ limit: 25, offset: 0 });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(100);
    });
  });

  describe('getRunDetail', () => {
    it('should return full run detail with related data', async () => {
      const mockRunRecord = {
        id: 'run-1',
        status: 'running',
        orchestration_name: 'Test Run',
        organization_slug: 'test-org',
        created_at: '2025-10-12T10:00:00Z',
        orchestration_definition_id: 'def-1',
        parent_orchestration_run_id: 'parent-1',
        metadata: {
          lastCheckpoint: {
            approvalId: 'approval-1',
            checkpointId: 'checkpoint-1',
            requestedAt: '2025-10-12T10:15:00Z',
            step: { label: 'Review Step' },
          },
        },
      } as unknown as OrchestrationRunRecord;

      const mockStatus = {
        run: { id: 'run-1', status: 'running', name: 'Test Run' },
        steps: [],
        currentStep: null,
        summary: { totalSteps: 5, completedSteps: 2, progressPercentage: 40, pendingApprovals: 1 },
        pendingApprovals: [],
      };

      statusService.getRunStatus.mockResolvedValue(mockStatus as any);
      runnerService.getRun.mockResolvedValue(mockRunRecord);

      runsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 20,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      approvalsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 200,
        offset: 0,
      });

      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({
        id: 'run-1',
        status: 'running',
        name: 'Test Run',
      }));

      const result = await service.getRunDetail('run-1');

      expect(result).not.toBeNull();
      expect(result?.run.id).toBe('run-1');
      expect(result?.metadata.latestCheckpoint?.approvalId).toBe('approval-1');
      expect(result?.metadata.latestCheckpoint?.stepLabel).toBe('Review Step');
    });

    it('should return null if run not found', async () => {
      statusService.getRunStatus.mockResolvedValue(null);
      runnerService.getRun.mockResolvedValue(null);

      const result = await service.getRunDetail('nonexistent-run');

      expect(result).toBeNull();
    });

    it('should include parent run summary if parent exists', async () => {
      const mockRunRecord: OrchestrationRunRecord = {
        id: 'run-child',
        status: 'running',
        orchestration_name: 'Child Run',
        organization_slug: 'test-org',
        created_at: '2025-10-12T10:00:00Z',
        parent_orchestration_run_id: 'run-parent',
      } as OrchestrationRunRecord;

      const mockParentRecord: OrchestrationRunRecord = {
        id: 'run-parent',
        status: 'running',
        orchestration_name: 'Parent Run',
        organization_slug: 'test-org',
        created_at: '2025-10-12T09:00:00Z',
      } as OrchestrationRunRecord;

      statusService.getRunStatus.mockResolvedValue({
        run: { id: 'run-child', status: 'running', name: 'Child Run' },
        steps: [],
        currentStep: null,
        summary: { totalSteps: 3, completedSteps: 1, progressPercentage: 33, pendingApprovals: 0 },
        pendingApprovals: [],
      } as any);

      runnerService.getRun.mockImplementation(async (runId: string) => {
        if (runId === 'run-child') return mockRunRecord;
        if (runId === 'run-parent') return mockParentRecord;
        return null;
      });

      runsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 20,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-parent': 2 });

      approvalsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 200,
        offset: 0,
      });

      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({
        id: 'run-parent',
        status: 'running',
        name: 'Parent Run',
        organizationSlug: 'test-org',
        stats: { totalSteps: 5, completedSteps: 3 },
        timings: { createdAt: '2025-10-12T09:00:00Z', updatedAt: '2025-10-12T09:00:00Z', startedAt: null, completedAt: null },
      }));

      const result = await service.getRunDetail('run-child');

      expect(result).not.toBeNull();
      expect(result?.relatedRuns.parent).not.toBeNull();
      expect(result?.relatedRuns.parent?.id).toBe('run-parent');
      expect(result?.relatedRuns.parent?.pendingApprovals).toBe(2);
    });

    it('should include child runs if they exist', async () => {
      const mockRunRecord: OrchestrationRunRecord = {
        id: 'run-parent',
        status: 'running',
        orchestration_name: 'Parent Run',
        organization_slug: 'test-org',
        created_at: '2025-10-12T10:00:00Z',
      } as OrchestrationRunRecord;

      const mockChildRuns: OrchestrationRunRecord[] = [
        {
          id: 'run-child-1',
          status: 'completed',
          orchestration_name: 'Child 1',
          organization_slug: 'test-org',
          created_at: '2025-10-12T10:05:00Z',
        } as OrchestrationRunRecord,
        {
          id: 'run-child-2',
          status: 'running',
          orchestration_name: 'Child 2',
          organization_slug: 'test-org',
          created_at: '2025-10-12T10:10:00Z',
        } as OrchestrationRunRecord,
      ];

      statusService.getRunStatus.mockResolvedValue({
        run: { id: 'run-parent', status: 'running', name: 'Parent Run' },
        steps: [],
        currentStep: null,
        summary: { totalSteps: 5, completedSteps: 2, progressPercentage: 40, pendingApprovals: 0 },
        pendingApprovals: [],
      } as any);

      runnerService.getRun.mockResolvedValue(mockRunRecord);

      runsRepo.list.mockResolvedValue({
        data: mockChildRuns,
        count: 2,
        limit: 20,
        offset: 0,
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({
        'run-child-1': 0,
        'run-child-2': 1,
      });

      approvalsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 200,
        offset: 0,
      });

      eventsService.snapshotRun.mockImplementation((run) => createMockSnapshot({
        id: run.id,
        status: run.status,
        name: run.orchestration_name,
        organizationSlug: run.organization_slug,
        timings: { createdAt: run.created_at, updatedAt: run.created_at, startedAt: null, completedAt: null },
      }));

      const result = await service.getRunDetail('run-parent');

      expect(result).not.toBeNull();
      expect(result?.relatedRuns.children).toHaveLength(2);
      expect(result?.relatedRuns.children[0]!.id).toBe('run-child-1');
      expect(result?.relatedRuns.children[1]!.pendingApprovals).toBe(1);
    });
  });

  describe('listApprovals', () => {
    it('should return paginated approvals with run context', async () => {
      const mockApprovals: HumanApprovalRecord[] = [
        {
          id: 'approval-1',
          status: 'pending',
          mode: 'orchestration_checkpoint',
          agent_slug: 'test-agent',
          orchestration_run_id: 'run-1',
          orchestration_step_id: 'step-1',
          organization_slug: 'test-org',
          created_at: '2025-10-12T10:00:00Z',
          metadata: {},
        } as HumanApprovalRecord,
      ];

      const mockRuns: OrchestrationRunRecord[] = [
        {
          id: 'run-1',
          status: 'checkpoint',
          orchestration_name: 'Test Run',
          organization_slug: 'test-org',
          created_at: '2025-10-12T09:00:00Z',
        } as OrchestrationRunRecord,
      ];

      approvalsRepo.list.mockResolvedValue({
        data: mockApprovals,
        count: 1,
        limit: 50,
        offset: 0,
      });

      runsRepo.listByIds.mockResolvedValue(mockRuns);

      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 1 });

      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({
        id: 'run-1',
        status: 'checkpoint',
        name: 'Test Run',
        organizationSlug: 'test-org',
        stats: { totalSteps: 5, completedSteps: 2 },
        timings: { createdAt: '2025-10-12T09:00:00Z', updatedAt: '2025-10-12T09:00:00Z', startedAt: null, completedAt: null },
      }));

      const result = await service.listApprovals({ status: 'pending' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.approval.id).toBe('approval-1');
      expect(result.items[0]!.run).not.toBeNull();
      expect(result.items[0]!.run?.id).toBe('run-1');
      expect(approvalsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'orchestration_checkpoint',
        }),
      );
    });

    it('should handle approvals with no associated runs', async () => {
      const mockApprovals: HumanApprovalRecord[] = [
        {
          id: 'approval-orphan',
          status: 'pending',
          mode: 'orchestration_checkpoint',
          agent_slug: 'test-agent',
          orchestration_run_id: null,
          created_at: '2025-10-12T10:00:00Z',
          metadata: {},
        } as HumanApprovalRecord,
      ];

      approvalsRepo.list.mockResolvedValue({
        data: mockApprovals,
        count: 1,
        limit: 50,
        offset: 0,
      });

      runsRepo.listByIds.mockResolvedValue([]);

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      const result = await service.listApprovals();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.approval.id).toBe('approval-orphan');
      expect(result.items[0]!.run).toBeNull();
    });

    it('should support organizationSlug filtering', async () => {
      approvalsRepo.list.mockResolvedValue({
        data: [],
        count: 0,
        limit: 50,
        offset: 0,
      });

      runsRepo.listByIds.mockResolvedValue([]);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      await service.listApprovals({ organizationSlug: 'acme-corp' });

      expect(approvalsRepo.list).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationSlug: 'acme-corp',
        }),
      );
    });
  });

  describe('resolveApproval', () => {
    it('should resolve checkpoint and return updated approval and run', async () => {
      const mockApproval = {
        id: 'approval-1',
        status: 'approved',
        mode: 'orchestration_checkpoint',
        agent_slug: 'test-agent',
        orchestration_run_id: 'run-1',
        created_at: '2025-10-12T10:00:00Z',
        metadata: {
          decision: {
            decidedAt: '2025-10-12T10:30:00Z',
            decidedBy: 'user-1',
          },
        },
      } as unknown as HumanApprovalRecord;

      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        orchestration_name: 'Test Run',
        organization_slug: 'test-org',
        created_at: '2025-10-12T09:00:00Z',
      } as OrchestrationRunRecord;

      checkpointService.resolveCheckpoint.mockResolvedValue({
        approval: mockApproval,
        run: mockRun,
        decision: 'continue',
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({
        id: 'run-1',
        status: 'running',
        name: 'Test Run',
        organizationSlug: 'test-org',
        stats: { totalSteps: 5, completedSteps: 3 },
        timings: { createdAt: '2025-10-12T09:00:00Z', updatedAt: '2025-10-12T09:00:00Z', startedAt: null, completedAt: null },
      }));

      const result = await service.resolveApproval({
        approvalId: 'approval-1',
        decision: 'continue',
        actorId: 'user-1',
        notes: 'Looks good',
      });

      expect(result.approval.id).toBe('approval-1');
      expect(result.approval.status).toBe('approved');
      expect(result.run.id).toBe('run-1');
      expect(result.run.pendingApprovals).toBe(0);
      expect(checkpointService.resolveCheckpoint).toHaveBeenCalledWith({
        approvalId: 'approval-1',
        decision: 'continue',
        actorId: 'user-1',
        notes: 'Looks good',
        modifications: undefined,
      });
    });

    it('should handle modifications payload', async () => {
      const mockApproval: HumanApprovalRecord = {
        id: 'approval-2',
        status: 'approved',
        mode: 'orchestration_checkpoint',
        agent_slug: 'test-agent',
        orchestration_run_id: 'run-2',
        created_at: '2025-10-12T10:00:00Z',
        metadata: {},
      } as HumanApprovalRecord;

      const mockRun: OrchestrationRunRecord = {
        id: 'run-2',
        status: 'running',
        created_at: '2025-10-12T09:00:00Z',
      } as OrchestrationRunRecord;

      checkpointService.resolveCheckpoint.mockResolvedValue({
        approval: mockApproval,
        run: mockRun,
        decision: 'retry',
      });

      approvalsRepo.countPendingByRunIds.mockResolvedValue({});

      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({
        id: 'run-2',
        status: 'running',
        timings: { createdAt: '2025-10-12T09:00:00Z', updatedAt: '2025-10-12T09:00:00Z', startedAt: null, completedAt: null },
      }));

      const modifications = { retryCount: 3, timeout: 60 };

      await service.resolveApproval({
        approvalId: 'approval-2',
        decision: 'retry',
        modifications,
      });

      expect(checkpointService.resolveCheckpoint).toHaveBeenCalledWith({
        approvalId: 'approval-2',
        decision: 'retry',
        actorId: null,
        notes: null,
        modifications,
      });
    });
  });

  describe('getReplayContext', () => {
    it('should return replay context for existing run', async () => {
      const mockRun = {
        id: 'run-replay',
        status: 'completed',
        orchestration_name: 'Replay Test',
        organization_slug: 'test-org',
        conversation_id: 'conv-1',
        orchestration_definition_id: 'def-1',
        orchestration_slug: 'replay-test',
        origin_type: 'manual',
        origin_id: 'origin-1',
        created_at: '2025-10-12T09:00:00Z',
        started_at: '2025-10-12T09:01:00Z',
        completed_at: '2025-10-12T09:10:00Z',
        parameters: { param1: 'value1' },
        plan: { step1: 'do something' },
        results: { output: 'success' },
        metadata: {
          agent: {
            id: 'agent-1',
            slug: 'test-agent',
            displayName: 'Test Agent',
            type: 'orchestrator',
          },
        },
      } as unknown as OrchestrationRunRecord;

      const mockDefinition = {
        id: 'def-1',
        name: 'replay-test',
        displayName: 'Replay Test',
        version: '1.0',
        ownerAgentSlug: 'orchestrator-agent',
      };

      runnerService.getRun.mockResolvedValue(mockRun);
      definitionService.getDefinitionById.mockResolvedValue(mockDefinition as any);

      const result = await service.getReplayContext('run-replay');

      expect(result).not.toBeNull();
      expect(result?.runId).toBe('run-replay');
      expect(result?.organizationSlug).toBe('test-org');
      expect(result?.definition.id).toBe('def-1');
      expect(result?.definition.name).toBe('replay-test');
      expect(result?.agent.slug).toBe('test-agent');
      expect(result?.parameters).toEqual({ param1: 'value1' });
      expect(result?.plan).toEqual({ step1: 'do something' });
      expect(result?.results).toEqual({ output: 'success' });
      expect(result?.timestamps.startedAt).toBe('2025-10-12T09:01:00Z');
    });

    it('should return null if run not found', async () => {
      runnerService.getRun.mockResolvedValue(null);

      const result = await service.getReplayContext('nonexistent-run');

      expect(result).toBeNull();
    });

    it('should handle run without definition', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-no-def',
        status: 'completed',
        orchestration_name: 'No Definition',
        created_at: '2025-10-12T09:00:00Z',
        orchestration_definition_id: null,
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);

      const result = await service.getReplayContext('run-no-def');

      expect(result).not.toBeNull();
      expect(result?.definition.id).toBeNull();
      expect(result?.definition.name).toBe('No Definition');
    });
  });

  // Phase 8: Manual Recovery Tests
  describe('retryStep', () => {
    it('should manually retry a failed step with default delay', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        orchestration_name: 'Test Orchestration',
        created_at: '2025-10-12T10:00:00Z',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        step_index: 0,
        status: 'failed',
        attempt_number: 1,
        error_details: { message: 'Network timeout' },
        completed_at: '2025-10-12T10:05:00Z',
        input: { param1: 'value1' },
        metadata: {
          behavior: { retry: { maxAttempts: 3 } },
          runtime: { retry: { attempt: 1, history: [], maxAttempts: 3 } }
        },
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      runnerService.updateStep.mockResolvedValue({ ...failedStep, status: 'pending' } as any);
      runnerService.updateRun.mockResolvedValue({ ...mockRun, status: 'running' } as OrchestrationRunRecord);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      const result = await service.retryStep({
        runId: 'run-1',
        actorId: 'user-123',
        delaySeconds: 0,
        note: 'Manual retry after timeout',
      });

      const updateCall = runnerService.updateStep.mock.calls[0];
      expect(updateCall?.[0]).toBe('step-rec-1');
      expect(updateCall?.[1]).toMatchObject({
        status: 'pending',
        attempt_number: 2,
        completed_at: null,
        started_at: null,
        output: null,
        deliverable_id: null,
      });
      expect(updateCall?.[1]?.metadata).toBeDefined();
      expect(updateCall?.[1]?.metadata?.runtime?.retry).toBeDefined();
      expect(result.status).toBe('running');
    });

    it('should schedule retry with delay when delaySeconds > 0', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        step_index: 0,
        status: 'failed',
        attempt_number: 2,
        metadata: { runtime: { retry: { attempt: 2, history: [] } } },
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      runnerService.updateStep.mockResolvedValue({ ...failedStep, status: 'pending' } as any);
      runnerService.updateRun.mockResolvedValue(mockRun);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      await service.retryStep({
        runId: 'run-1',
        actorId: 'user-123',
        delaySeconds: 30,
      });

      const updateCall = runnerService.updateStep.mock.calls[0]?.[1];
      expect(updateCall?.metadata?.runtime?.retry?.nextRetryAt).toBeTruthy();
      expect(updateCall?.metadata?.runtime?.retry?.manual).toBe(true);
    });

    it('should merge modifications into step input on retry', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        step_index: 0,
        status: 'failed',
        attempt_number: 1,
        input: { param1: 'original', param2: 'unchanged' },
        metadata: {},
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      runnerService.updateStep.mockResolvedValue({ ...failedStep, status: 'pending' } as any);
      runnerService.updateRun.mockResolvedValue(mockRun);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      await service.retryStep({
        runId: 'run-1',
        actorId: 'user-123',
        modifications: { param1: 'modified', param3: 'new' },
      });

      const updateCall = runnerService.updateStep.mock.calls[0]?.[1];
      expect(updateCall?.input).toEqual({
        param1: 'modified',
        param2: 'unchanged',
        param3: 'new',
      });
    });

    it('should track retry history with manual flag', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        step_index: 0,
        status: 'failed',
        attempt_number: 2,
        completed_at: '2025-10-12T10:05:00Z',
        metadata: {
          runtime: {
            retry: {
              attempt: 2,
              history: [
                { attempt: 1, failedAt: '2025-10-12T10:03:00Z', manual: false }
              ]
            }
          }
        },
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      runnerService.updateStep.mockResolvedValue({ ...failedStep, status: 'pending' } as any);
      runnerService.updateRun.mockResolvedValue(mockRun);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      await service.retryStep({
        runId: 'run-1',
        actorId: 'user-123',
        note: 'Operator review complete',
      });

      const updateCall = runnerService.updateStep.mock.calls[0]?.[1];
      expect(updateCall?.metadata?.runtime?.retry?.history).toHaveLength(2);
      expect(updateCall?.metadata?.runtime?.retry?.history?.[1]).toMatchObject({
        attempt: 2,
        manual: true,
        requestedBy: 'user-123',
        note: 'Operator review complete',
      });
    });

    it('should throw NotFoundException when run not found', async () => {
      runnerService.getRun.mockResolvedValue(null);

      await expect(
        service.retryStep({ runId: 'nonexistent', actorId: 'user-123' })
      ).rejects.toThrow('Orchestration run nonexistent could not be found');
    });

    it('should throw BadRequestException when no failed step exists', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([
        { id: 'step-1', status: 'completed' } as any,
        { id: 'step-2', status: 'pending' } as any,
      ]);

      await expect(
        service.retryStep({ runId: 'run-1', actorId: 'user-123' })
      ).rejects.toThrow('No failed step available to retry for this run');
    });

    it('should throw BadRequestException when specified step is not failed', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const completedStep = {
        id: 'step-rec-1',
        step_id: 'step-1',
        status: 'completed',
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.getStep.mockResolvedValue(completedStep);

      await expect(
        service.retryStep({
          runId: 'run-1',
          stepRecordId: 'step-rec-1',
          actorId: 'user-123',
        })
      ).rejects.toThrow('is not in a failed state');
    });
  });

  describe('skipStep', () => {
    it('should skip a failed step and mark as completed', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        step_index: 0,
        status: 'failed',
        error_details: { message: 'Original error' },
        metadata: {},
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      executionService.markStepCompleted.mockResolvedValue({ step: failedStep, run: mockRun } as any);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      const result = await service.skipStep({
        runId: 'run-1',
        actorId: 'user-123',
        note: 'Accepting previous deliverable',
      });

      expect(executionService.markStepCompleted).toHaveBeenCalledWith(
        'step-rec-1',
        { skipped: true },
        expect.objectContaining({
          metadata: expect.objectContaining({
            runtime: expect.objectContaining({
              skip: expect.objectContaining({
                manual: true,
                requestedBy: 'user-123',
                note: 'Accepting previous deliverable',
              }),
            }),
          }),
        })
      );
      expect(result.status).toBe('running');
    });

    it('should store replacement output when provided', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        status: 'failed',
        metadata: {},
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      executionService.markStepCompleted.mockResolvedValue({ step: failedStep, run: mockRun } as any);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      await service.skipStep({
        runId: 'run-1',
        actorId: 'user-123',
        replacementOutput: { content: 'Manual override data' },
      });

      expect(executionService.markStepCompleted).toHaveBeenCalledWith(
        'step-rec-1',
        { content: 'Manual override data' },
        expect.any(Object)
      );
    });

    it('should store skipped flag when no replacement output', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        status: 'failed',
        metadata: {},
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      executionService.markStepCompleted.mockResolvedValue({ step: failedStep, run: mockRun } as any);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      await service.skipStep({
        runId: 'run-1',
        actorId: 'user-123',
      });

      expect(executionService.markStepCompleted).toHaveBeenCalledWith(
        'step-rec-1',
        { skipped: true },
        expect.any(Object)
      );
    });

    it('should record skip metadata with actor and note', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const failedStep = {
        id: 'step-rec-1',
        orchestration_run_id: 'run-1',
        step_id: 'step-1',
        status: 'failed',
        metadata: {},
      } as any;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([failedStep]);
      executionService.markStepCompleted.mockResolvedValue({ step: failedStep, run: mockRun } as any);
      stepExecutorService.processRun.mockResolvedValue(undefined as any);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'running' }));

      await service.skipStep({
        runId: 'run-1',
        actorId: 'user-123',
        note: 'Step no longer needed',
      });

      expect(executionService.markStepCompleted).toHaveBeenCalledWith(
        'step-rec-1',
        { skipped: true },
        expect.objectContaining({
          metadata: expect.objectContaining({
            runtime: expect.objectContaining({
              skip: expect.objectContaining({
                manual: true,
                requestedBy: 'user-123',
                note: 'Step no longer needed',
              }),
            }),
          }),
        })
      );
    });

    it('should throw NotFoundException when run not found', async () => {
      runnerService.getRun.mockResolvedValue(null);

      await expect(
        service.skipStep({ runId: 'nonexistent', actorId: 'user-123' })
      ).rejects.toThrow('Orchestration run nonexistent could not be found');
    });

    it('should throw BadRequestException when no failed step exists', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'completed',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.listSteps.mockResolvedValue([
        { id: 'step-1', status: 'completed' } as any,
      ]);

      await expect(
        service.skipStep({ runId: 'run-1', actorId: 'user-123' })
      ).rejects.toThrow('No target step available to skip for this run');
    });
  });

  describe('abortRun', () => {
    it('should abort a running orchestration', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        orchestration_name: 'Test Orchestration',
        created_at: '2025-10-12T10:00:00Z',
        started_at: '2025-10-12T10:01:00Z',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);
      const abortedRun = {
        ...mockRun,
        status: 'aborted',
      } as OrchestrationRunRecord;
      runnerService.updateRun.mockResolvedValue(abortedRun);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'aborted' }));

      const result = await service.abortRun({
        runId: 'run-1',
        actorId: 'user-123',
        note: 'Escalated to human review',
      });

      expect(runnerService.updateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          status: 'aborted',
          completedAt: expect.any(String),
        })
      );
      expect(result.status).toBe('aborted');
    });

    it('should record abort metadata with actor and note', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'checkpoint',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.updateRun.mockResolvedValue({
        ...mockRun,
        status: 'aborted',
      } as OrchestrationRunRecord);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'aborted' }));

      await service.abortRun({
        runId: 'run-1',
        actorId: 'user-123',
        note: 'Critical issue found',
      });

      const updateCall = runnerService.updateRun.mock.calls[0]?.[0];
      expect(updateCall?.metadata).toMatchObject({
        manualRecovery: {
          lastAction: 'abort',
          requestedBy: 'user-123',
          note: 'Critical issue found',
        },
      });
    });

    it('should set completed_at timestamp on abort', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.updateRun.mockResolvedValue({
        ...mockRun,
        status: 'aborted',
      } as OrchestrationRunRecord);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'aborted' }));

      await service.abortRun({
        runId: 'run-1',
        actorId: 'user-123',
      });

      const updateCall = runnerService.updateRun.mock.calls[0]?.[0];
      expect(updateCall?.completedAt).toBeTruthy();
    });

    it('should throw NotFoundException when run not found', async () => {
      runnerService.getRun.mockResolvedValue(null);

      await expect(
        service.abortRun({ runId: 'nonexistent', actorId: 'user-123' })
      ).rejects.toThrow('Orchestration run nonexistent could not be found');
    });

    it('should emit abort event after update', async () => {
      const mockRun: OrchestrationRunRecord = {
        id: 'run-1',
        status: 'running',
        parameters: {},
        plan: {},
        results: {},
        metadata: {},
      } as OrchestrationRunRecord;

      const abortedRun: OrchestrationRunRecord = {
        ...mockRun,
        status: 'aborted',
        completed_at: '2025-10-12T10:10:00Z',
      } as OrchestrationRunRecord;

      runnerService.getRun.mockResolvedValue(mockRun);
      runnerService.updateRun.mockResolvedValue(abortedRun);
      approvalsRepo.countPendingByRunIds.mockResolvedValue({ 'run-1': 0 });
      eventsService.snapshotRun.mockReturnValue(createMockSnapshot({ id: 'run-1', status: 'aborted' }));

      await service.abortRun({
        runId: 'run-1',
        actorId: 'user-123',
      });

      expect(eventsService.emitRunFailed).toHaveBeenCalledWith(
        abortedRun,
        expect.objectContaining({
          type: 'manual_abort',
          note: null,
        }),
        expect.any(Object)
      );
    });
  });
});
