import { OrchestrationExecutionService } from './orchestration-execution.service';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationStateService } from './orchestration-state.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';

const createRunRecord = (
  overrides: Partial<OrchestrationRunRecord> = {},
): OrchestrationRunRecord => ({
  id: 'run-1',
  plan_id: null,
  orchestration_definition_id: null,
  orchestration_name: 'demo',
  conversation_id: null,
  parent_orchestration_run_id: null,
  origin_type: 'plan',
  origin_id: null,
  orchestration_slug: null,
  parameters: {},
  organization_slug: 'org',
  status: 'planning',
  current_step_index: null,
  current_step_id: null,
  completed_steps: [],
  step_state: {},
  human_checkpoint_id: null,
  plan: {},
  results: {},
  error_details: {},
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  started_at: new Date().toISOString(),
  completed_at: null,
  created_by: null,
  ...overrides,
});

const createStepRecord = (
  overrides: Partial<OrchestrationStepRecord> = {},
): OrchestrationStepRecord => ({
  id: 'step-1',
  orchestration_run_id: 'run-1',
  step_index: 0,
  step_id: 'fetch-data',
  status: 'pending',
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
  output: null,
  metadata: {},
  error_details: null,
  started_at: null,
  completed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('OrchestrationExecutionService', () => {
  const runner = {
    getRun: jest.fn(),
    updateRun: jest.fn(),
    updateStep: jest.fn(),
    listSteps: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationRunnerService>;

  const state = {
    findRunnableSteps: jest.fn(),
  } as unknown as jest.Mocked<OrchestrationStateService>;

  let service: OrchestrationExecutionService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OrchestrationExecutionService(runner, state);
  });

  describe('startExecution', () => {
    it('queues ready steps and sets run to running', async () => {
      const run = createRunRecord();
      const step = createStepRecord();

      runner.getRun.mockResolvedValue(run);
      state.findRunnableSteps.mockResolvedValue([step]);
      runner.updateStep.mockResolvedValue({ ...step, status: 'queued' });
      runner.updateRun.mockResolvedValue({
        ...run,
        status: 'running',
        current_step_index: 0,
        current_step_id: 'fetch-data',
        step_state: {
          'fetch-data': { status: 'queued' },
        },
      });

      const result = await service.startExecution(run.id);

      expect(result.run.status).toBe('running');
      expect(result.readySteps).toHaveLength(1);
      expect(result.readySteps[0]?.status).toBe('queued');
    });
  });

  describe('markStepCompleted', () => {
    it('marks run completed when final step finishes', async () => {
      const step = createStepRecord({ status: 'running' });
      const completedStep = { ...step, status: 'completed' };
      const run = createRunRecord({
        status: 'running',
        step_state: {},
        results: {},
      });

      runner.updateStep.mockResolvedValue(completedStep);
      runner.getRun.mockResolvedValue(run);
      runner.listSteps.mockResolvedValue([completedStep]);
      runner.updateRun.mockResolvedValue({
        ...run,
        status: 'completed',
        completed_steps: ['fetch-data'],
      });

      const { run: updatedRun, nextSteps } = await service.markStepCompleted(
        step.id,
        { rows: 42 },
      );

      expect(updatedRun.status).toBe('completed');
      expect(nextSteps).toHaveLength(0);
    });
  });

  describe('markStepFailed', () => {
    it('updates run status to failed', async () => {
      const step = createStepRecord({ status: 'running' });
      const failedStep = { ...step, status: 'failed' };
      const run = createRunRecord({ status: 'running' });

      runner.updateStep.mockResolvedValue(failedStep);
      runner.getRun.mockResolvedValue(run);
      runner.updateRun.mockResolvedValue({
        ...run,
        status: 'failed',
        error_details: { lastError: { message: 'boom' } },
      });

      const { run: failedRun } = await service.markStepFailed(step.id, {
        message: 'boom',
      });

      expect(failedRun.status).toBe('failed');
    });
  });
});
