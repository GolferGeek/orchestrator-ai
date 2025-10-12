import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrchestrationCheckpointService } from './orchestration-checkpoint.service';
import { HumanApprovalsRepository } from '../repositories/human-approvals.repository';
import { OrchestrationRunnerService } from './orchestration-runner.service';
import { OrchestrationRunRecord } from '../interfaces/orchestration-run-record.interface';
import { OrchestrationStepRecord } from '../interfaces/orchestration-step-record.interface';

const createRun = (overrides: Partial<OrchestrationRunRecord> = {}): OrchestrationRunRecord => ({
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
  status: 'running',
  current_step_index: 0,
  current_step_id: 'step-1',
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

const createStep = (overrides: Partial<OrchestrationStepRecord> = {}): OrchestrationStepRecord => ({
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

describe('OrchestrationCheckpointService', () => {
  let approvals: jest.Mocked<HumanApprovalsRepository>;
  let runner: jest.Mocked<OrchestrationRunnerService>;
  let eventEmitter: EventEmitter2;
  let service: OrchestrationCheckpointService;

  beforeEach(() => {
    approvals = {
      create: jest.fn(),
      setStatus: jest.fn(),
      get: jest.fn(),
    } as unknown as jest.Mocked<HumanApprovalsRepository>;

    runner = {
      getRun: jest.fn(),
      updateRun: jest.fn(),
      getStep: jest.fn(),
      updateStep: jest.fn(),
      listSteps: jest.fn(),
      createStep: jest.fn(),
    } as unknown as jest.Mocked<OrchestrationRunnerService>;

    eventEmitter = new EventEmitter2();
    jest.spyOn(eventEmitter, 'emit');

    service = new OrchestrationCheckpointService(
      approvals,
      runner,
      eventEmitter,
    );
  });

  it('creates approval and pauses run when checkpoint requested', async () => {
    const run = createRun();
    runner.getRun.mockResolvedValueOnce(run);
    runner.updateRun.mockResolvedValue({ ...run, status: 'checkpoint' });

    approvals.create.mockResolvedValue({
      id: 'approval-1',
      organization_slug: run.organization_slug,
      agent_slug: 'finance-manager',
      conversation_id: run.conversation_id,
      task_id: null,
      orchestration_run_id: run.id,
      orchestration_step_id: 'orch-step-rec-1',
      mode: 'orchestration_checkpoint',
      status: 'pending',
      metadata: {},
    });

    runner.getRun.mockResolvedValueOnce({
      ...run,
      status: 'checkpoint',
      human_checkpoint_id: 'approval-1',
    });

    const result = await service.requestCheckpoint({
      runId: run.id,
      checkpointId: 'review-step',
      question: 'Approve SQL output?',
      agentSlug: 'finance-manager',
      stepId: 'step-1',
      stepRecordId: 'orch-step-rec-1',
      stepIndex: 0,
      stepLabel: 'Fetch KPI Data',
      options: [
        { action: 'continue', label: 'Continue' },
        { action: 'retry', label: 'Retry', allowsModification: true },
      ],
    });

    expect(result.approvalId).toBe('approval-1');
    expect(approvals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orchestrationRunId: run.id,
        orchestrationStepId: 'orch-step-rec-1',
      }),
    );
    expect(runner.updateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: run.id,
        status: 'checkpoint',
        humanCheckpointId: 'approval-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'orchestration.checkpoint.requested',
      expect.objectContaining({
        runId: run.id,
        approvalId: 'approval-1',
      }),
    );
  });

  it('resolves checkpoint with continue decision', async () => {
    const run = createRun({ human_checkpoint_id: 'approval-1' });
    const updatedRun = { ...run, status: 'running', human_checkpoint_id: null };

    runner.getRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(updatedRun);
    runner.updateRun.mockResolvedValue(updatedRun);

    approvals.get.mockResolvedValue({
      id: 'approval-1',
      organization_slug: run.organization_slug,
      agent_slug: 'finance-manager',
      conversation_id: run.conversation_id,
      task_id: null,
      orchestration_run_id: run.id,
      orchestration_step_id: 'orch-step-rec-1',
      mode: 'orchestration_checkpoint',
      status: 'pending',
      metadata: {
        runId: run.id,
        checkpointId: 'review-step',
        step: {
          recordId: 'orch-step-rec-1',
          definitionId: 'step-1',
          index: 0,
        },
        question: 'Approve?',
        options: [],
      },
    } as any);

    approvals.setStatus.mockResolvedValue({
      id: 'approval-1',
      organization_slug: run.organization_slug,
      agent_slug: 'finance-manager',
      conversation_id: run.conversation_id,
      task_id: null,
      orchestration_run_id: run.id,
      orchestration_step_id: 'orch-step-rec-1',
      mode: 'orchestration_checkpoint',
      status: 'approved',
      metadata: {},
    } as any);

    const result = await service.resolveCheckpoint({
      approvalId: 'approval-1',
      decision: 'continue',
      actorId: 'user-1',
    });

    expect(result.run.status).toBe('running');
    expect(result.decision).toBe('continue');
    expect(approvals.setStatus).toHaveBeenCalledWith(
      'approval-1',
      'approved',
      'user-1',
      expect.objectContaining({
        decision: expect.objectContaining({ action: 'continue' }),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'orchestration.checkpoint.resolved',
      expect.objectContaining({
        runId: run.id,
        approvalId: 'approval-1',
        decision: 'continue',
      }),
    );
  });

  it('resets step when retry decision received', async () => {
    const run = createRun({
      human_checkpoint_id: 'approval-1',
      completed_steps: ['step-1'],
    });
    const step = createStep();
    const updatedRun = {
      ...run,
      status: 'running',
      completed_steps: [],
      human_checkpoint_id: null,
    };

    runner.getRun
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(updatedRun);
    runner.updateRun.mockResolvedValue(updatedRun);
    runner.getStep.mockResolvedValue(step);

    approvals.get.mockResolvedValue({
      id: 'approval-1',
      organization_slug: run.organization_slug,
      agent_slug: 'finance-manager',
      conversation_id: run.conversation_id,
      task_id: null,
      orchestration_run_id: run.id,
      orchestration_step_id: step.id,
      mode: 'orchestration_checkpoint',
      status: 'pending',
      metadata: {
        runId: run.id,
        checkpointId: 'review-step',
        step: {
          recordId: step.id,
          definitionId: step.step_id,
          index: 0,
        },
      },
    } as any);

    approvals.setStatus.mockResolvedValue({
      id: 'approval-1',
      organization_slug: run.organization_slug,
      agent_slug: 'finance-manager',
      conversation_id: run.conversation_id,
      task_id: null,
      orchestration_run_id: run.id,
      orchestration_step_id: step.id,
      mode: 'orchestration_checkpoint',
      status: 'approved',
      metadata: {},
    } as any);

    await service.resolveCheckpoint({
      approvalId: 'approval-1',
      decision: 'retry',
      actorId: 'user-1',
    });

    expect(runner.updateStep).toHaveBeenCalledWith(step.id, {
      status: 'pending',
      attempt_number: step.attempt_number + 1,
      started_at: null,
      completed_at: null,
      output: null,
      error_details: null,
    });
  });
});
