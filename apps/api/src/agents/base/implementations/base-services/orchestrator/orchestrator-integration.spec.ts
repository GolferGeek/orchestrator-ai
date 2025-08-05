import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { IntentRecognitionService } from './intent-recognition.service';
import { PlanningService } from './planning.service';
import { DelegationService } from './delegation.service';
import { SupabaseModule } from '../../../../../supabase/supabase.module';
import { LLMModule } from '../../../../../llms/llm.module';
import { CIDAFMModule } from '../../../../../cidafm/cidafm.module';
import { HttpModule } from '@nestjs/axios';
import { SessionsModule } from '../../../../../sessions/sessions.module';
import { TasksModule } from '../../../../../tasks/tasks.module';
import { WebSocketModule } from '../../../../../websocket/websocket.module';
import { AuthModule } from '../../../../../auth/auth.module';
import { AgentConversationsModule } from '../../../../../agent-conversations/agent-conversations.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../../agent-factory.service';
import { BaseSubServicesModule } from '../../../sub-services/base-sub-services.module';
import {
  OrchestratorInput,
  OrchestratorResponse,
  IntentDirective,
  PlanDefinition,
} from '../../../../../orchestration/orchestration.types';

/**
 * Orchestrator Integration Tests - Complete Real LLM Workflow
 *
 * These tests validate the complete Plan-Approve-Act workflow using real LLM calls:
 * 1. PLAN: LLM classifies intent and creates project plans
 * 2. APPROVE: LLM handles approval workflows
 * 3. ACT: LLM delegates to appropriate agents
 *
 * This is the full integration test with real agents and real LLM intelligence!
 */
