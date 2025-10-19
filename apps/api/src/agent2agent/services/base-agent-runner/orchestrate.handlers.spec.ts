import 'reflect-metadata';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentTaskMode, TaskRequestDto } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';
import { handleOrchestrateAction } from './orchestrate.handlers';

const createAgentDefinition = (
  overrides: Partial<AgentRuntimeDefinition> = {},
): AgentRuntimeDefinition => ({
  id: 'agent-1',
  slug: 'test-orchestrator',
  organizationSlug: 'org-1',
  displayName: 'Test Orchestrator',
  description: null,
  agentType: 'orchestrator',
  modeProfile: 'full_cycle',
  metadata: { tags: [] },
  hierarchy: undefined,
  capabilities: [],
  skills: [],
  communication: { inputModes: ['text/plain'], outputModes: ['text/markdown'] },
  execution: {
    modeProfile: 'full_cycle',
    canConverse: true,
    canPlan: true,
    canBuild: true,
    canOrchestrate: true,
    requiresHumanGate: false,
  },
  transport: undefined,
  llm: undefined,
  prompts: { system: '', plan: '', build: '', human: '', additional: null },
  context: null,
  config: {},
  agentCard: null,
  rawDescriptor: null,
  record: {} as Record<string, unknown>,
  ...overrides,
});

const createRequest = (
  payload: Record<string, unknown>,
  overrides: Partial<TaskRequestDto> = {},
): TaskRequestDto => ({
  mode: AgentTaskMode.ORCHESTRATE,
  conversationId: 'conv-1',
  userMessage: 'test message',
  messages: [],
  payload,
  metadata: {},
  ...overrides,
});

type MockRunnerContext = {
  handlePlan: jest.Mock;
  executeBuild: jest.Mock;
  checkpointService?: {
    resolveCheckpoint: jest.Mock;
  };
};

