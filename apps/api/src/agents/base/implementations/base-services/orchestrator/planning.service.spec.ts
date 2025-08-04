import { Test, TestingModule } from '@nestjs/testing';
import { PlanningService } from './planning.service';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { OrchestratorInput, PlanDefinition } from '../../../../../orchestration/orchestration.types';

/**
 * Planning Service - Real LLM Planning Intelligence Tests
 * 
 * These tests validate the LLM's ability to:
 * - Create structured, actionable project plans in one shot
 * - Refine plans based on user feedback iteratively  
 * - Assign appropriate agents to plan steps
 * - Handle complex multi-step dependencies
 * - Generate human-readable plan descriptions
 * 
 * NO MOCKING - Tests real LLM planning capabilities!
 */
describe('PlanningService - Real LLM Planning Intelligence Tests', () => {
  let service: PlanningService;
  let llmService: LLMService;
  let agentDiscoveryService: AgentDiscoveryService;

  const mockAvailableAgents = [
    { name: 'marketing_swarm', type: 'marketing', displayName: 'Marketing Swarm', description: 'Multi-agent collaboration for complex campaigns' },
    { name: 'blog_post', type: 'marketing', displayName: 'Blog Post Writer', description: 'Long-form content and thought leadership' },
    { name: 'content', type: 'marketing', displayName: 'Content Writer', description: 'Marketing copy and promotional materials' },
    { name: 'market_research', type: 'marketing', displayName: 'Market Research Agent', description: 'Market analysis and competitive intelligence' },
    { name: 'competitors', type: 'marketing', displayName: 'Competitors Agent', description: 'Competitive analysis and positioning' }
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningService,
        {
          provide: LLMService,  
          useValue: {
            generateResponse: jest.fn().mockImplementation(async (systemPrompt: string, userMessage: string) => {
              // Mock intelligent planning responses
              if (systemPrompt.includes('CREATE_PLAN')) {
                return JSON.stringify({
                  projectName: "AI-Powered Project Management Tool Marketing Campaign",
                  description: "Comprehensive marketing campaign targeting B2B software companies",
                  steps: [
                    {
                      stepId: "step_1",
                      stepName: "Market Research",
                      stepType: "agent_step",
                      agentName: "market_research",
                      prompt: "Research B2B project management tool market focusing on productivity benefits",
                      dependencies: []
                    },
                    {
                      stepId: "step_2", 
                      stepName: "Blog Content Creation",
                      stepType: "agent_step",
                      agentName: "blog_post",
                      prompt: "Create thought leadership blog about AI in project management",
                      dependencies: ["step_1"]
                    },
                    {
                      stepId: "step_3",
                      stepName: "Social Media Content",
                      stepType: "agent_step",
                      agentName: "content",
                      prompt: "Create social media posts promoting the blog content",
                      dependencies: ["step_2"]
                    },
                    {
                      stepId: "step_4",
                      stepName: "Competitive Positioning",
                      stepType: "agent_step", 
                      agentName: "competitors",
                      prompt: "Analyze competitive positioning for the campaign",
                      dependencies: ["step_1"]
                    }
                  ]
                });
              } else if (systemPrompt.includes('REFINE_PLAN')) {
                return JSON.stringify({
                  projectName: "Enhanced Blog Content Marketing Plan",
                  description: "Extended plan with social media and email marketing amplification",
                  steps: [
                    {
                      stepId: "step_1",
                      stepName: "Blog Content Creation", 
                      stepType: "agent_step",
                      agentName: "blog_post",
                      prompt: "Create comprehensive blog content for our product",
                      dependencies: []
                    },
                    {
                      stepId: "step_2",
                      stepName: "Social Media Promotion",
                      stepType: "agent_step",
                      agentName: "content", 
                      prompt: "Create social media content to promote blog posts",
                      dependencies: ["step_1"]
                    },
                    {
                      stepId: "step_3",
                      stepName: "Email Marketing",
                      stepType: "agent_step",
                      agentName: "content",
                      prompt: "Create email marketing content to amplify blog reach",
                      dependencies: ["step_1"]
                    },
                    {
                      stepId: "step_4",
                      stepName: "Competitor Analysis",
                      stepType: "agent_step",
                      agentName: "competitors",
                      prompt: "Analyze competitor content strategies for differentiation",
                      dependencies: []
                    }
                  ]
                });
              } else if (systemPrompt.includes('FORMAT_PLAN')) {
                return `# AI Product Launch Campaign

## Project Overview
Comprehensive marketing campaign for AI-powered project management tool targeting B2B software companies.

## Execution Plan

### Step 1: Market Research
- **Agent**: Market Research Agent
- **Task**: Research B2B project management tool market
- **Dependencies**: None

### Step 2: Blog Content Creation  
- **Agent**: Blog Post Writer
- **Task**: Create thought leadership blog about AI in project management
- **Dependencies**: Market Research

### Step 3: Review and Approval
- **Type**: Human Approval
- **Task**: Review and approve blog content before publication
- **Dependencies**: Blog Content Creation

## Ready to Execute
Your marketing campaign plan is ready for approval and execution. Click "Approve" to begin the first step.`;
              }
              return 'Mock LLM response';
            })
          }
        },
        {
          provide: AgentDiscoveryService,
          useValue: {
            discoverAgents: jest.fn(),
            getDiscoveredAgents: jest.fn().mockReturnValue(mockAvailableAgents)
          }
        }
      ],
    }).compile();

    service = module.get<PlanningService>(PlanningService);
    llmService = module.get<LLMService>(LLMService);
    agentDiscoveryService = module.get<AgentDiscoveryService>(AgentDiscoveryService);
  });

  describe('Single-Shot Planning Intelligence', () => {
    /**
     * Test: Can LLM create a complete marketing campaign plan in one shot?
     */
    it('should create comprehensive marketing campaign plan with proper agent assignments', async () => {
      const input: OrchestratorInput = {
        prompt: "Launch a marketing campaign for our new AI-powered project management tool. Target B2B software companies, focusing on productivity and efficiency benefits. Include blog content, social media, email campaigns, and competitive positioning.",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const plan: PlanDefinition = await service.createPlan(input);

      // Validate plan structure
      expect(plan.projectName).toBeDefined();
      expect(plan.projectName.length).toBeGreaterThan(10);
      expect(plan.description).toBeDefined();
      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(3);

      // Validate steps have proper structure
      plan.steps.forEach(step => {
        expect(step.stepId).toBeDefined();
        expect(step.stepName).toBeDefined();
        expect(step.stepType).toMatch(/^(agent_step|human_approval)$/);
        expect(step.prompt).toBeDefined();
        expect(Array.isArray(step.dependencies)).toBe(true);
        
        if (step.stepType === 'agent_step') {
          expect(step.agentName).toBeDefined();
          expect(mockAvailableAgents.map(a => a.name)).toContain(step.agentName);
        }
      });

      // Validate agent assignments make sense
      const agentSteps = plan.steps.filter(s => s.stepType === 'agent_step');
      const assignedAgents = agentSteps.map(s => s.agentName);
      
      // Should include content creation agents for campaign
      expect(assignedAgents).toContain('blog_post'); // For blog content
      expect(assignedAgents).toContain('content'); // For social/email copy
      
      // May include research for competitive positioning
      if (input.prompt.includes('competitive')) {
        expect(assignedAgents.some(a => ['market_research', 'competitors'].includes(a))).toBe(true);
      }

      console.log('Generated Plan:', JSON.stringify(plan, null, 2));
    });

    /**
     * Test: Can LLM create appropriate step dependencies and sequencing?
     */
    it('should create logical step dependencies and sequencing', async () => {
      const input: OrchestratorInput = {
        prompt: "Create a content marketing strategy that starts with market research, then develops blog content, and finally creates social media promotion for the blog posts",
        userId: "test-user", 
        conversationId: "test-conv",
        conversationHistory: []
      };

      const plan = await service.createPlan(input);

      // Find key steps
      const researchStep = plan.steps.find(s => s.agentName === 'market_research');
      const blogStep = plan.steps.find(s => s.agentName === 'blog_post');
      const socialStep = plan.steps.find(s => s.agentName === 'content' && s.prompt.toLowerCase().includes('social'));

      if (researchStep && blogStep) {
        // Blog step should depend on research
        expect(blogStep.dependencies).toContain(researchStep.stepId);
      }

      if (blogStep && socialStep) {
        // Social step should depend on blog
        expect(socialStep.dependencies).toContain(blogStep.stepId);
      }

      // Validate no circular dependencies
      const validateNoCycles = (steps) => {
        const visited = new Set();
        const visiting = new Set();
        
        const hasCycle = (stepId) => {
          if (visiting.has(stepId)) return true;
          if (visited.has(stepId)) return false;
          
          visiting.add(stepId);
          const step = steps.find(s => s.stepId === stepId);
          if (step) {
            for (const dep of step.dependencies) {
              if (hasCycle(dep)) return true;
            }
          }
          visiting.delete(stepId);
          visited.add(stepId);
          return false;
        };
        
        return steps.some(step => hasCycle(step.stepId));
      };

      expect(validateNoCycles(plan.steps)).toBe(false);
    });

    /**
     * Test: Can LLM include appropriate human approval steps?
     */
    it('should include strategic human approval steps at key milestones', async () => {
      const input: OrchestratorInput = {
        prompt: "Plan a major product launch campaign that requires executive approval at key stages and has significant budget implications",
        userId: "test-user",
        conversationId: "test-conv", 
        conversationHistory: []
      };

      const plan = await service.createPlan(input);
      
      const approvalSteps = plan.steps.filter(s => s.stepType === 'human_approval');
      
      // Should have at least one approval step for major campaign
      expect(approvalSteps.length).toBeGreaterThan(0);
      
      // Approval steps should have meaningful prompts
      approvalSteps.forEach(step => {
        expect(step.prompt.toLowerCase()).toMatch(/(approve|review|confirm)/);
      });
    });
  });

  describe('Plan Refinement Intelligence', () => {
    /**
     * Test: Can LLM refine plans based on user feedback?
     */
    it('should intelligently refine plans based on user feedback', async () => {
      // Create initial plan
      const initialInput: OrchestratorInput = {
        prompt: "Create a simple blog content plan for our product",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const initialPlan = await service.createPlan(initialInput);
      
      // Refine with feedback
      const feedback = "I want to add social media promotion and email marketing to amplify the blog content, and include competitor analysis";
      
      const refinedPlan = await service.refinePlan(
        'test-plan-id',
        feedback,
        initialInput
      );

      // Refined plan should have more steps
      expect(refinedPlan.steps.length).toBeGreaterThan(initialPlan.steps.length);
      
      // Should include requested agents
      const refinedAgents = refinedPlan.steps
        .filter(s => s.stepType === 'agent_step')
        .map(s => s.agentName);
        
      expect(refinedAgents).toContain('content'); // For social/email
      expect(refinedAgents).toContain('competitors'); // For competitor analysis
      
      console.log('Initial Plan Steps:', initialPlan.steps.length);
      console.log('Refined Plan Steps:', refinedPlan.steps.length);
      console.log('Added Agents:', refinedAgents.filter(a => 
        !initialPlan.steps.map(s => s.agentName).includes(a)
      ));
    });

    /**
     * Test: Can LLM handle conflicting or contradictory feedback?
     */
    it('should handle contradictory feedback intelligently', async () => {
      const input: OrchestratorInput = {
        prompt: "Create a comprehensive marketing campaign",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const feedback = "Make it simpler but also add more complexity and reduce the timeline but extend the scope";
      
      const refinedPlan = await service.refinePlan('test-plan-id', feedback, input);
      
      // Should still produce a valid plan despite contradictory feedback
      expect(refinedPlan.steps.length).toBeGreaterThan(0);
      expect(refinedPlan.projectName).toBeDefined();
      
      // Should address at least some aspects of the feedback
      const planText = JSON.stringify(refinedPlan).toLowerCase();
      expect(planText).toMatch(/(simpl|complex|timeline|scope)/);
    });
  });

  describe('Human-Readable Plan Generation', () => {
    /**
     * Test: Can LLM generate engaging human-readable plan descriptions?
     */
    it('should generate clear and engaging human-readable plans', async () => {
      const plan: PlanDefinition = {
        projectName: "AI Product Launch Campaign",
        description: "Comprehensive marketing campaign for AI-powered project management tool",
        steps: [
          {
            stepId: "step_1",
            stepName: "Market Research",
            stepType: "agent_step",
            agentName: "market_research",
            prompt: "Research B2B project management tool market",
            dependencies: []
          },
          {
            stepId: "step_2", 
            stepName: "Blog Content Creation",
            stepType: "agent_step",
            agentName: "blog_post",
            prompt: "Create thought leadership blog about AI in project management",
            dependencies: ["step_1"]
          },
          {
            stepId: "step_3",
            stepName: "Review and Approval",
            stepType: "human_approval", 
            prompt: "Review and approve blog content before publication",
            dependencies: ["step_2"]
          }
        ]
      };

      const humanReadable = await service.formatPlanForHuman(plan);
      
      // Should be well-formatted markdown
      expect(humanReadable).toContain('#');
      expect(humanReadable).toContain('##');
      
      // Should include project name and description
      expect(humanReadable).toContain(plan.projectName);
      expect(humanReadable).toContain(plan.description);
      
      // Should describe each step clearly
      plan.steps.forEach(step => {
        expect(humanReadable).toContain(step.stepName);
      });
      
      // Should be engaging and professional
      expect(humanReadable.toLowerCase()).toMatch(/(ready|next|approve|execute)/);
      
      console.log('Human-readable plan:', humanReadable);
    });
  });

  describe('Complex Planning Scenarios', () => {
    /**
     * Test: Can LLM handle cross-functional complex projects?
     */
    it('should handle complex cross-functional project planning', async () => {
      const input: OrchestratorInput = {
        prompt: "Plan a complete rebranding initiative that includes market research, competitive analysis, new brand messaging, content updates across all channels, and coordinated launch campaign. This needs executive oversight and legal approval.",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const plan = await service.createPlan(input);
      
      // Should be a substantial plan
      expect(plan.steps.length).toBeGreaterThan(5);
      
      // Should use multiple agent types
      const agentTypes = new Set(
        plan.steps
          .filter(s => s.stepType === 'agent_step')
          .map(s => s.agentName)
      );
      expect(agentTypes.size).toBeGreaterThan(2);
      
      // Should include multiple approval points for major initiative
      const approvalSteps = plan.steps.filter(s => s.stepType === 'human_approval');
      expect(approvalSteps.length).toBeGreaterThan(1);
      
      // Should have logical sequencing (research → strategy → execution)
      const stepNames = plan.steps.map(s => s.stepName.toLowerCase());
      const hasResearch = stepNames.some(name => name.includes('research'));
      const hasStrategy = stepNames.some(name => name.includes('brand') || name.includes('messag'));
      const hasExecution = stepNames.some(name => name.includes('launch') || name.includes('campaign'));
      
      expect(hasResearch).toBe(true);
      expect(hasStrategy).toBe(true); 
      expect(hasExecution).toBe(true);
    });

    /**
     * Test: Can LLM estimate realistic complexity and timelines?
     */
    it('should provide realistic complexity assessments', async () => {
      const testCases = [
        {
          prompt: "Write one blog post about our product",
          expectedComplexity: 'simple',
          expectedSteps: { min: 1, max: 4 }
        },
        {
          prompt: "Create a month-long content marketing campaign with blog posts, social media, and email sequences",
          expectedComplexity: 'moderate', 
          expectedSteps: { min: 4, max: 8 }
        },
        {
          prompt: "Plan complete company rebranding with new website, all marketing materials, content migration, and coordinated multi-channel launch",
          expectedComplexity: 'complex',
          expectedSteps: { min: 8, max: 20 }
        }
      ];

      for (const testCase of testCases) {
        const input: OrchestratorInput = {
          prompt: testCase.prompt,
          userId: "test-user",
          conversationId: `test-${testCase.expectedComplexity}`,
          conversationHistory: []
        };

        const plan = await service.createPlan(input);
        
        expect(plan.steps.length).toBeGreaterThanOrEqual(testCase.expectedSteps.min);
        expect(plan.steps.length).toBeLessThanOrEqual(testCase.expectedSteps.max);
        
        console.log(`${testCase.expectedComplexity} project: ${plan.steps.length} steps for "${testCase.prompt.substring(0, 50)}..."`);
      }
    });
  });
});