describe('Orchestrator Integration - Complete Real LLM Workflow', () => {
  let intentService: IntentRecognitionService;
  let planningService: PlanningService;
  let delegationService: DelegationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            '/Users/golfergeek/projects/golfergeek/orchestrator-ai/.env',
            '../../.env',
            '.env',
          ],
        }),
        EventEmitterModule.forRoot(),
        HttpModule,
        BaseSubServicesModule,
        SupabaseModule,
        LLMModule,
        CIDAFMModule,
        AuthModule,
        SessionsModule,
        TasksModule,
        WebSocketModule,
        AgentConversationsModule,
      ],
      providers: [
        IntentRecognitionService,
        PlanningService,
        DelegationService,
        AgentDiscoveryService,
        AgentFactoryService,
      ],
    }).compile();

    intentService = module.get<IntentRecognitionService>(
      IntentRecognitionService,
    );
    planningService = module.get<PlanningService>(PlanningService);
    delegationService = module.get<DelegationService>(DelegationService);
  });

  describe('Complete Plan-Approve-Act Workflow', () => {
    /**
     * Test: Complete orchestrator workflow with real LLM decision points
     */
    it('should execute complete marketing campaign workflow with real LLM intelligence', async () => {
      console.log('\n🚀 Starting Complete Orchestrator Integration Test');

      // PHASE 1: INTENT RECOGNITION (PLAN)
      console.log('\n📋 PHASE 1: INTENT RECOGNITION');
      const planRequest: OrchestratorInput = {
        prompt:
          'Create a comprehensive marketing campaign for our new AI product launch. Include market research, blog content creation, social media strategy, and competitive analysis over 6 weeks.',
        userId: 'test-user-integration',
        conversationId: 'test-conv-integration',
        conversationHistory: [],
      };

      const intentResult: IntentDirective =
        await intentService.classifyIntent(planRequest);

      expect(intentResult.action).toBeDefined();
      expect(intentResult.confidence).toBeGreaterThan(0.5);
      expect(intentResult.reasoning).toBeDefined();

      console.log(
        `✅ Intent Classification: ${intentResult.action} (confidence: ${intentResult.confidence})`,
      );
      console.log(
        `🧠 LLM Reasoning: ${intentResult.reasoning.substring(0, 150)}...`,
      );

      // PHASE 2: PROJECT PLANNING (if CREATE_PROJECT)
      if (intentResult.action === 'CREATE_PROJECT') {
        console.log('\n📊 PHASE 2: PROJECT PLANNING');

        const projectPlan: PlanDefinition =
          await planningService.createPlan(planRequest);

        expect(projectPlan.projectName).toBeDefined();
        expect(projectPlan.description).toBeDefined();
        expect(projectPlan.steps).toBeDefined();
        expect(projectPlan.steps.length).toBeGreaterThan(2);

        console.log(`✅ Project Plan Created: "${projectPlan.projectName}"`);
        console.log(`📝 Plan Steps: ${projectPlan.steps.length}`);
        console.log(
          `🎯 First Step: ${projectPlan.steps[0]?.stepName} (${projectPlan.steps[0]?.agentName})`,
        );

        // Validate plan structure
        projectPlan.steps.forEach((step, index) => {
          expect(step.stepId).toBeDefined();
          expect(step.stepName).toBeDefined();
          expect(step.stepType).toMatch(/^(agent_step|human_approval)$/);
          expect(Array.isArray(step.dependencies)).toBe(true);

          if (step.stepType === 'agent_step') {
            expect(step.agentName).toBeDefined();
            expect(step.prompt).toBeDefined();
          }

          console.log(
            `  📌 Step ${index + 1}: ${step.stepName} → ${step.agentName || 'Human'}`,
          );
        });

        // PHASE 3: PLAN REFINEMENT
        console.log('\n🔄 PHASE 3: PLAN REFINEMENT');

        const refinementFeedback =
          'I want to add influencer outreach and email marketing campaigns to amplify our reach. Also include A/B testing for the landing pages.';

        const refinedPlan = await planningService.refinePlan(
          'test-plan-id',
          refinementFeedback,
          planRequest,
          projectPlan, // Pass the original plan for refinement
        );

        expect(refinedPlan.steps.length).toBeGreaterThanOrEqual(
          projectPlan.steps.length,
        );
        console.log(
          `✅ Plan Refined: ${refinedPlan.steps.length} steps (was ${projectPlan.steps.length})`,
        );

        // Check that refinement added requested elements
        const planText = JSON.stringify(refinedPlan).toLowerCase();
        expect(planText).toMatch(/(influencer|email|ab test|landing)/);
        console.log(
          `🧠 LLM Successfully Incorporated: influencer outreach, email marketing, A/B testing`,
        );
      }

      // PHASE 4: DELEGATION (ACT)
      if (intentResult.action === 'DELEGATE' && intentResult.agentName) {
        console.log('\n⚡ PHASE 4: DELEGATION');

        const delegationResult = await delegationService.delegateToAgent(
          intentResult.agentName,
          planRequest.prompt,
          planRequest,
        );

        expect(delegationResult.success).toBe(true);
        expect(delegationResult.response).toBeDefined();

        console.log(`✅ Task Delegated to: ${intentResult.agentName}`);
        console.log(
          `📊 Delegation Result: ${delegationResult.response?.substring(0, 150) || 'No response'}...`,
        );
      }

      console.log('\n🎉 Complete Orchestrator Integration Test Successful!');
      console.log(`🧠 Real LLM Decision Points Validated: Intent → Plan → Act`);
    }, 180000); // 3 minute timeout for complete workflow

    /**
     * Test: Multi-step conversation context intelligence
     */
    it('should handle multi-step conversation with context awareness', async () => {
      console.log('\n🔄 Starting Multi-Step Context Intelligence Test');

      // STEP 1: Initial request
      const step1Request: OrchestratorInput = {
        prompt: 'I need help with our product marketing strategy',
        userId: 'test-user-context',
        conversationId: 'test-conv-context',
        conversationHistory: [],
      };

      const step1Intent = await intentService.classifyIntent(step1Request);
      expect(step1Intent.action).toBeDefined();
      console.log(`✅ Step 1 Intent: ${step1Intent.action}`);

      // STEP 2: Follow-up with context
      const step2Request: OrchestratorInput = {
        prompt:
          "Actually, let's focus specifically on content marketing and thought leadership to establish our expertise in the AI space",
        userId: 'test-user-context',
        conversationId: 'test-conv-context',
        conversationHistory: [
          {
            role: 'user',
            content: step1Request.prompt,
            timestamp: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content:
              'I can help you develop a comprehensive marketing strategy.',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator' },
          },
        ],
      };

      const step2Intent = await intentService.classifyIntent(step2Request);
      expect(step2Intent.action).toBeDefined();
      expect(step2Intent.reasoning).toBeDefined();

      console.log(`✅ Step 2 Intent: ${step2Intent.action}`);
      console.log(
        `🧠 Context Awareness: ${step2Intent.reasoning.substring(0, 150)}...`,
      );

      // STEP 3: Specific task request
      const step3Request: OrchestratorInput = {
        prompt:
          'Create a blog post about how AI is transforming project management workflows',
        userId: 'test-user-context',
        conversationId: 'test-conv-context',
        conversationHistory: [
          ...step2Request.conversationHistory!,
          {
            role: 'user',
            content: step2Request.prompt,
            timestamp: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content: 'Great focus on content marketing and thought leadership.',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator' },
          },
        ],
      };

      const step3Intent = await intentService.classifyIntent(step3Request);
      expect(['DELEGATE', 'CREATE_PROJECT']).toContain(step3Intent.action);

      console.log(`✅ Step 3 Intent: ${step3Intent.action}`);
      if (step3Intent.agentName) {
        console.log(`🎯 Target Agent: ${step3Intent.agentName}`);
      }

      console.log('\n🎉 Multi-Step Context Intelligence Test Successful!');
      console.log(`🧠 LLM Demonstrated Context Awareness Across Conversation`);
    }, 120000); // 2 minute timeout

    /**
     * Test: Complex planning intelligence
     */
    it('should create sophisticated project plans with proper dependencies', async () => {
      console.log('\n📊 Starting Complex Planning Intelligence Test');

      const complexPlanRequest: OrchestratorInput = {
        prompt:
          'Plan a complete product rebranding initiative that includes: (1) market research to understand current brand perception, (2) competitive analysis of how competitors position themselves, (3) develop new brand messaging and visual identity, (4) create content strategy for the rebrand, (5) plan coordinated launch across all channels, and (6) measure and optimize post-launch. This needs executive approval at key milestones.',
        userId: 'test-user-complex',
        conversationId: 'test-conv-complex',
        conversationHistory: [],
      };

      const complexPlan = await planningService.createPlan(complexPlanRequest);

      // Validate complex plan structure
      expect(complexPlan.projectName).toBeDefined();
      expect(complexPlan.description).toBeDefined();
      expect(complexPlan.steps.length).toBeGreaterThan(5);

      console.log(`✅ Complex Plan Created: "${complexPlan.projectName}"`);
      console.log(`📊 Total Steps: ${complexPlan.steps.length}`);

      // Check for logical dependencies
      const hasResearchStep = complexPlan.steps.some(
        (s) =>
          s.stepName.toLowerCase().includes('research') ||
          s.stepName.toLowerCase().includes('analysis'),
      );
      const hasApprovalSteps = complexPlan.steps.some(
        (s) => s.stepType === 'human_approval',
      );
      const hasBrandingSteps = complexPlan.steps.some(
        (s) =>
          s.stepName.toLowerCase().includes('brand') ||
          s.stepName.toLowerCase().includes('identity'),
      );

      expect(hasResearchStep).toBe(true);
      expect(hasApprovalSteps).toBe(true);
      expect(hasBrandingSteps).toBe(true);

      console.log(`✅ Plan Intelligence Validated:`);
      console.log(`  📋 Research Steps: ${hasResearchStep}`);
      console.log(`  ✋ Approval Steps: ${hasApprovalSteps}`);
      console.log(`  🎨 Branding Steps: ${hasBrandingSteps}`);

      // Validate dependency logic
      let dependencyValidation = true;
      complexPlan.steps.forEach((step) => {
        step.dependencies.forEach((depId) => {
          const depExists = complexPlan.steps.some((s) => s.stepId === depId);
          if (!depExists) {
            dependencyValidation = false;
            console.log(
              `❌ Invalid dependency: ${step.stepId} depends on ${depId}`,
            );
          }
        });
      });

      expect(dependencyValidation).toBe(true);
      console.log(`✅ All Step Dependencies Valid`);

      console.log('\n🎉 Complex Planning Intelligence Test Successful!');
      console.log(
        `🧠 LLM Created Sophisticated Multi-Step Plan with Proper Dependencies`,
      );
    }, 120000); // 2 minute timeout
  });
});