describe('orchestrate.handlers', () => {
  describe('handleOrchestrateAction', () => {
    let definition: AgentRuntimeDefinition;
    let runnerContext: MockRunnerContext;

    beforeEach(() => {
      definition = createAgentDefinition();
      runnerContext = {
        handlePlan: jest.fn().mockResolvedValue(
          TaskResponseDto.success(AgentTaskMode.ORCHESTRATE, {
            content: { action: 'create', result: 'plan created' },
            metadata: {
              provider: '',
              model: '',
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                cost: 0,
              },
            },
          }),
        ),
        executeBuild: jest.fn().mockResolvedValue(
          TaskResponseDto.success(AgentTaskMode.ORCHESTRATE, {
            content: { action: 'execute', result: 'build executed' },
            metadata: {
              provider: '',
              model: '',
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                cost: 0,
              },
            },
          }),
        ),
        checkpointService: {
          resolveCheckpoint: jest.fn(),
        },
      };
    });

    describe('action routing', () => {
      it('should route "create" action to handlePlan', async () => {
        const request = createRequest({ action: 'create', parameters: {} });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.handlePlan).toHaveBeenCalledWith(
          definition,
          request,
          'org-1',
        );
        expect(response.success).toBe(true);
        expect(response.mode).toBe(AgentTaskMode.ORCHESTRATE);
      });

      it('should route "execute" action to executeBuild', async () => {
        const request = createRequest({
          action: 'execute',
          orchestrationRunId: 'run-1',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.executeBuild).toHaveBeenCalledWith(
          definition,
          request,
          'org-1',
        );
        expect(response.success).toBe(true);
      });

      it('should route "continue" action to executeBuild', async () => {
        const request = createRequest({
          action: 'continue',
          orchestrationRunId: 'run-1',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.executeBuild).toHaveBeenCalledWith(
          definition,
          request,
          'org-1',
        );
        expect(response.success).toBe(true);
      });

      it('should route "run_start" action to executeBuild', async () => {
        const request = createRequest({
          action: 'run_start',
          orchestrationId: 'orch-1',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.executeBuild).toHaveBeenCalledWith(
          definition,
          request,
          'org-1',
        );
        expect(response.success).toBe(true);
      });

      it('should route "plan_create" action to handlePlan', async () => {
        const request = createRequest({
          action: 'plan_create',
          parameters: {},
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.handlePlan).toHaveBeenCalledWith(
          definition,
          request,
          'org-1',
        );
        expect(response.success).toBe(true);
      });

      it('should route "plan_update" action to handlePlan', async () => {
        const request = createRequest({
          action: 'plan_update',
          planId: 'plan-1',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.handlePlan).toHaveBeenCalledWith(
          definition,
          request,
          'org-1',
        );
        expect(response.success).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should return failure when action field is missing', async () => {
        const request = createRequest({ parameters: {} });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.mode).toBe(AgentTaskMode.ORCHESTRATE);
        expect(response.payload.metadata?.reason).toContain(
          'Action field is required',
        );
      });

      it('should return failure for unknown action', async () => {
        const request = createRequest({ action: 'unknown_action' });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain('Unknown action');
      });

      it('should return failure for unimplemented actions', async () => {
        const request = createRequest({ action: 'run_pause', runId: 'run-1' });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'not yet implemented',
        );
      });

      it('should catch and return errors from handlers', async () => {
        runnerContext.handlePlan.mockRejectedValue(
          new Error('Plan creation failed'),
        );
        const request = createRequest({ action: 'create', parameters: {} });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'Plan creation failed',
        );
      });
    });

    describe('handleRunHumanResponse', () => {
      beforeEach(() => {
        runnerContext.checkpointService.resolveCheckpoint.mockResolvedValue({
          approval: { id: 'approval-1', status: 'approved' },
          run: { id: 'run-1', status: 'running' },
          decision: 'continue',
        });
      });

      it('should validate approvalId is required', async () => {
        const request = createRequest({
          action: 'run_human_response',
          decision: 'continue',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'approvalId is required',
        );
      });

      it('should validate decision is required', async () => {
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'decision must be one of',
        );
      });

      it('should validate decision is valid', async () => {
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
          decision: 'invalid',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'decision must be one of',
        );
      });

      it('should return failure when checkpointService is not available', async () => {
        const contextWithoutCheckpoint = {
          ...runnerContext,
          checkpointService: undefined,
        };
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
          decision: 'continue',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          contextWithoutCheckpoint,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'Checkpoint service not available',
        );
      });

      it('should resolve checkpoint with correct parameters for continue', async () => {
        const request = createRequest(
          {
            action: 'run_human_response',
            approvalId: 'approval-1',
            decision: 'continue',
            notes: 'Looks good',
            modifications: { key: 'value' },
          },
          { metadata: { userId: 'user-1' } },
        );

        await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.checkpointService.resolveCheckpoint).toHaveBeenCalledWith({
          approvalId: 'approval-1',
          decision: 'continue',
          actorId: 'user-1',
          notes: 'Looks good',
          modifications: { key: 'value' },
        });
      });

      it('should continue orchestration on continue decision', async () => {
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
          decision: 'continue',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.executeBuild).toHaveBeenCalledWith(
          definition,
          expect.objectContaining({
            payload: expect.objectContaining({
              action: 'continue',
              runId: 'run-1',
            }) as { action: string; runId: string },
          }),
          'org-1',
        );
        expect(response.success).toBe(true);
      });

      it('should retry orchestration on retry decision', async () => {
        runnerContext.checkpointService.resolveCheckpoint.mockResolvedValue({
          approval: { id: 'approval-1', status: 'approved' },
          run: { id: 'run-1', status: 'running' },
          decision: 'retry',
        });
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
          decision: 'retry',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.executeBuild).toHaveBeenCalledWith(
          definition,
          expect.objectContaining({
            payload: expect.objectContaining({
              action: 'continue',
              runId: 'run-1',
            }) as { action: string; runId: string },
          }),
          'org-1',
        );
        expect(response.success).toBe(true);
      });

      it('should return success without continuing on abort decision', async () => {
        runnerContext.checkpointService.resolveCheckpoint.mockResolvedValue({
          approval: { id: 'approval-1', status: 'rejected' },
          run: { id: 'run-1', status: 'aborted' },
          decision: 'abort',
        });
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
          decision: 'abort',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(runnerContext.executeBuild).not.toHaveBeenCalled();
        expect(response.success).toBe(true);
        expect(response.payload.content).toMatchObject({
          action: 'run_human_response',
          decision: 'abort',
          runId: 'run-1',
          status: 'aborted',
        });
      });

      it('should return failure when checkpoint resolution fails', async () => {
        runnerContext.checkpointService.resolveCheckpoint.mockRejectedValue(
          new Error('Checkpoint not found'),
        );
        const request = createRequest({
          action: 'run_human_response',
          approvalId: 'approval-1',
          decision: 'continue',
        });

        const response = await handleOrchestrateAction(
          definition,
          request,
          'org-1',
          {},
          runnerContext,
        );

        expect(response.success).toBe(false);
        expect(response.payload.metadata?.reason).toContain(
          'Checkpoint not found',
        );
      });
    });
  });
});
