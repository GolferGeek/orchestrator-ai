import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MarketingManagerOrchestratorService } from '../../../../actual/orchestrator/marketing_manager_orchestrator/agent-service';
import { SupabaseModule } from '../../../../../supabase/supabase.module';
import { LLMModule } from '../../../../../llms/llm.module';
import { CIDAFMModule } from '../../../../../cidafm/cidafm.module';
import { BaseSubServicesModule } from '../../../sub-services/base-sub-services.module';
import { OrchestratorModule } from './orchestrator.module';
import { HttpModule } from '@nestjs/axios';
import { 
  OrchestratorInput, 
  OrchestratorResponse,
  PlanDefinition,
  ProjectStatus 
} from '../../../../../orchestration/orchestration.types';

/**
 * Plan-Approve-Act Lifecycle Tests - Real LLM Intelligence Validation
 * 
 * These tests validate the complete orchestrator workflow:
 * 1. PLAN: LLM creates comprehensive project plans
 * 2. APPROVE: Validation and approval process  
 * 3. ACT: Execute plan steps with real agent delegation
 * 
 * This is the ultimate test of orchestrator intelligence - can it:
 * - Create realistic, actionable plans?
 * - Handle approval workflows intelligently?
 * - Execute complex multi-step projects?
 * - Recover from failures gracefully?
 * 
 * NO MOCKING - Tests complete real LLM orchestration workflow!
 */
