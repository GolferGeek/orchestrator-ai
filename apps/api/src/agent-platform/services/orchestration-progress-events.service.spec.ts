import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { OrchestrationProgressEventsService } from './orchestration-progress-events.service';
import { TaskStatusService } from '@/agent2agent/tasks/task-status.service';
import {
  OrchestrationRunEventPayload,
  OrchestrationRunSnapshot,
  OrchestrationStepSnapshot,
  OrchestrationEventType,
} from '../types/orchestration-events.types';

const createRunSnapshot = (
  overrides: Partial<OrchestrationRunSnapshot> = {},
): OrchestrationRunSnapshot => ({
  id: 'run-1',
  status: 'running',
  definitionId: 'def-1',
  name: 'test-orch',
  planId: null,
  conversationId: 'conv-1',
  parentRunId: null,
  organizationSlug: 'org-1',
  currentStepId: 'step-1',
  currentStepIndex: 0,
  completedSteps: [],
  humanCheckpointId: null,
  plan: {},
  results: {},
  parameters: {},
  errorDetails: {},
  metadata: {},
  stats: { totalSteps: 3, completedSteps: 1, progressPercentage: 33 },
  timings: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
  },
  agent: { id: null, slug: 'finance-manager', type: null, displayName: null },
  task: { id: 'task-1', userId: 'user-1' },
  ...overrides,
});

const createStepSnapshot = (
  overrides: Partial<OrchestrationStepSnapshot> = {},
): OrchestrationStepSnapshot => ({
  id: 'step-1',
  runId: 'run-1',
  index: 0,
  status: 'running',
  agentSlug: 'supabase-agent',
  mode: 'BUILD',
  attemptNumber: 1,
  dependsOn: [],
  conversationId: null,
  startedAt: new Date().toISOString(),
  completedAt: null,
  metadata: { name: 'Fetch Data' },
  outputSummary: [],
  errorDetails: null,
  ...overrides,
});

const createEvent = (
  type: OrchestrationEventType,
  runOverrides: Partial<OrchestrationRunSnapshot> = {},
  dataOverrides: Record<string, any> = {},
): OrchestrationRunEventPayload => ({
  type,
  timestamp: new Date().toISOString(),
  run: createRunSnapshot(runOverrides),
  data: dataOverrides,
});

