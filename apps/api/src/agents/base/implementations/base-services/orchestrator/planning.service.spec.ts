import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlanningService } from './planning.service';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import { CIDAFMService } from '../../../../../cidafm/cidafm.service';
import { OrchestratorInput, PlanDefinition } from '../../../../../orchestration/orchestration.types';

/**
 * Planning Service - Real LLM Planning Intelligence Tests
 * 
 * These tests validate the REAL LLM's ability to:
 * - Create structured, actionable project plans
 * - Handle real agent discovery
 * - Generate valid JSON responses
 * - Properly error when things fail
 * 
 * NO MOCKS - Tests actual LLM planning capabilities!
 * But we provide minimal service implementations to avoid deep dependency trees.
 */
describe('PlanningService - Real LLM Planning Intelligence Tests', () => {
  let service: PlanningService;
  let realLLMService: LLMService;
  let realAgentDiscoveryService: AgentDiscoveryService;

  beforeEach(async () => {
    // Set up environment variables for the services
    process.env.SUPABASE_URL = 'https://jcmkjecmdugfzvdijodg.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWtqZWNtZHVnZnp2ZGlqb2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1ODg4ODQsImV4cCI6MjA2MzE2NDg4NH0.9KqoILWR-8PIMIQ7p0tCPyFEW5XAwz2OHXtachOqsc4';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbWtqZWNtZHVnZnp2ZGlqb2RnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzU4ODg4NCwiZXhwIjoyMDYzMTY0ODg0fQ.zl1cSBPRJqbYsCh4LvuztpvxIhgrJv06Gutfdr_u1YY';
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningService,
        LLMService,
        AgentDiscoveryService,
        SupabaseService,
        CIDAFMService,
        ConfigService
      ],
    }).compile();

    service = module.get<PlanningService>(PlanningService);
    realLLMService = module.get<LLMService>(LLMService);
    realAgentDiscoveryService = module.get<AgentDiscoveryService>(AgentDiscoveryService);
  });

  describe('Real LLM Planning Intelligence', () => {
    /**
     * Test: Can the actual LLM create a complete marketing campaign plan?
     */
    it('should create comprehensive marketing campaign plan with real LLM intelligence', async () => {
      const input: OrchestratorInput = {
        prompt: "Create a marketing campaign for our new AI-powered project management tool",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const plan: PlanDefinition = await service.createPlan(input);

      // Validate plan structure from real LLM
      expect(plan.projectName).toBeDefined();
      expect(plan.projectName.length).toBeGreaterThan(5);
      expect(plan.description).toBeDefined();
      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);

      // Validate steps have proper structure
      plan.steps.forEach(step => {
        expect(step.stepId).toBeDefined();
        expect(step.stepName).toBeDefined();
        expect(step.stepType).toBeDefined();
        expect(step.prompt).toBeDefined();
        expect(Array.isArray(step.dependencies)).toBe(true);
      });

      console.log('Real LLM Generated Plan:', JSON.stringify(plan, null, 2));
    }, 60000);

    /**
     * Test: Does agent discovery work properly without mocks?
     */
    it('should discover real agents for planning', async () => {
      // This should work with the real agent discovery service
      await realAgentDiscoveryService.discoverAgents();
      const agents = realAgentDiscoveryService.getDiscoveredAgents();
      
      expect(agents).toBeDefined();
      expect(Array.isArray(agents)).toBe(true);
      
      console.log('Discovered Agents:', agents.map(a => ({ name: a.name, type: a.type })));
    });

    /**
     * Test: Can the real LLM refine plans based on feedback?
     */
    it('should refine plans with real LLM intelligence', async () => {
      const initialInput: OrchestratorInput = {
        prompt: "Create a simple blog content plan",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const initialPlan = await service.createPlan(initialInput);
      
      const feedback = "Add social media promotion and email marketing";
      
      const refinedPlan = await service.refinePlan(
        'test-plan-id',
        feedback,
        initialInput,
        initialPlan
      );

      expect(refinedPlan.steps.length).toBeGreaterThanOrEqual(initialPlan.steps.length);
      expect(refinedPlan.projectName).toBeDefined();
      
      console.log('Initial Plan Steps:', initialPlan.steps.length);
      console.log('Refined Plan Steps:', refinedPlan.steps.length);
    }, 60000);

    /**
     * Test: Can the real LLM format plans for humans?
     */
    it('should format plans for humans with real LLM', async () => {
      const plan: PlanDefinition = {
        projectName: "Test Marketing Campaign",
        description: "A test campaign for validation",
        steps: [
          {
            stepId: "step_1",
            stepName: "Market Research",
            stepType: "agent_step",
            agentName: "market_research",
            prompt: "Research the market",
            dependencies: []
          }
        ],
        metadata: {}
      };

      const humanReadable = await service.formatPlanForHuman(plan);
      
      expect(humanReadable).toBeDefined();
      expect(humanReadable.length).toBeGreaterThan(50);
      expect(humanReadable).toContain(plan.projectName);
      
      console.log('Human-readable plan:', humanReadable);
    }, 30000);
  });

  describe('Error Handling - No Fallbacks', () => {
    /**
     * Test: Does it properly error when LLM fails instead of using fallbacks?
     */
    it('should throw errors when LLM fails instead of providing fallbacks', async () => {
      // Create a service with broken LLM to test error handling
      const brokenLLMService = {
        generateResponse: jest.fn().mockRejectedValue(new Error('LLM connection failed'))
      };

      const brokenModule = await Test.createTestingModule({
        providers: [
          PlanningService,
          { provide: LLMService, useValue: brokenLLMService },
          AgentDiscoveryService,
          SupabaseService,
          CIDAFMService,
          ConfigService
        ],
      }).compile();

      const brokenService = brokenModule.get<PlanningService>(PlanningService);

      const input: OrchestratorInput = {
        prompt: "Create a plan",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      // Should throw error, not provide fake success
      await expect(brokenService.createPlan(input)).rejects.toThrow(/LLM connection failed|Failed to create plan/);
    });

    /**
     * Test: Does it error when agent discovery fails?
     */
    it('should throw errors when agent discovery fails', async () => {
      const brokenAgentService = {
        discoverAgents: jest.fn().mockRejectedValue(new Error('Agent discovery failed')),
        getDiscoveredAgents: jest.fn().mockReturnValue([])
      };

      const brokenModule = await Test.createTestingModule({
        providers: [
          PlanningService,
          { provide: LLMService, useValue: { generateResponse: jest.fn() } },
          { provide: AgentDiscoveryService, useValue: brokenAgentService },
          SupabaseService,
          CIDAFMService,
          ConfigService
        ],
      }).compile();

      const brokenService = brokenModule.get<PlanningService>(PlanningService);

      const input: OrchestratorInput = {
        prompt: "Create a plan",
        userId: "test-user", 
        conversationId: "test-conv",
        conversationHistory: []
      };

      // Should throw error containing agent discovery failure
      await expect(brokenService.createPlan(input)).rejects.toThrow(/Agent discovery failed|Failed to create plan/);
    });

    /**
     * Test: Does it error when JSON parsing fails? (Real failure scenario)
     */
    it('should throw errors when LLM returns invalid JSON', async () => {
      const invalidJsonLLMService = {
        generateResponse: jest.fn().mockResolvedValue('This is not JSON at all, just plain text')
      };

      const invalidModule = await Test.createTestingModule({
        providers: [
          PlanningService,
          { provide: LLMService, useValue: invalidJsonLLMService },
          AgentDiscoveryService,
          SupabaseService,
          CIDAFMService,
          ConfigService
        ],
      }).compile();

      const invalidService = invalidModule.get<PlanningService>(PlanningService);

      const input: OrchestratorInput = {
        prompt: "Create a plan",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      // Should throw error about JSON parsing failure
      await expect(invalidService.createPlan(input)).rejects.toThrow(/JSON|Failed to create plan/);
    });
  });
});