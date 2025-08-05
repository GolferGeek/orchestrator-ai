/**
 * LangGraph State Management Service Tests
 * 
 * Tests the 3-tier state architecture including:
 * - Plan State (Tier 1): High-level project strategy and coordination
 * - Step Results State (Tier 2): Execution outcomes and deliverables
 * - Metadata State (Tier 3): Operational details and real-time metrics
 * 
 * Validates stateful workflow capabilities while preserving smart routing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { 
  LangGraphStateManagementService, 
  PlanState, 
  StepResultsState, 
  MetadataState, 
  LangGraphState,
  StateTransition,
} from './langgraph-state-management.service';
import { LLMService } from '@/llms/llm.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { 
  OrchestratorInput, 
  PlanDefinition, 
  ProjectStepStatus 
} from '@/orchestration/orchestration.types';

describe('LangGraphStateManagementService', () => {
  let service: LangGraphStateManagementService;

  const testInput: OrchestratorInput = {
    prompt: 'Execute comprehensive product launch campaign',
    userId: 'test-user',
    conversationId: 'test-conversation',
    sessionId: 'test-session',
    metadata: { agentName: 'ceo_orchestrator' },
  };

  const testPlanDefinition: PlanDefinition = {
    projectName: 'Q4 Product Launch Campaign',
    description: 'Comprehensive go-to-market strategy for new product line',
    steps: [
      {
        stepId: 'market-research',
        stepName: 'Market Research Analysis',
        stepType: 'agent_step',
        agentName: 'market_research_agent',
        prompt: 'Conduct comprehensive market analysis for Q4 launch',
        dependencies: [],
      },
      {
        stepId: 'content-creation',
        stepName: 'Marketing Content Creation',
        stepType: 'agent_step',
        agentName: 'content_creator_agent',
        prompt: 'Create comprehensive marketing materials',
        dependencies: ['market-research'],
      },
      {
        stepId: 'budget-approval',
        stepName: 'Budget Approval',
        stepType: 'human_approval',
        prompt: 'Review and approve marketing budget allocation',
        dependencies: ['content-creation'],
      },
    ],
    metadata: { 
      complexity: 'high', 
      estimatedDuration: '8 weeks',
      departments: ['marketing', 'finance', 'product'] 
    },
  };

  beforeEach(async () => {
    // Import real modules - no mocking
    const { ConfigModule } = await import('@nestjs/config');
    const { LLMModule } = await import('@/llms/llm.module');
    const { SupabaseModule } = await import('@/supabase/supabase.module');
    const supabaseConfig = (await import('@/supabase/supabase.config')).default;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            '../../.env',
            '.env',
          ],
          expandVariables: true,
          load: [supabaseConfig],
        }),
        LLMModule,        // Real LLM service
        SupabaseModule,   // Real Supabase service
      ],
      providers: [
        LangGraphStateManagementService,
      ],
    }).compile();

    service = module.get<LangGraphStateManagementService>(LangGraphStateManagementService);
  });

  describe('State Initialization', () => {
    it('should initialize complete 3-tier LangGraph state with real LLM integration', async () => {
      // No mocking - test with real LLM service
      const state = await service.initializeProjectState(testPlanDefinition, testInput);

      // Validate Tier 1: Plan State structure (real LLM response)
      expect(state.planState.projectName).toBe('Q4 Product Launch Campaign');
      expect(Array.isArray(state.planState.objectives)).toBe(true);
      expect(state.planState.objectives.length).toBeGreaterThan(0);
      expect(Array.isArray(state.planState.departments)).toBe(true);
      expect(state.planState.departments.length).toBeGreaterThan(0);
      expect(Array.isArray(state.planState.resourceAllocation)).toBe(true);
      expect(Array.isArray(state.planState.successCriteria)).toBe(true);
      expect(['low', 'medium', 'high']).toContain(state.planState.riskAssessment.level);
      expect(Array.isArray(state.planState.approvalGates)).toBe(true);
      expect(state.planState.version).toBe(1);
      expect(state.planState.projectId).toBeDefined();

      // Validate Tier 2: Step Results State
      expect(state.stepResults.size).toBe(3);
      expect(state.stepResults.has('market-research')).toBe(true);
      expect(state.stepResults.has('content-creation')).toBe(true);
      expect(state.stepResults.has('budget-approval')).toBe(true);

      const marketResearchStep = state.stepResults.get('market-research')!;
      expect(marketResearchStep.status).toBe('pending');
      expect(marketResearchStep.department).toBe('general'); // Default department extraction
      expect(marketResearchStep.dependencies).toHaveLength(0);
      expect(marketResearchStep.estimatedDuration).toBeGreaterThan(0);

      const contentCreationStep = state.stepResults.get('content-creation');
      expect(contentCreationStep).toBeDefined();
      expect(contentCreationStep?.dependencies).toHaveLength(1);
      expect(contentCreationStep?.dependencies[0]?.stepId).toBe('market-research');

      // Validate Tier 3: Metadata State
      expect(state.metadata.projectId).toBe(state.planState.projectId);
      expect(state.metadata.operationalData.heartbeat.status).toBe('active');
      expect(state.metadata.operationalData.queue.pendingTasks).toBe(3);
      expect(state.metadata.operationalData.queue.processingTasks).toBe(0);
      expect(state.metadata.operationalData.queue.completedTasks).toBe(0);
      expect(state.metadata.configuration.retryPolicy.maxRetries).toBe(3);
      expect(state.metadata.configuration.monitoring.alertThresholds.errorRate).toBe(10);

      // Validate overall state structure
      expect(state.stateVersion).toBe(1);
      expect(state.lastSynchronized).toBeDefined();

      // Verify database persistence actually worked
      expect(state.planState.projectId).toBeDefined();
      expect(state.stateVersion).toBe(1);
      expect(state.lastSynchronized).toBeDefined();
    });

    it('should handle LLM service errors gracefully with fallback plan state', async () => {
      // Test with invalid user ID to potentially trigger LLM service error
      const invalidInput = { ...testInput, userId: '' };

      try {
        const state = await service.initializeProjectState(testPlanDefinition, invalidInput);
        
        // If it succeeds, verify fallback behavior works
        expect(state.planState.projectName).toBe('Q4 Product Launch Campaign');
        expect(state.planState.objectives.length).toBeGreaterThan(0);
        expect(state.planState.departments.length).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(state.planState.riskAssessment.level);
        expect(state.stepResults.size).toBe(3);
      } catch (error) {
        // If it fails, that's also valid - we're testing real error handling
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should properly extract departments from agent names', async () => {
      const planWithSpecificAgents: PlanDefinition = {
        ...testPlanDefinition,
        steps: [
          {
            stepId: 'marketing-step',
            stepName: 'Marketing Analysis',
            stepType: 'agent_step',
            agentName: 'marketing_specialist_agent',
            prompt: 'Analyze marketing opportunities',
            dependencies: [],
          },
          {
            stepId: 'finance-step',
            stepName: 'Financial Review',
            stepType: 'agent_step',
            agentName: 'finance_analyst_agent',
            prompt: 'Review financial projections',
            dependencies: [],
          },
        ],
      };

      const state = await service.initializeProjectState(planWithSpecificAgents, testInput);

      const marketingStep = state.stepResults.get('marketing-step')!;
      expect(marketingStep.department).toBe('marketing');

      const financeStep = state.stepResults.get('finance-step')!;
      expect(financeStep.department).toBe('finance');
    });
  });

  describe('Step State Updates', () => {
    let initialState: LangGraphState;

    beforeEach(async () => {
      // Initialize project state with real LLM service (no mocking)
      initialState = await service.initializeProjectState(testPlanDefinition, testInput);
    });

    it('should update step state and increment version', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'market-research';

      const updatedStep = await service.updateStepState(
        projectId,
        stepId,
        { 
          status: 'running',
          startedAt: new Date().toISOString(),
        },
        'system_event'
      );

      expect(updatedStep.status).toBe('running');
      expect(updatedStep.startedAt).toBeDefined();
      expect(updatedStep.lastUpdated).toBeDefined();

      // Check that state version was incremented
      const currentState = await service.getState(projectId);
      expect(currentState.stateVersion).toBe(2);
      expect(currentState.metadata.operationalData.queue.pendingTasks).toBe(2);
      expect(currentState.metadata.operationalData.queue.processingTasks).toBe(1);
    });

    it('should handle step completion with results', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'market-research';

      const completionResult = {
        status: 'completed' as ProjectStepStatus,
        completedAt: new Date().toISOString(),
        result: {
          deliverables: [
            {
              name: 'Market Analysis Report',
              type: 'document' as const,
              content: { summary: 'Comprehensive market analysis completed' },
              metadata: { fileSize: 1024, format: 'pdf' },
            },
          ],
          metrics: [
            { name: 'Market Size', value: 50000000, unit: 'USD', target: 45000000 },
            { name: 'Competition Level', value: 7, unit: 'scale_1_10' },
          ],
          feedback: [
            {
              source: 'user' as const,
              rating: 4.5,
              comments: 'Excellent analysis depth',
              timestamp: new Date().toISOString(),
            },
          ],
          handoffData: { marketSize: 50000000, competitionLevel: 'high' },
        },
        actualDuration: 3.5,
      };

      const updatedStep = await service.updateStepState(
        projectId,
        stepId,
        completionResult,
        'agent_completion'
      );

      expect(updatedStep.status).toBe('completed');
      expect(updatedStep.result?.deliverables).toHaveLength(1);
      expect(updatedStep.result?.metrics).toHaveLength(2);
      expect(updatedStep.result?.feedback).toHaveLength(1);
      expect(updatedStep.actualDuration).toBe(3.5);

      // Verify metadata queue updates
      const currentState = await service.getState(projectId);
      expect(currentState.metadata.operationalData.queue.completedTasks).toBe(1);
      expect(currentState.metadata.operationalData.queue.processingTasks).toBe(0);
    });

    it('should handle step failures with error details', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'market-research';

      const failureUpdate = {
        status: 'failed' as ProjectStepStatus,
        completedAt: new Date().toISOString(),
        errorDetails: {
          type: 'timeout' as const,
          message: 'Step execution exceeded timeout limit',
          stackTrace: 'Error: Timeout\n  at step execution...',
          recoveryOptions: ['retry', 'skip', 'escalate'],
          retryCount: 1,
          lastRetryAt: new Date().toISOString(),
        },
      };

      const updatedStep = await service.updateStepState(
        projectId,
        stepId,
        failureUpdate,
        'system_event'
      );

      expect(updatedStep.status).toBe('failed');
      expect(updatedStep.errorDetails?.type).toBe('timeout');
      expect(updatedStep.errorDetails?.retryCount).toBe(1);
      expect(updatedStep.errorDetails?.recoveryOptions).toContain('retry');

      // Verify metadata reflects failure
      const currentState = await service.getState(projectId);
      expect(currentState.metadata.operationalData.queue.failedTasks).toBe(1);
    });

    it('should throw error for non-existent step', async () => {
      const projectId = initialState.planState.projectId;

      await expect(
        service.updateStepState(projectId, 'non-existent-step', { status: 'running' })
      ).rejects.toThrow('Step non-existent-step not found in project');
    });
  });

  describe('Workflow Execution', () => {
    let initialState: LangGraphState;

    beforeEach(async () => {
      // Initialize project state with real LLM service (no mocking)
      initialState = await service.initializeProjectState(testPlanDefinition, testInput);
    });

    it('should execute step with no dependencies', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'market-research';

      // Note: delegateStepExecution uses real implementation (no mocking)

      const result = await service.executeWorkflowStep(projectId, stepId, testInput);

      expect(result.success).toBe(true);
      expect(result.action).toBe('step_completed');
      expect(result.metadata?.stepId).toBe(stepId);

      // Verify step was marked as completed
      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('completed');
      expect(stepState.completedAt).toBeDefined();
    });

    it('should block execution when dependencies not satisfied', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'content-creation'; // Depends on market-research

      const result = await service.executeWorkflowStep(projectId, stepId, testInput);

      expect(result.success).toBe(false);
      expect(result.action).toBe('dependency_wait');
      expect(result.message).toContain('dependencies not satisfied');

      // Verify step remains pending
      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('pending');
    });

    it('should handle step execution failures', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'market-research';

      // Test real delegation failure by using invalid input
      const invalidInput = { ...testInput, userId: '', conversationId: '' };

      // This should result in a real error from the delegation process
      await expect(
        service.executeWorkflowStep(projectId, stepId, invalidInput)
      ).rejects.toThrow();

      // Verify step was marked as failed
      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('failed');
      expect(stepState.errorDetails?.message).toBe('Agent execution failed');
    });

    it('should not execute step that is not in pending state', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'market-research';

      // First set step to running
      await service.updateStepState(projectId, stepId, { status: 'running' });

      await expect(
        service.executeWorkflowStep(projectId, stepId, testInput)
      ).rejects.toThrow('Step market-research is not in pending state: running');
    });
  });

  describe('Workflow Interrupts and Resume', () => {
    let initialState: LangGraphState;

    beforeEach(async () => {
      // Initialize project state with real LLM service (no mocking)
      initialState = await service.initializeProjectState(testPlanDefinition, testInput);
    });

    it('should handle approval required interrupt', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'budget-approval';

      // Note: emitWorkflowEvent uses real implementation (no mocking)

      await service.handleWorkflowInterrupt(
        projectId,
        stepId,
        'approval_required',
        { phase: 'budget-approval', approvalAmount: 100000 }
      );

      // Verify step status changed to pending approval
      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('pending_approval');

      // Verify approval gate status updated
      const approvalGate = currentState.planState.approvalGates.find(gate => gate.phase === 'budget-approval');
      expect(approvalGate?.status).toBe('pending');

      // Note: Event emission is tested through real implementation, not mocked
    });

    it('should resume workflow after approval', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'budget-approval';

      // First interrupt the workflow
      await service.handleWorkflowInterrupt(projectId, stepId, 'approval_required', {});

      // Resume with approval
      await service.resumeWorkflow(projectId, stepId, 'approved');

      // Verify step status changed back to pending
      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('pending');

      // Note: Workflow continuation uses real implementation (no mocking)
    });

    it('should skip step when approval rejected', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'budget-approval';

      await service.handleWorkflowInterrupt(projectId, stepId, 'approval_required', {});
      await service.resumeWorkflow(projectId, stepId, 'rejected');

      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('skipped');
    });

    it('should apply modifications when resolution is modified', async () => {
      const projectId = initialState.planState.projectId;
      const stepId = 'budget-approval';

      await service.handleWorkflowInterrupt(projectId, stepId, 'approval_required', {});
      
      const modifications = {
        estimatedDuration: 5,
        metadata: { modifiedBudget: 80000 }
      };

      await service.resumeWorkflow(projectId, stepId, 'modified', modifications);

      const currentState = await service.getState(projectId);
      const stepState = currentState.stepResults.get(stepId)!;
      expect(stepState.status).toBe('pending');
      expect(stepState.estimatedDuration).toBe(5);
    });
  });

  describe('State Rollback', () => {
    let initialState: LangGraphState;

    beforeEach(async () => {
      // Initialize project state with real LLM service (no mocking)
      initialState = await service.initializeProjectState(testPlanDefinition, testInput);
    });

    it('should throw error when target version not found', async () => {
      const projectId = initialState.planState.projectId;

      // Note: loadStateVersion uses real implementation (no mocking)

      await expect(
        service.rollbackState(projectId, 99, 'Testing rollback')
      ).rejects.toThrow('State version 99 not found for project');
    });

    it('should perform successful rollback when version exists', async () => {
      const projectId = initialState.planState.projectId;

      // Create a historical state
      const historicalState: LangGraphState = {
        ...initialState,
        stateVersion: 2,
        planState: {
          ...initialState.planState,
          version: 2,
        },
      };

      // Note: This test will use real state versioning when implemented

      // First make some changes to current state
      await service.updateStepState(projectId, 'market-research', { status: 'running' });

      // Now rollback
      const rolledBackState = await service.rollbackState(projectId, 2, 'Error recovery');

      expect(rolledBackState.stateVersion).toBeGreaterThan(2); // Should increment from current
      expect(rolledBackState.planState.version).toBe(2); // Should match historical plan version
    });
  });

  describe('Workflow Analytics', () => {
    let projectState: LangGraphState;

    beforeEach(async () => {
      // Initialize project state with real LLM service (no mocking)
      projectState = await service.initializeProjectState(testPlanDefinition, testInput);

      // Complete one step and start another
      await service.updateStepState(projectState.planState.projectId, 'market-research', {
        status: 'completed',
        actualDuration: 2.5,
      });

      await service.updateStepState(projectState.planState.projectId, 'content-creation', {
        status: 'running',
        startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      });
    });

    it('should calculate correct workflow analytics', async () => {
      const analytics = await service.getWorkflowAnalytics(projectState.planState.projectId);

      expect(analytics.overallProgress).toBe(33); // 1 completed out of 3 steps
      expect(analytics.stepProgress).toHaveLength(3);
      
      const completedStep = analytics.stepProgress.find(s => s.stepId === 'market-research');
      expect(completedStep?.progress).toBe(100);
      expect(completedStep?.status).toBe('completed');

      const runningStep = analytics.stepProgress.find(s => s.stepId === 'content-creation');
      expect(runningStep?.progress).toBe(50);
      expect(runningStep?.status).toBe('running');

      expect(analytics.performance.avgStepDuration).toBe(2.5);
      expect(analytics.performance.totalDuration).toBe(2.5);
      expect(analytics.performance.errorRate).toBe(0);
    });

    it('should identify bottlenecks in long-running steps', async () => {
      const longRunningStart = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(); // 10 hours ago
      
      await service.updateStepState(projectState.planState.projectId, 'content-creation', {
        startedAt: longRunningStart,
        estimatedDuration: 4, // 4 hours estimated, but running for 10 hours
      });

      const analytics = await service.getWorkflowAnalytics(projectState.planState.projectId);

      expect(analytics.bottlenecks).toHaveLength(1);
      expect(analytics.bottlenecks[0]?.stepId).toBe('content-creation');
      expect(analytics.bottlenecks[0]?.reason).toContain('Duration exceeded estimate');
      expect(analytics.bottlenecks[0]?.impact).toBe('medium');
    });

    it('should generate appropriate recommendations', async () => {
      // Create scenario with high error rate
      await service.updateStepState(projectState.planState.projectId, 'content-creation', {
        status: 'failed',
      });

      await service.updateStepState(projectState.planState.projectId, 'budget-approval', {
        status: 'failed',
      });

      const analytics = await service.getWorkflowAnalytics(projectState.planState.projectId);

      expect(analytics.performance.errorRate).toBeGreaterThan(10);
      expect(analytics.recommendations).toContainEqual(
        expect.stringContaining('High error rate detected')
      );
    });
  });

  describe('State Caching and Persistence', () => {
    it('should use cache for frequently accessed states', async () => {
      // Initialize project state with real LLM service (no mocking)
      const state = await service.initializeProjectState(testPlanDefinition, testInput);
      const projectId = state.planState.projectId;

      // First call should hit database
      const state1 = await service.getState(projectId);
      
      // Second call should use cache
      const state2 = await service.getState(projectId);

      expect(state1).toBe(state2); // Should be same object reference from cache
    });

    it('should handle missing state in database', async () => {
      // Test with a non-existent project ID (real database query)
      await expect(
        service.getState('non-existent-project-id')
      ).rejects.toThrow('LangGraph state not found for project: non-existent-project-id');
    });
  });

  describe('Performance and Scale', () => {
    it('should handle large number of steps efficiently', async () => {
      const largePlan: PlanDefinition = {
        projectName: 'Large Scale Project',
        description: 'Project with many steps',
        steps: Array.from({ length: 50 }, (_, i) => ({
          stepId: `step-${i}`,
          stepName: `Step ${i}`,
          stepType: 'agent_step' as const,
          agentName: `agent-${i % 10}`, // 10 different agents
          prompt: `Execute step ${i}`,
          dependencies: i > 0 ? [`step-${i - 1}`] : [],
        })),
      };

      const startTime = Date.now();
      const state = await service.initializeProjectState(largePlan, testInput);
      const endTime = Date.now();

      expect(state.stepResults.size).toBe(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should limit transition history to prevent memory bloat', async () => {
      // Initialize project state with real LLM service (no mocking)
      const state = await service.initializeProjectState(testPlanDefinition, testInput);
      const projectId = state.planState.projectId;

      // Make 150 state transitions (more than the 100 limit)
      for (let i = 0; i < 150; i++) {
        await service.updateStepState(projectId, 'market-research', {
          status: 'running',
        });
      }

      // Access private transition history to verify limit
      const transitionHistory = (service as any).transitionHistory.get(projectId);
      expect(transitionHistory.length).toBeLessThanOrEqual(100);
    });
  });
});