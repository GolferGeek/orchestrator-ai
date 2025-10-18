import { NotFoundException } from '@nestjs/common';
import { OrchestrationStatusService } from '../services/orchestration-status.service';
import { OrchestrationDashboardService } from '../services/orchestration-dashboard.service';
import { OrchestrationsController } from './orchestrations.controller';

describe('OrchestrationsController', () => {
  let controller: OrchestrationsController;
  let statusService: jest.Mocked<OrchestrationStatusService>;
  let dashboardService: jest.Mocked<OrchestrationDashboardService>;

  beforeEach(() => {
    statusService = {
      getRunStatus: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationStatusService>;

    dashboardService = {
      listRuns: jest.fn(),
      listApprovals: jest.fn(),
      resolveApproval: jest.fn(),
      getReplayContext: jest.fn(),
      getRunDetail: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationDashboardService>;

    controller = new OrchestrationsController(statusService, dashboardService);
  });

  describe('getStatus', () => {
    it('returns status for existing run', async () => {
      const mockStatus = {
        run: { id: 'run-1', status: 'running' },
        steps: [],
        currentStep: null,
        pendingApprovals: [],
        summary: {
          totalSteps: 3,
          completedSteps: 1,
          progressPercentage: 33,
          pendingApprovals: 0,
        },
      };

      statusService.getRunStatus.mockResolvedValue(
        mockStatus as unknown as Awaited<
          ReturnType<typeof statusService.getRunStatus>
        >,
      );

      const result = await controller.getStatus('run-1');

      expect(result).toEqual({
        success: true,
        data: mockStatus,
      });
      expect(statusService.getRunStatus).toHaveBeenCalledWith('run-1');
    });

    it('throws NotFoundException for non-existent run', async () => {
      statusService.getRunStatus.mockResolvedValue(null);

      await expect(controller.getStatus('missing-run')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getStatus('missing-run')).rejects.toThrow(
        'Orchestration run not found',
      );
    });

    it('returns full status data structure', async () => {
      const mockStatus = {
        run: {
          id: 'run-1',
          status: 'running',
          currentStepId: 'step-1',
          stats: { totalSteps: 2, completedSteps: 1, progressPercentage: 50 },
        },
        steps: [
          { id: 'step-0', index: 0, status: 'completed' },
          { id: 'step-1', index: 1, status: 'running' },
        ],
        currentStep: { id: 'step-1', index: 1, status: 'running' },
        pendingApprovals: [],
        summary: {
          totalSteps: 2,
          completedSteps: 1,
          progressPercentage: 50,
          pendingApprovals: 0,
        },
      };

      statusService.getRunStatus.mockResolvedValue(
        mockStatus as unknown as Awaited<
          ReturnType<typeof statusService.getRunStatus>
        >,
      );

      const result = await controller.getStatus('run-1');

      expect(result.success).toBe(true);
      expect(result.data.run.id).toBe('run-1');
      expect(result.data.steps).toHaveLength(2);
      expect(result.data.currentStep?.id).toBe('step-1');
      expect(result.data.summary.progressPercentage).toBe(50);
    });
  });

  describe('listRuns', () => {
    it('returns paginated orchestration runs', async () => {
      const mockResult = {
        items: [
          { id: 'run-1', status: 'running', pendingApprovals: 2 },
          { id: 'run-2', status: 'completed', pendingApprovals: 0 },
        ],
        total: 2,
        limit: 25,
        offset: 0,
        hasMore: false,
      };

      dashboardService.listRuns.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.listRuns>
        >,
      );

      const query = { lifecycle: 'active', limit: 25, offset: 0 };
      const result = await controller.listRuns(
        query as unknown as Parameters<typeof controller.listRuns>[0],
      );

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.hasMore).toBe(false);
      expect(dashboardService.listRuns).toHaveBeenCalledWith({
        organizationSlug: undefined,
        lifecycle: 'active',
        definitionId: undefined,
        parentRunId: undefined,
        search: undefined,
        limit: 25,
        offset: 0,
        startedAfter: undefined,
        startedBefore: undefined,
      });
    });

    it('supports all query parameters', async () => {
      const mockResult = {
        items: [],
        total: 0,
        limit: 10,
        offset: 5,
        hasMore: false,
      };

      dashboardService.listRuns.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.listRuns>
        >,
      );

      const query = {
        lifecycle: 'completed',
        organizationSlug: 'acme-corp',
        definitionId: 'def-123',
        parentRunId: 'parent-1',
        search: 'finance',
        limit: 10,
        offset: 5,
        startedAfter: '2025-10-01T00:00:00Z',
        startedBefore: '2025-10-12T23:59:59Z',
      };

      await controller.listRuns(
        query as unknown as Parameters<typeof controller.listRuns>[0],
      );

      expect(dashboardService.listRuns).toHaveBeenCalledWith({
        organizationSlug: 'acme-corp',
        lifecycle: 'completed',
        definitionId: 'def-123',
        parentRunId: 'parent-1',
        search: 'finance',
        limit: 10,
        offset: 5,
        startedAfter: '2025-10-01T00:00:00Z',
        startedBefore: '2025-10-12T23:59:59Z',
      });
    });
  });

  describe('listApprovals', () => {
    it('returns paginated approvals', async () => {
      const mockResult = {
        items: [
          {
            approval: { id: 'approval-1', status: 'pending' },
            run: { id: 'run-1', status: 'checkpoint' },
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      };

      dashboardService.listApprovals.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.listApprovals>
        >,
      );

      const query = { status: 'pending', limit: 50, offset: 0 };
      const result = await controller.listApprovals(
        query as unknown as Parameters<typeof controller.listApprovals>[0],
      );

      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(1);
      expect(dashboardService.listApprovals).toHaveBeenCalledWith({
        organizationSlug: undefined,
        status: 'pending',
        limit: 50,
        offset: 0,
        sortDirection: undefined,
      });
    });

    it('supports organizationSlug filtering', async () => {
      const mockResult = {
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      };

      dashboardService.listApprovals.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.listApprovals>
        >,
      );

      const query = { organizationSlug: 'test-org' };
      await controller.listApprovals(
        query as unknown as Parameters<typeof controller.listApprovals>[0],
      );

      expect(dashboardService.listApprovals).toHaveBeenCalledWith({
        organizationSlug: 'test-org',
        status: undefined,
        limit: undefined,
        offset: undefined,
        sortDirection: undefined,
      });
    });
  });

  describe('resolveApproval', () => {
    it('resolves approval with continue decision', async () => {
      const mockResult = {
        approval: { id: 'approval-1', status: 'approved' },
        run: { id: 'run-1', status: 'running', pendingApprovals: 0 },
      };

      dashboardService.resolveApproval.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.resolveApproval>
        >,
      );

      const body = { decision: 'continue', notes: 'Approved' };
      const req = { user: { sub: 'user-123' } } as Parameters<
        typeof controller.resolveApproval
      >[2];

      const result = await controller.resolveApproval(
        'approval-1',
        body as unknown as Parameters<typeof controller.resolveApproval>[1],
        req,
      );

      expect(result.success).toBe(true);
      expect(result.data.approval.status).toBe('approved');
      expect(dashboardService.resolveApproval).toHaveBeenCalledWith({
        approvalId: 'approval-1',
        decision: 'continue',
        notes: 'Approved',
        modifications: undefined,
        actorId: 'user-123',
      });
    });

    it('resolves approval with modifications', async () => {
      const mockResult = {
        approval: { id: 'approval-2', status: 'approved' },
        run: { id: 'run-2', status: 'running', pendingApprovals: 0 },
      };

      dashboardService.resolveApproval.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.resolveApproval>
        >,
      );

      const body = {
        decision: 'retry',
        notes: 'Retry with changes',
        modifications: { timeout: 120 },
      };
      const req = { user: { id: 'user-456' } } as Parameters<
        typeof controller.resolveApproval
      >[2];

      await controller.resolveApproval(
        'approval-2',
        body as unknown as Parameters<typeof controller.resolveApproval>[1],
        req,
      );

      expect(dashboardService.resolveApproval).toHaveBeenCalledWith({
        approvalId: 'approval-2',
        decision: 'retry',
        notes: 'Retry with changes',
        modifications: { timeout: 120 },
        actorId: 'user-456',
      });
    });

    it('handles different user ID formats from JWT', async () => {
      const mockResult = {
        approval: { id: 'approval-3', status: 'rejected' },
        run: { id: 'run-3', status: 'failed', pendingApprovals: 0 },
      };

      dashboardService.resolveApproval.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.resolveApproval>
        >,
      );

      const body = { decision: 'abort' };
      const req = { user: { userId: 'user-789' } } as Parameters<
        typeof controller.resolveApproval
      >[2];

      await controller.resolveApproval(
        'approval-3',
        body as unknown as Parameters<typeof controller.resolveApproval>[1],
        req,
      );

      expect(dashboardService.resolveApproval).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-789' }),
      );
    });

    it('defaults actorId to null if no user in request', async () => {
      const mockResult = {
        approval: { id: 'approval-4', status: 'approved' },
        run: { id: 'run-4', status: 'running', pendingApprovals: 0 },
      };

      dashboardService.resolveApproval.mockResolvedValue(
        mockResult as unknown as Awaited<
          ReturnType<typeof dashboardService.resolveApproval>
        >,
      );

      const body = { decision: 'continue' };
      const req = {} as Parameters<typeof controller.resolveApproval>[2];

      await controller.resolveApproval(
        'approval-4',
        body as unknown as Parameters<typeof controller.resolveApproval>[1],
        req,
      );

      expect(dashboardService.resolveApproval).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: null }),
      );
    });
  });

  describe('getReplayContext', () => {
    it('returns replay context for existing run', async () => {
      const mockContext = {
        runId: 'run-replay',
        organizationSlug: 'test-org',
        conversationId: 'conv-1',
        definition: { id: 'def-1', name: 'test-orch' },
        agent: { id: 'agent-1', slug: 'test-agent' },
        parameters: { param1: 'value1' },
        plan: { step1: 'action' },
        results: { output: 'success' },
        metadata: {},
        origin: { type: 'manual', id: 'origin-1', slug: 'test' },
        timestamps: {
          createdAt: '2025-10-12T09:00:00Z',
          startedAt: '2025-10-12T09:01:00Z',
          completedAt: '2025-10-12T09:10:00Z',
        },
      };

      dashboardService.getReplayContext.mockResolvedValue(
        mockContext as unknown as Awaited<
          ReturnType<typeof dashboardService.getReplayContext>
        >,
      );

      const result = await controller.getReplayContext('run-replay');

      expect(result.success).toBe(true);
      expect(result.data.runId).toBe('run-replay');
      expect(result.data.parameters).toEqual({ param1: 'value1' });
      expect(dashboardService.getReplayContext).toHaveBeenCalledWith(
        'run-replay',
      );
    });

    it('throws NotFoundException if run not found', async () => {
      dashboardService.getReplayContext.mockResolvedValue(null);

      await expect(controller.getReplayContext('missing-run')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getReplayContext('missing-run')).rejects.toThrow(
        'Orchestration run not found',
      );
    });
  });

  describe('getRun', () => {
    it('returns full run detail', async () => {
      const mockDetail = {
        run: { id: 'run-1', status: 'running' },
        steps: [{ id: 'step-1', status: 'completed' }],
        currentStep: { id: 'step-2', status: 'running' },
        summary: {
          totalSteps: 3,
          completedSteps: 1,
          progressPercentage: 33,
          pendingApprovals: 1,
        },
        pendingApprovals: [{ id: 'approval-1', status: 'pending' }],
        approvals: { items: [], total: 0 },
        relatedRuns: { parent: null, children: [] },
        metadata: { latestCheckpoint: null },
      };

      dashboardService.getRunDetail.mockResolvedValue(
        mockDetail as unknown as Awaited<
          ReturnType<typeof dashboardService.getRunDetail>
        >,
      );

      const result = await controller.getRun('run-1');

      expect(result.success).toBe(true);
      expect(result.data.run.id).toBe('run-1');
      expect(result.data.steps).toHaveLength(1);
      expect(dashboardService.getRunDetail).toHaveBeenCalledWith('run-1');
    });

    it('throws NotFoundException if run not found', async () => {
      dashboardService.getRunDetail.mockResolvedValue(null);

      await expect(controller.getRun('missing-run')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getRun('missing-run')).rejects.toThrow(
        'Orchestration run not found',
      );
    });
  });
});
