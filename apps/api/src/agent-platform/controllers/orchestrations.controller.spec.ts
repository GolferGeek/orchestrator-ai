import { NotFoundException } from '@nestjs/common';
import { OrchestrationsController } from './orchestrations.controller';
import { OrchestrationStatusService } from '../services/orchestration-status.service';

describe('OrchestrationsController', () => {
  let controller: OrchestrationsController;
  let statusService: jest.Mocked<OrchestrationStatusService>;

  beforeEach(() => {
    statusService = {
      getRunStatus: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationStatusService>;

    controller = new OrchestrationsController(statusService);
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

      statusService.getRunStatus.mockResolvedValue(mockStatus as any);

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

      statusService.getRunStatus.mockResolvedValue(mockStatus as any);

      const result = await controller.getStatus('run-1');

      expect(result.success).toBe(true);
      expect(result.data.run.id).toBe('run-1');
      expect(result.data.steps).toHaveLength(2);
      expect(result.data.currentStep?.id).toBe('step-1');
      expect(result.data.summary.progressPercentage).toBe(50);
    });
  });
});