describe('Plan-Approve-Act Lifecycle - Real LLM Tests', () => {
  let marketingManager: MarketingManagerOrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            '/Users/golfergeek/projects/golfergeek/orchestrator-ai/.env',
            '../../.env',
            '.env'
          ],
        }),
        HttpModule,
        SupabaseModule,
        LLMModule,
        CIDAFMModule,
        BaseSubServicesModule
      ],
      providers: [
        MarketingManagerOrchestratorService
      ],
    }).compile();

    marketingManager = module.get<MarketingManagerOrchestratorService>(MarketingManagerOrchestratorService);
  });

  describe('Complete Project Lifecycle', () => {
    /**
     * Test: Can orchestrator handle complete marketing project lifecycle?
     */
    it('should execute complete marketing campaign project lifecycle', async () => {
      console.log('\n🚀 Starting Complete Project Lifecycle Test');
      
      // PHASE 1: PLAN - Create marketing campaign project
      console.log('\n📋 PHASE 1: PLANNING');
      const planRequest: OrchestratorInput = {
        prompt: "Create a comprehensive marketing campaign for launching our new AI-powered project management tool. Target B2B software companies, include market research, content creation, competitive analysis, and coordinated launch activities over 4 weeks.",
        userId: "test-user-lifecycle",
        conversationId: "test-conv-lifecycle",
        conversationHistory: []
      };

      const planResponse = await marketingManager.executeTask('executeTask', planRequest);
      
      expect(planResponse.success).toBe(true);
      expect(planResponse.projectId).toBeDefined();
      expect(planResponse.message || planResponse.response).toBeDefined();
      
      console.log(`✅ Plan Created: Project ID ${planResponse.projectId}`);
      console.log(`📊 Plan Response: ${(planResponse.message || planResponse.response)?.substring(0, 200)}...`);

      // PHASE 2: APPROVE - Handle plan approval  
      console.log('\n✅ PHASE 2: APPROVAL');
      const approvalRequest: OrchestratorInput = {
        prompt: "I approve the marketing campaign plan. Please proceed with execution starting with the first step.",
        userId: "test-user-lifecycle",
        conversationId: "test-conv-lifecycle", 
        projectId: planResponse.projectId,
        conversationHistory: [
          {
            role: 'user',
            content: planRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: planResponse.message || planResponse.response || 'Plan created',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator', projectId: planResponse.projectId }
          }
        ]
      };

      const approvalResponse = await marketingManager.executeTask('executeTask', approvalRequest);
      
      expect(approvalResponse.success).toBe(true);
      expect(approvalResponse.projectId).toBe(planResponse.projectId);
      
      console.log(`✅ Approval Processed: ${approvalResponse.action}`);
      console.log(`📊 Next Action: ${(approvalResponse.message || approvalResponse.response)?.substring(0, 200)}...`);

      // PHASE 3: ACT - Execute first step of the plan
      console.log('\n⚡ PHASE 3: EXECUTION');
      const executionRequest: OrchestratorInput = {
        prompt: "Execute the first step of the approved marketing campaign plan. Begin with market research.",
        userId: "test-user-lifecycle",
        conversationId: "test-conv-lifecycle",
        projectId: planResponse.projectId,
        conversationHistory: [
          ...approvalRequest.conversationHistory!,
          {
            role: 'user', 
            content: approvalRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: approvalResponse.message || approvalResponse.response || 'Plan approved',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator', projectId: planResponse.projectId }
          }
        ]
      };

      const executionResponse = await marketingManager.executeTask('executeTask', executionRequest);
      
      expect(executionResponse.success).toBe(true);
      expect(executionResponse.projectId).toBe(planResponse.projectId);
      
      console.log(`✅ Execution Started: ${executionResponse.action}`);
      if (executionResponse.metadata?.delegatedAgent) {
        console.log(`🎯 Delegated to: ${executionResponse.metadata.delegatedAgent}`);
      }
      console.log(`📊 Execution Result: ${(executionResponse.message || executionResponse.response)?.substring(0, 200)}...`);

      // VALIDATION: Check that we have a complete project workflow
      expect([planResponse.projectId, approvalResponse.projectId, executionResponse.projectId])
        .toEqual([planResponse.projectId, planResponse.projectId, planResponse.projectId]);
      
      console.log('\n🎉 Complete Project Lifecycle Test Successful!');
      console.log(`📋 Project ID: ${planResponse.projectId}`);
      console.log(`📊 Phases Completed: PLAN → APPROVE → ACT`);
      console.log(`🤖 Real LLM Decision Points: 3`);
      
    }, 180000); // 3 minute timeout for complete workflow

    /**
     * Test: Can orchestrator handle iterative plan refinement?
     */
    it('should handle iterative plan refinement with real LLM feedback', async () => {
      console.log('\n🔄 Starting Iterative Plan Refinement Test');
      
      // STEP 1: Create initial plan
      const initialPlanRequest: OrchestratorInput = {
        prompt: "Create a simple blog content plan for our product launch",
        userId: "test-user-iterative",
        conversationId: "test-conv-iterative",
        conversationHistory: []
      };

      const initialPlanResponse = await marketingManager.executeTask('executeTask', initialPlanRequest);
      
      expect(initialPlanResponse.success).toBe(true);
      expect(initialPlanResponse.projectId).toBeDefined();
      
      console.log(`✅ Initial Plan: ${initialPlanResponse.projectId}`);

      // STEP 2: Request plan refinement
      const refinementRequest: OrchestratorInput = {
        prompt: "Actually, let's expand this plan to include social media promotion, email marketing campaigns, and influencer outreach to amplify the blog content. Also add competitive analysis to ensure our messaging differentiates from competitors.",
        userId: "test-user-iterative",
        conversationId: "test-conv-iterative",
        projectId: initialPlanResponse.projectId,
        conversationHistory: [
          {
            role: 'user',
            content: initialPlanRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: initialPlanResponse.message || 'Initial plan created',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator', projectId: initialPlanResponse.projectId }
          }
        ]
      };

      const refinementResponse = await marketingManager.executeTask('executeTask', refinementRequest);
      
      expect(refinementResponse.success).toBe(true);
      expect(refinementResponse.projectId).toBe(initialPlanResponse.projectId);
      
      console.log(`✅ Plan Refined Successfully`);
      console.log(`📊 Refinement includes: ${(refinementResponse.message || refinementResponse.response)?.substring(0, 300)}...`);

      // STEP 3: Validate refinement intelligence
      const responseText = (refinementResponse.message || refinementResponse.response || '').toLowerCase();
      
      // Check that LLM incorporated the requested elements
      expect(responseText).toMatch(/(social|media|email|influencer|competitive|analysis)/);
      
      console.log('\n🎉 Iterative Plan Refinement Test Successful!');
      console.log(`🧠 LLM successfully expanded plan with requested elements`);
      
    }, 120000); // 2 minute timeout

    /**
     * Test: Can orchestrator handle approval workflows with conditions?
     */
    it('should handle conditional approval workflows with LLM intelligence', async () => {
      console.log('\n🔍 Starting Conditional Approval Workflow Test');
      
      // STEP 1: Create a plan that requires approval
      const planRequest: OrchestratorInput = {
        prompt: "Plan a major product rebranding campaign that will require significant budget, multiple departments, and executive oversight. This is a high-stakes initiative.",
        userId: "test-user-approval",
        conversationId: "test-conv-approval", 
        conversationHistory: []
      };

      const planResponse = await marketingManager.executeTask('executeTask', planRequest);
      
      expect(planResponse.success).toBe(true);
      expect(planResponse.projectId).toBeDefined();
      
      console.log(`✅ High-Stakes Plan Created: ${planResponse.projectId}`);

      // STEP 2: Request modifications before approval
      const modificationRequest: OrchestratorInput = {
        prompt: "Before I approve this plan, I need to reduce the budget and timeline. Can you modify the plan to be more conservative while still achieving the core rebranding objectives?",
        userId: "test-user-approval",
        conversationId: "test-conv-approval",
        projectId: planResponse.projectId,
        conversationHistory: [
          {
            role: 'user',
            content: planRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: planResponse.message || 'Rebranding plan created',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator', projectId: planResponse.projectId }
          }
        ]
      };

      const modificationResponse = await marketingManager.executeTask('executeTask', modificationRequest);
      
      expect(modificationResponse.success).toBe(true);
      expect(modificationResponse.projectId).toBe(planResponse.projectId);
      
      console.log(`✅ Plan Modified for Approval`);
      
      // STEP 3: Final approval
      const finalApprovalRequest: OrchestratorInput = {
        prompt: "Perfect! This revised plan looks much more manageable. I approve this modified rebranding plan. Please proceed with the first phase.",
        userId: "test-user-approval",
        conversationId: "test-conv-approval",
        projectId: planResponse.projectId,
        conversationHistory: [
          ...modificationRequest.conversationHistory!,
          {
            role: 'user',
            content: modificationRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: modificationResponse.message || 'Plan modified',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator', projectId: planResponse.projectId }
          }
        ]
      };

      const finalApprovalResponse = await marketingManager.executeTask('executeTask', finalApprovalRequest);
      
      expect(finalApprovalResponse.success).toBe(true);
      expect(finalApprovalResponse.projectId).toBe(planResponse.projectId);
      
      console.log(`✅ Final Approval and Execution Started`);
      console.log(`📊 Action: ${finalApprovalResponse.action}`);

      // Validation: Check intelligent workflow handling
      const responseText = (finalApprovalResponse.message || finalApprovalResponse.response || '').toLowerCase();
      expect(responseText.length).toBeGreaterThan(50); // Should provide substantial response
      
      console.log('\n🎉 Conditional Approval Workflow Test Successful!');
      console.log(`🧠 LLM handled: Plan → Modification Request → Revised Plan → Approval → Execution`);
      
    }, 150000); // 2.5 minute timeout

    /**
     * Test: Can orchestrator execute multi-step projects with real agent delegation?
     */
    it('should execute multi-step marketing project with real agent delegation', async () => {
      console.log('\n🚀 Starting Multi-Step Execution Test');
      
      // STEP 1: Create comprehensive multi-step plan
      const projectRequest: OrchestratorInput = {
        prompt: "Create and execute a content marketing project: (1) research competitor content strategies, (2) create three blog posts based on the research, (3) develop social media promotion for the blog posts. I want to see this executed step by step.",
        userId: "test-user-multistep",
        conversationId: "test-conv-multistep",
        conversationHistory: []
      };

      const projectResponse = await marketingManager.executeTask('executeTask', projectRequest);
      
      expect(projectResponse.success).toBe(true);
      console.log(`✅ Multi-Step Project Initiated: ${projectResponse.action}`);
      console.log(`📋 Project ID: ${projectResponse.projectId || 'N/A'}`);

      // STEP 2: Check if first step was delegated
      if (projectResponse.action === 'DELEGATE' && projectResponse.metadata?.delegatedAgent) {
        console.log(`🎯 First Step Delegated to: ${projectResponse.metadata.delegatedAgent}`);
        
        // Validate that it chose appropriate agent for competitor research
        expect(['competitors', 'market_research'].some(agent => 
          projectResponse.metadata?.delegatedAgent?.toLowerCase().includes(agent)
        )).toBe(true);
        
        console.log(`✅ Intelligent Agent Selection for Research Phase`);
      }

      // STEP 3: Simulate completion of first step and request next step
      const nextStepRequest: OrchestratorInput = {
        prompt: "Great! The competitor research is complete. Now please proceed with step 2: creating the three blog posts based on the research findings.",
        userId: "test-user-multistep",
        conversationId: "test-conv-multistep",
        projectId: projectResponse.projectId,
        conversationHistory: [
          {
            role: 'user',
            content: projectRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: projectResponse.message || 'Multi-step project started',
            timestamp: new Date().toISOString(),
            metadata: { 
              agentName: projectResponse.metadata?.delegatedAgent || 'orchestrator',
              projectId: projectResponse.projectId 
            }
          }
        ]
      };

      const nextStepResponse = await marketingManager.executeTask('executeTask', nextStepRequest);
      
      expect(nextStepResponse.success).toBe(true);
      console.log(`✅ Next Step Executed: ${nextStepResponse.action}`);
      
      if (nextStepResponse.metadata?.delegatedAgent) {
        console.log(`🎯 Step 2 Delegated to: ${nextStepResponse.metadata.delegatedAgent}`);
        
        // Should delegate blog creation to blog-focused agent
        expect(['blog_post', 'content'].some(agent => 
          nextStepResponse.metadata?.delegatedAgent?.toLowerCase().includes(agent)
        )).toBe(true);
        
        console.log(`✅ Intelligent Agent Selection for Content Creation Phase`);
      }

      console.log('\n🎉 Multi-Step Execution Test Successful!');
      console.log(`🧠 LLM demonstrated intelligent multi-step project management`);
      console.log(`🎯 Appropriate agent delegation for different task types`);
      
    }, 150000); // 2.5 minute timeout
  });

  describe('Error Recovery and Resilience', () => {
    /**
     * Test: Can orchestrator recover from step failures intelligently?
     */
    it('should handle step failures with intelligent recovery', async () => {
      console.log('\n🔄 Starting Error Recovery Test');
      
      // Create a project request
      const projectRequest: OrchestratorInput = {
        prompt: "Create a marketing campaign, but I want to see how you handle if something goes wrong during execution.",
        userId: "test-user-recovery",
        conversationId: "test-conv-recovery",
        conversationHistory: []
      };

      const projectResponse = await marketingManager.executeTask('executeTask', projectRequest);
      
      expect(projectResponse.success).toBe(true);
      console.log(`✅ Project Created for Recovery Test`);

      // Simulate an error scenario
      const errorScenarioRequest: OrchestratorInput = {
        prompt: "There was an error with the previous step - the marketing research agent is unavailable. How should we proceed with the campaign?",
        userId: "test-user-recovery",
        conversationId: "test-conv-recovery",
        projectId: projectResponse.projectId,
        conversationHistory: [
          {
            role: 'user',
            content: projectRequest.prompt,
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: projectResponse.message || 'Project started',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'orchestrator', projectId: projectResponse.projectId }
          }
        ]
      };

      const recoveryResponse = await marketingManager.executeTask('executeTask', errorScenarioRequest);
      
      expect(recoveryResponse.success).toBe(true);
      console.log(`✅ Error Recovery Response Generated`);
      console.log(`🔄 Recovery Strategy: ${(recoveryResponse.message || recoveryResponse.response)?.substring(0, 200)}...`);

      // Should provide intelligent error handling
      const responseText = (recoveryResponse.message || recoveryResponse.response || '').toLowerCase();
      expect(responseText.length).toBeGreaterThan(50);
      
      // Should mention alternatives or next steps
      expect(responseText).toMatch(/(alternative|instead|other|skip|continue|next)/);
      
      console.log('\n🎉 Error Recovery Test Successful!');
      console.log(`🧠 LLM provided intelligent error recovery strategy`);
      
    }, 90000); // 1.5 minute timeout
  });
});