describe('OrchestrationProgressEventsService', () => {
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let httpService: jest.Mocked<HttpService>;
  let taskStatusService: jest.Mocked<TaskStatusService>;
  let service: OrchestrationProgressEventsService;
  let originalWebhookUrl: string | undefined;

  beforeEach(() => {
    originalWebhookUrl = process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    httpService = {
      post: jest.fn(),
    } as unknown as jest.Mocked<HttpService>;

    taskStatusService = {
      updateTaskStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TaskStatusService>;
  });

  afterEach(() => {
    if (originalWebhookUrl) {
      process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL = originalWebhookUrl;
    } else {
      delete process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL;
    }
  });

  describe('handleEvent', () => {
    it('emits stream chunk for orchestration.run.created event', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.created');

      await service.handleEvent(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          streamId: 'run-1',
          conversationId: 'conv-1',
          orchestrationRunId: 'run-1',
          organizationSlug: 'org-1',
          agentSlug: 'finance-manager',
          mode: 'orchestration',
          chunk: expect.objectContaining({
            type: 'partial',
            metadata: expect.objectContaining({
              eventType: 'orchestration.run.created',
              progressPercentage: 33,
            }),
          }),
        }),
      );
    });

    it('emits stream complete on orchestration.run.completed', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.completed', {
        status: 'completed',
        stats: { totalSteps: 3, completedSteps: 3, progressPercentage: 100 },
      });

      await service.handleEvent(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent.stream.complete',
        expect.objectContaining({
          streamId: 'run-1',
          conversationId: 'conv-1',
          orchestrationRunId: 'run-1',
          agentSlug: 'finance-manager',
          mode: 'orchestration',
        }),
      );
    });

    it('emits stream error on orchestration.run.failed', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent(
        'orchestration.run.failed',
        {
          status: 'failed',
          errorDetails: { message: 'Database connection failed' },
        },
        { error: 'Database connection failed' },
      );

      await service.handleEvent(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent.stream.error',
        expect.objectContaining({
          streamId: 'run-1',
          error: 'Database connection failed',
        }),
      );
    });

    it('forwards task status update for run.created', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.created', {
        task: { id: 'task-1', userId: 'user-1' },
        stats: { totalSteps: 3, completedSteps: 0, progressPercentage: 0 },
      });

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          status: 'running',
          progress: 0,
          progressMessage: 'Orchestration run created',
        }),
      );
    });

    it('forwards task status update for step.running', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const step = createStepSnapshot({
        id: 'step-1',
        metadata: { name: 'Fetch Data' },
      });
      const event = createEvent(
        'orchestration.step.running',
        {
          task: { id: 'task-1', userId: 'user-1' },
          stats: { totalSteps: 3, completedSteps: 0, progressPercentage: 10 },
        },
        { step },
      );

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          status: 'running',
          progress: 10,
          progressMessage: 'Step Fetch Data running',
        }),
      );
    });

    it('forwards task status update for step.completed', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const step = createStepSnapshot({ id: 'step-1', status: 'completed' });
      const event = createEvent(
        'orchestration.step.completed',
        {
          task: { id: 'task-1', userId: 'user-1' },
          stats: { totalSteps: 3, completedSteps: 1, progressPercentage: 33 },
        },
        { step },
      );

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          status: 'running',
          progress: 33,
          progressMessage: expect.stringContaining('completed'),
        }),
      );
    });

    it('forwards task status update for run.completed with results', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.completed', {
        task: { id: 'task-1', userId: 'user-1' },
        status: 'completed',
        stats: { totalSteps: 3, completedSteps: 3, progressPercentage: 100 },
        results: { output: 'Success!' },
      });

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          status: 'completed',
          progress: 100,
          progressMessage: 'Orchestration run completed',
          result: { output: 'Success!' },
        }),
      );
    });

    it('forwards task status update for step.failed with error', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const step = createStepSnapshot({ id: 'step-1', status: 'failed' });
      const event = createEvent(
        'orchestration.step.failed',
        {
          task: { id: 'task-1', userId: 'user-1' },
          stats: { totalSteps: 3, completedSteps: 1, progressPercentage: 33 },
        },
        { step, error: 'Step execution failed' },
      );

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          status: 'failed',
          error: 'Step execution failed',
        }),
      );
    });

    it('dispatches webhook when URL is configured', async () => {
      process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL =
        'http://localhost:5678/webhook/progress';

      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      httpService.post.mockReturnValue(
        of({ data: { success: true }, status: 200 } as any),
      );

      const event = createEvent('orchestration.run.created');

      await service.handleEvent(event);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:5678/webhook/progress',
        expect.objectContaining({
          event: 'orchestration.run.created',
          runId: 'run-1',
          data: expect.objectContaining({
            timestamp: expect.any(String),
            run: expect.any(Object),
          }),
        }),
      );
    });

    it('skips webhook when URL not configured', async () => {
      delete process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL;

      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.created');

      await service.handleEvent(event);

      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('handles webhook dispatch failures gracefully', async () => {
      process.env.ORCHESTRATION_PROGRESS_WEBHOOK_URL =
        'http://localhost:5678/webhook/progress';

      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const event = createEvent('orchestration.run.created');

      await expect(service.handleEvent(event)).resolves.not.toThrow();
    });

    it('handles task status update failures gracefully', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      taskStatusService.updateTaskStatus.mockRejectedValue(
        new Error('Task not found'),
      );

      const event = createEvent('orchestration.run.created', {
        task: { id: 'task-1', userId: 'user-1' },
      });

      await expect(service.handleEvent(event)).resolves.not.toThrow();
    });

    it('skips task status update when task info missing', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.created', {
        task: undefined,
      });

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).not.toHaveBeenCalled();
    });

    it('includes step metadata in stream chunk', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const step = createStepSnapshot({
        id: 'step-1',
        index: 0,
        metadata: { name: 'Fetch Data' },
      });
      const event = createEvent('orchestration.step.running', {}, { step });

      await service.handleEvent(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          chunk: expect.objectContaining({
            metadata: expect.objectContaining({
              stepId: 'step-1',
              stepIndex: 0,
            }),
          }),
        }),
      );
    });

    it('handles event without step data', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.updated');

      await service.handleEvent(event);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent.stream.chunk',
        expect.objectContaining({
          chunk: expect.objectContaining({
            metadata: expect.objectContaining({
              stepId: null,
              stepIndex: null,
            }),
          }),
        }),
      );
    });

    it('normalizes run status for task updates', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.updated', {
        task: { id: 'task-1', userId: 'user-1' },
        status: 'COMPLETED',
      });

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          status: 'completed',
        }),
      );
    });

    it('extracts error message from data.error field', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent(
        'orchestration.run.failed',
        {
          task: { id: 'task-1', userId: 'user-1' },
        },
        { error: 'Database connection lost' },
      );

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          error: 'Database connection lost',
        }),
      );
    });

    it('extracts error message from errorDetails object', async () => {
      service = new OrchestrationProgressEventsService(
        eventEmitter,
        httpService,
        taskStatusService,
      );

      const event = createEvent('orchestration.run.failed', {
        task: { id: 'task-1', userId: 'user-1' },
        errorDetails: { message: 'Timeout exceeded' },
      });

      await service.handleEvent(event);

      expect(taskStatusService.updateTaskStatus).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        expect.objectContaining({
          error: 'Timeout exceeded',
        }),
      );
    });
  });
});
