import { OrchestrationStatusService } from './orchestration-status.service';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationEventsService } from './orchestration-events.service';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';
import { OrchestrationRunSnapshot } from '../types/orchestration-events.types';

const createRun = (
  overrides: Partial<OrchestrationRunRecord> = {},
): OrchestrationRunRecord => ({
  id: 'run-1',
  plan_id: null,
  orchestration_definition_id: 'def-1',
  orchestration_name: 'test-orchestration',
  conversation_id: 'conv-1',
  parent_orchestration_run_id: null,
  origin_type: 'plan',
  origin_id: null,
  orchestration_slug: null,
  parameters: {},
  organization_slug: 'org-1',
  user_id: null,
  status: 'running',
  current_step_index: 1,
  current_step_id: 'step-1',
  completed_steps: ['step-0'],
  step_state: {},
  human_checkpoint_id: null,
  plan: {},
  results: {},
  error_details: {},
  metadata: { agent: { slug: 'test-agent' } },
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
  id: 'step-rec-1',
  orchestration_run_id: 'run-1',
  step_index: 0,
  step_id: 'step-0',
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
  output: {},
  metadata: {},
  error_details: null,
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const createRunSnapshot = (
  overrides: Partial<OrchestrationRunSnapshot> = {},
): OrchestrationRunSnapshot => ({
  id: 'run-1',
  status: 'running',
  definitionId: 'def-1',
  name: 'test-orchestration',
  planId: null,
  conversationId: 'conv-1',
  parentRunId: null,
  organizationSlug: 'org-1',
  currentStepId: 'step-1',
  currentStepIndex: 1,
  completedSteps: ['step-0'],
  humanCheckpointId: null,
  plan: {},
  results: {},
  parameters: {},
  errorDetails: {},
  metadata: { agent: { slug: 'test-agent' } },
  stats: { totalSteps: 3, completedSteps: 1, progressPercentage: 33 },
  timings: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
  },
  agent: { slug: 'test-agent', id: '', type: 'specialist', displayName: '' },
  ...overrides,
});

describe('OrchestrationStatusService', () => {
  let runner: jest.Mocked<OrchestrationRunnerService>;
  let events: jest.Mocked<OrchestrationEventsService>;
  let approvals: jest.Mocked<HumanApprovalsRepository>;
  let service: OrchestrationStatusService;

  beforeEach(() => {
    runner = {
      getRun: jest.fn(),
      listSteps: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunnerService>;

    events = {
      snapshotRun: jest.fn().mockReturnValue({
        id: 'run-1',
        status: 'running',
        currentStepId: 'step-1',
        stats: { totalSteps: 3, completedSteps: 1, progressPercentage: 33 },
      }),
      snapshotStep: jest
        .fn()
        .mockImplementation(
          (_run: OrchestrationRunRecord, step: OrchestrationStepRecord) => ({
            id: step.step_id,
            index: step.step_index,
            status: step.status,
            agent: { slug: step.agent_slug },
          }),
        ),
    } as unknown as jest.Mocked<OrchestrationEventsService>;

    approvals = {
      listPendingByRun: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<HumanApprovalsRepository>;

    service = new OrchestrationStatusService(runner, events, approvals);
  });

  describe('getRunStatus', () => {
    it('returns full status for existing run', async () => {
      const run = createRun();
      const steps = [
        createStep({ step_index: 0, step_id: 'step-0', status: 'completed' }),
        createStep({ step_index: 1, step_id: 'step-1', status: 'running' }),
        createStep({ step_index: 2, step_id: 'step-2', status: 'pending' }),
      ];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      const result = await service.getRunStatus('run-1');

      expect(result).toBeTruthy();
      expect(result?.run).toBeDefined();
      expect(result?.steps).toHaveLength(3);
      expect(result?.summary.totalSteps).toBe(3);
      expect(result?.summary.completedSteps).toBe(1);
    });

    it('returns null for non-existent run', async () => {
      runner.getRun.mockResolvedValue(null);

      const result = await service.getRunStatus('missing-run');

      expect(result).toBeNull();
    });

    it('identifies current step correctly', async () => {
      const run = createRun({ current_step_id: 'step-1' });
      const steps = [
        createStep({ step_index: 0, step_id: 'step-0' }),
        createStep({ step_index: 1, step_id: 'step-1' }),
      ];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      events.snapshotRun.mockReturnValue({
        id: 'run-1',
        status: 'running',
        currentStepId: 'step-1',
        stats: { totalSteps: 2, completedSteps: 1, progressPercentage: 50 },
      } as never);

      events.snapshotStep.mockImplementation(
        (r, s) =>
          ({
            id: s.step_id,
            index: s.step_index,
          }) as any,
      );

      const result = await service.getRunStatus('run-1');

      expect(result?.currentStep).toBeTruthy();
      expect(result?.currentStep?.id).toBe('step-1');
    });

    it('resolves current step by index fallback', async () => {
      const run = createRun({ current_step_id: null, current_step_index: 1 });
      const steps = [
        createStep({ step_index: 0, step_id: 'step-0' }),
        createStep({ step_index: 1, step_id: 'step-1' }),
      ];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      events.snapshotRun.mockReturnValue({
        id: 'run-1',
        currentStepId: 'index_1',
        stats: { totalSteps: 2, completedSteps: 0, progressPercentage: 0 },
      } as never);

      events.snapshotStep.mockImplementation(
        (r, s) =>
          ({
            id: s.step_id,
            index: s.step_index,
          }) as any,
      );

      const result = await service.getRunStatus('run-1');

      expect(result?.currentStep).toBeTruthy();
      expect(result?.currentStep?.index).toBe(1);
    });

    it('returns last step when current step not found', async () => {
      const run = createRun({ current_step_id: 'unknown-step' });
      const steps = [
        createStep({ step_index: 0, step_id: 'step-0' }),
        createStep({ step_index: 1, step_id: 'step-1' }),
      ];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      events.snapshotRun.mockReturnValue(
        createRunSnapshot({
          id: 'run-1',
          currentStepId: 'unknown-step',
          stats: { totalSteps: 2, completedSteps: 1, progressPercentage: 50 },
        }),
      );

      events.snapshotStep.mockImplementation(
        (r, s) =>
          ({
            id: s.step_id,
            index: s.step_index,
          }) as any,
      );

      const result = await service.getRunStatus('run-1');

      expect(result?.currentStep).toBeTruthy();
      expect(result?.currentStep?.index).toBe(1);
    });

    it('includes pending approvals', async () => {
      const run = createRun();
      const steps = [createStep()];
      const pendingApprovals = [
        {
          id: 'approval-1',
          status: 'pending' as const,
          mode: 'orchestration_checkpoint',
          agent_slug: 'test-agent',
          orchestration_step_id: 'step-1',
          orchestration_run_id: 'run-1',
          task_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: { checkpointId: 'review' },
          conversation_id: 'conv-1',
          organization_slug: 'org-1',
          approved_by: null,
          decision_at: null,
        },
      ];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);
      approvals.listPendingByRun.mockResolvedValue(pendingApprovals);

      const result = await service.getRunStatus('run-1');

      expect(result?.pendingApprovals).toHaveLength(1);
      expect(result?.pendingApprovals[0]?.id).toBe('approval-1');
      expect(result?.summary.pendingApprovals).toBe(1);
    });

    it('sorts steps by index', async () => {
      const run = createRun();
      const steps = [
        createStep({ step_index: 2, step_id: 'step-2' }),
        createStep({ step_index: 0, step_id: 'step-0' }),
        createStep({ step_index: 1, step_id: 'step-1' }),
      ];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      events.snapshotStep.mockImplementation(
        (r, s) =>
          ({
            id: s.step_id,
            index: s.step_index,
          }) as any,
      );

      const result = await service.getRunStatus('run-1');

      expect(result?.steps[0]?.index).toBe(0);
      expect(result?.steps[1]?.index).toBe(1);
      expect(result?.steps[2]?.index).toBe(2);
    });

    it('calculates summary correctly', async () => {
      const run = createRun();
      const steps = [createStep(), createStep(), createStep()];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      const snapshot: OrchestrationRunSnapshot = {
        id: 'run-1',
        status: 'running',
        currentStepId: 'step-1',
        stats: { totalSteps: 3, completedSteps: 2, progressPercentage: 67 },
        definitionId: 'def-1',
        name: 'test-orchestration',
        planId: null,
        conversationId: 'conv-1',
        parentRunId: null,
        organizationSlug: 'org-1',
        currentStepIndex: 1,
        completedSteps: ['step-0'],
        humanCheckpointId: null,
        plan: {},
        results: {},
        parameters: {},
        errorDetails: {},
        metadata: { agent: { slug: 'test-agent' } },
        timings: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: null,
        },
        agent: { id: null, slug: 'test-agent', type: null, displayName: null },
      };
      events.snapshotRun.mockReturnValue(snapshot);

      const result = await service.getRunStatus('run-1');

      expect(result?.summary).toEqual({
        totalSteps: 3,
        completedSteps: 2,
        progressPercentage: 67,
        pendingApprovals: 0,
      });
    });

    it('handles null currentStepId', async () => {
      const run = createRun({ current_step_id: null });
      const steps = [createStep()];

      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue(steps);

      const snapshot: OrchestrationRunSnapshot = {
        id: 'run-1',
        status: 'completed',
        currentStepId: null,
        stats: { totalSteps: 1, completedSteps: 1, progressPercentage: 100 },
        definitionId: 'def-1',
        name: 'test-orchestration',
        planId: null,
        conversationId: 'conv-1',
        parentRunId: null,
        organizationSlug: 'org-1',
        currentStepIndex: null,
        completedSteps: ['step-0'],
        humanCheckpointId: null,
        plan: {},
        results: {},
        parameters: {},
        errorDetails: {},
        metadata: { agent: { slug: 'test-agent' } },
        timings: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
        agent: { id: null, slug: 'test-agent', type: null, displayName: null },
      };
      events.snapshotRun.mockReturnValue(snapshot);

      const result = await service.getRunStatus('run-1');

      expect(result?.currentStep).toBeNull();
    });
  });
});
