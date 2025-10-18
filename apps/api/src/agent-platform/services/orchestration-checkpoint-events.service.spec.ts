import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { OrchestrationCheckpointEventsService } from './orchestration-checkpoint-events.service';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';

const createRun = (
  overrides: Partial<OrchestrationRunRecord> = {},
): OrchestrationRunRecord => ({
  id: 'run-1',
  plan_id: null,
  orchestration_definition_id: 'def-1',
  orchestration_name: 'sample',
  conversation_id: 'conv-1',
  parent_orchestration_run_id: null,
  origin_type: 'plan',
  origin_id: null,
  orchestration_slug: null,
  parameters: {},
  organization_slug: 'org-1',
  user_id: null,
  status: 'checkpoint',
  current_step_index: 0,
  current_step_id: 'step-1',
  completed_steps: [],
  step_state: {},
  human_checkpoint_id: 'approval-1',
  plan: {},
  results: {},
  error_details: {},
  metadata: {
    agent: { slug: 'finance-manager' },
    lastCheckpoint: {
      approvalId: 'approval-1',
      checkpointId: 'review-step',
      step: {
        definitionId: 'step-1',
        recordId: 'orch-step-rec-1',
        index: 0,
      },
      requestedAt: new Date().toISOString(),
    },
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  started_at: new Date().toISOString(),
  completed_at: null,
  created_by: null,
  ...overrides,
});

const createStep = (
  overrides: Partial<OrchestrationStepRecord> = {},
): OrchestrationStepRecord => ({
  id: 'orch-step-rec-1',
  orchestration_run_id: 'run-1',
  step_index: 0,
  step_id: 'step-1',
  status: 'completed',
  agent_slug: 'supabase-agent',
  mode: 'BUILD',
  conversation_id: null,
  plan_id: null,
  deliverable_id: null,
  depends_on: [],
  attempt_number: 1,
  checkpoint_decision: null,
  checkpoint_decided_by: null,
  checkpoint_decided_at: null,
  invalidated_at: null,
  invalidated_reason: null,
  input: {},
  output: { rows: [] },
  metadata: {},
  error_details: null,
  started_at: null,
  completed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('OrchestrationCheckpointEventsService', () => {
  let runner: jest.Mocked<OrchestrationRunnerService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let httpService: jest.Mocked<HttpService>;
  let service: OrchestrationCheckpointEventsService;
  let originalWebhookUrl: string | undefined;

  beforeEach(() => {
    originalWebhookUrl = process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL;

    runner = {
      getRun: jest.fn(),
      listSteps: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunnerService>;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    httpService = {
      post: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;
  });

  afterEach(() => {
    if (originalWebhookUrl) {
      process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL = originalWebhookUrl;
    } else {
      delete process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL;
    }
  });

  describe('handleCheckpointRequested', () => {
    it('emits stream chunk and dispatches webhook on checkpoint requested', async () => {
      process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL =
        'http://localhost:5678/webhook/checkpoint';

      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun();
      const step = createStep();
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([step]);
      httpService.post.mockReturnValue(
        of({ data: { success: true }, status: 200 } as AxiosResponse<{
          success: boolean;
        }>),
      );

      await service.handleCheckpointRequested({
        runId: run.id,
        approvalId: 'approval-1',
        stepId: 'step-1',
        checkpointId: 'review-step',
        question: 'Approve the output?',
        options: [
          { action: 'continue', label: 'Continue' },
          { action: 'retry', label: 'Retry' },
        ],
      });

      const getRunMock1 = runner['getRun'] as jest.Mock;
      expect(getRunMock1).toHaveBeenCalledWith(run.id);
      const emitMock4 = eventEmitter['emit'] as jest.Mock;
      expect(emitMock4).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          streamId: run.id,
          conversationId: run.conversation_id,
          orchestrationRunId: run.id,
          agentSlug: 'finance-manager',
          mode: 'orchestration_checkpoint',
          chunk: expect.objectContaining({
            type: 'partial',
            metadata: expect.objectContaining({
              event: 'orchestration.checkpoint.requested',
              approvalId: 'approval-1',
              checkpointId: 'review-step',
            }) as never,
          }) as never,
        }),
      );

      const postMock1 = httpService['post'] as jest.Mock;
      expect(postMock1).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/checkpoint',
        expect.objectContaining({
          event: 'orchestration.checkpoint.requested',
          data: expect.objectContaining({
            runId: run.id,
            approvalId: 'approval-1',
            checkpointId: 'review-step',
            question: 'Approve the output?',
          }) as never,
        }),
      );
    });

    it('handles missing run gracefully', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      runner.getRun.mockResolvedValue(null);

      await expect(
        service.handleCheckpointRequested({
          runId: 'missing-run',
          approvalId: 'approval-1',
          checkpointId: 'review-step',
          question: 'Test question',
        }),
      ).resolves.not.toThrow();

      const emitSpy = eventEmitter.emit;
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('skips webhook when URL not configured', async () => {
      delete process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL;

      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun();
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([]);

      await service.handleCheckpointRequested({
        runId: run.id,
        approvalId: 'approval-1',
        checkpointId: 'review-step',
        question: 'Test question',
      });

      const postSpy = httpService.post;
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('handles webhook dispatch failures gracefully', async () => {
      process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL =
        'http://localhost:5678/webhook/checkpoint';

      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun();
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([]);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.handleCheckpointRequested({
          runId: run.id,
          approvalId: 'approval-1',
          checkpointId: 'review-step',
          question: 'Test question',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('handleCheckpointResolved', () => {
    it('emits stream chunk and dispatches webhook on checkpoint resolved', async () => {
      process.env.ORCHESTRATION_CHECKPOINT_WEBHOOK_URL =
        'http://localhost:5678/webhook/checkpoint';

      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun({ status: 'running' });
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([createStep()]);
      httpService.post.mockReturnValue(
        of({ data: { success: true }, status: 200 } as AxiosResponse<{
          success: boolean;
        }>),
      );

      await service.handleCheckpointResolved({
        runId: run.id,
        approvalId: 'approval-1',
        decision: 'continue',
        decidedBy: 'user-1',
        notes: 'Looks good',
        modifications: null,
      });

      const getRunMock = runner['getRun'] as jest.Mock;
      expect(getRunMock).toHaveBeenCalledWith(run.id);
      const emitMock3 = eventEmitter['emit'] as jest.Mock;
      expect(emitMock3).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          streamId: run.id,
          conversationId: run.conversation_id,
          orchestrationRunId: run.id,
          agentSlug: 'finance-manager',
          mode: 'orchestration_checkpoint',
          chunk: expect.objectContaining({
            type: 'partial',
            metadata: expect.objectContaining({
              event: 'orchestration.checkpoint.resolved',
              approvalId: 'approval-1',
              checkpointId: 'review-step',
              decision: 'continue',
            }) as never,
          }) as never,
        }),
      );

      const postMock = httpService['post'] as jest.Mock;
      expect(postMock).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/checkpoint',
        expect.objectContaining({
          event: 'orchestration.checkpoint.resolved',
          data: expect.objectContaining({
            runId: run.id,
            approvalId: 'approval-1',
            decision: 'continue',
            decidedBy: 'user-1',
            notes: 'Looks good',
          }) as never,
        }),
      );
    });

    it('handles abort decision correctly', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun({ status: 'aborted' });
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([]);

      await service.handleCheckpointResolved({
        runId: run.id,
        approvalId: 'approval-1',
        decision: 'abort',
        decidedBy: 'user-1',
        notes: 'Cancelling run',
        modifications: null,
      });

      const emitMock2 = eventEmitter['emit'] as jest.Mock;
      expect(emitMock2).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          chunk: expect.objectContaining({
            metadata: expect.objectContaining({
              decision: 'abort',
            }) as never,
          }) as never,
        }),
      );
    });

    it('handles retry decision correctly', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun({ status: 'running' });
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([]);

      await service.handleCheckpointResolved({
        runId: run.id,
        approvalId: 'approval-1',
        decision: 'retry',
        decidedBy: 'user-1',
        notes: 'Retry with modifications',
        modifications: { inputOverride: 'new-value' },
      });

      const emitMock1 = eventEmitter['emit'] as jest.Mock;
      expect(emitMock1).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          chunk: expect.objectContaining({
            metadata: expect.objectContaining({
              decision: 'retry',
            }) as never,
          }) as never,
        }),
      );
    });

    it('handles missing run gracefully', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      runner.getRun.mockResolvedValue(null);

      await expect(
        service.handleCheckpointResolved({
          runId: 'missing-run',
          approvalId: 'approval-1',
          decision: 'continue',
        }),
      ).resolves.not.toThrow();

      const emitSpy = eventEmitter.emit;
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('handles missing lastCheckpoint metadata gracefully', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun({ metadata: {} });
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([]);

      await expect(
        service.handleCheckpointResolved({
          runId: run.id,
          approvalId: 'approval-1',
          decision: 'continue',
        }),
      ).resolves.not.toThrow();

      const emitMock5 = eventEmitter['emit'] as jest.Mock;
      expect(emitMock5).toHaveBeenCalled();
    });
  });

  describe('describeStep', () => {
    it('returns step description when step exists', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun();
      const step = createStep();
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([step]);

      await service.handleCheckpointRequested({
        runId: run.id,
        approvalId: 'approval-1',
        stepId: 'step-1',
        checkpointId: 'review-step',
        question: 'Approve?',
      });

      const listStepsMock1 = runner['listSteps'] as jest.Mock;
      expect(listStepsMock1).toHaveBeenCalledWith(run.id);
      const emitMock = eventEmitter['emit'] as jest.Mock;
      expect(emitMock).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          chunk: expect.objectContaining({
            content: expect.stringContaining('step-1') as string,
          }) as { content: string },
        }) as { chunk: { content: string } },
      );
    });

    it('returns null when step not found', async () => {
      service = new OrchestrationCheckpointEventsService(
        runner,
        eventEmitter,
        httpService,
      );

      const run = createRun();
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([]);

      await service.handleCheckpointRequested({
        runId: run.id,
        approvalId: 'approval-1',
        stepId: 'missing-step',
        checkpointId: 'review-step',
        question: 'Approve?',
      });

      const listStepsMock = runner['listSteps'] as jest.Mock;
      expect(listStepsMock).toHaveBeenCalledWith(run.id);
    });
  });
});
