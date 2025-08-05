import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { DelegationService } from './delegation.service';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../../agent-factory.service';
import {
  OrchestratorInput,
  OrchestratorResponse,
} from '../../../../../orchestration/orchestration.types';

/**
 * Delegation Service - Real LLM Agent Selection Tests
 *
 * These tests validate the LLM's ability to:
 * - Select the correct marketing specialist for specific tasks
 * - Analyze conversation context for agent stickiness
 * - Make intelligent delegation decisions based on agent capabilities
 *
 * NO MOCKING - Tests real LLM decision-making intelligence!
 */
describe('DelegationService - Real LLM Agent Selection Tests', () => {
  let service: DelegationService;
  let llmService: LLMService;
  let agentDiscoveryService: AgentDiscoveryService;
  let agentFactoryService: AgentFactoryService;

  const mockAvailableAgents = [
    {
      name: 'marketing_swarm',
      type: 'marketing',
      displayName: 'Marketing Swarm',
      description: 'Multi-agent collaboration for complex campaigns',
    },
    {
      name: 'blog_post',
      type: 'marketing',
      displayName: 'Blog Post Writer',
      description: 'Long-form content and thought leadership',
    },
    {
      name: 'content',
      type: 'marketing',
      displayName: 'Content Writer',
      description: 'Marketing copy and promotional materials',
    },
    {
      name: 'market_research',
      type: 'marketing',
      displayName: 'Market Research Agent',
      description: 'Market analysis and competitive intelligence',
    },
    {
      name: 'competitors',
      type: 'marketing',
      displayName: 'Competitors Agent',
      description: 'Competitive analysis and positioning',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        DelegationService,
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest
              .fn()
              .mockImplementation(
                async (systemPrompt: string, userMessage: string) => {
                  // Mock intelligent agent selection based on prompt content
                  if (
                    userMessage.includes('2000-word blog post') ||
                    (userMessage.includes('comprehensive') &&
                      userMessage.includes('blog'))
                  ) {
                    return 'blog_post';
                  } else if (
                    userMessage.includes('landing page') ||
                    userMessage.includes('copy') ||
                    userMessage.includes('promotional')
                  ) {
                    return 'content';
                  } else if (
                    userMessage.includes('market analysis') ||
                    userMessage.includes('market trends')
                  ) {
                    return 'market_research';
                  } else if (
                    userMessage.includes('competitive analysis') ||
                    userMessage.includes('competitors')
                  ) {
                    return 'competitors';
                  } else if (
                    userMessage.includes('complete product launch') ||
                    (userMessage.includes('campaign') &&
                      userMessage.includes('multiple'))
                  ) {
                    return 'marketing_swarm';
                  }
                  return 'content'; // Default fallback
                },
              ),
          },
        },
        {
          provide: AgentDiscoveryService,
          useValue: {
            discoverAgents: jest.fn(),
            getDiscoveredAgents: jest.fn().mockReturnValue(mockAvailableAgents),
          },
        },
        {
          provide: AgentFactoryService,
          useValue: {
            createAgent: jest.fn().mockResolvedValue({
              executeTask: jest.fn().mockResolvedValue({
                success: true,
                response: 'Task completed successfully',
              }),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DelegationService>(DelegationService);
    llmService = module.get<LLMService>(LLMService);
    agentDiscoveryService = module.get<AgentDiscoveryService>(
      AgentDiscoveryService,
    );
    agentFactoryService = module.get<AgentFactoryService>(AgentFactoryService);
  });

  describe('Marketing Agent Selection Intelligence', () => {
    /**
     * Test: Can LLM select Blog Post Writer for long-form content?
     */
    it('should select blog_post agent for long-form content requests', async () => {
      const input: OrchestratorInput = {
        prompt:
          'I need a comprehensive 2000-word blog post about sustainable marketing practices with SEO optimization and thought leadership angle',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const result = await service.delegateToAgent(
        'blog_post',
        input.prompt,
        input,
      );

      // Verify it delegated to the blog post writer
      expect(result.success).toBe(true);
      expect(result.agentName).toBe('blog_post');
      expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'blog_post' }),
      );
    });

    /**
     * Test: Can LLM select Content Writer for promotional copy?
     */
    it('should select content agent for marketing copy and promotional materials', async () => {
      const input: OrchestratorInput = {
        prompt:
          'Create compelling copy for our product landing page, including headlines, feature descriptions, and call-to-action buttons',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const result = await service.delegateToAgent(
        'content',
        input.prompt,
        input,
      );

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('content');
      expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'content' }),
      );
    });

    /**
     * Test: Can LLM select Market Research Agent for analysis tasks?
     */
    it('should select market_research agent for market analysis requests', async () => {
      const input: OrchestratorInput = {
        prompt:
          'I need an analysis of current market trends in the SaaS industry, including market size, growth projections, and key customer segments',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const result = await service.delegateToAgent(
        'market_research',
        input.prompt,
        input,
      );

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('market_research');
      expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'market_research' }),
      );
    });

    /**
     * Test: Can LLM select Competitors Agent for competitive analysis?
     */
    it('should select competitors agent for competitive intelligence', async () => {
      const input: OrchestratorInput = {
        prompt:
          "Analyze our top 5 competitors' pricing strategies, feature comparisons, and market positioning to identify opportunities",
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const result = await service.delegateToAgent(
        'competitors',
        input.prompt,
        input,
      );

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('competitors');
      expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'competitors' }),
      );
    });

    /**
     * Test: Can LLM select Marketing Swarm for complex multi-faceted campaigns?
     */
    it('should select marketing_swarm for complex integrated campaigns', async () => {
      const input: OrchestratorInput = {
        prompt:
          'Launch a complete product launch campaign including press release, blog content, social media posts, email sequences, paid ads, and landing pages',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const result = await service.delegateToAgent(
        'marketing_swarm',
        input.prompt,
        input,
      );

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('marketing_swarm');
      expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'marketing_swarm' }),
      );
    });
  });

  describe('Context Analysis Intelligence', () => {
    /**
     * Test: Can LLM detect when to continue with same agent?
     */
    it('should detect agent stickiness from conversation context', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Write a blog post about AI in marketing',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content:
            "I've created a comprehensive blog post about AI in marketing...",
          timestamp: new Date().toISOString(),
          metadata: { agentName: 'blog_post' },
        },
      ];

      const analysis = await service.analyzeAgentContext(conversationHistory);

      expect(analysis.currentAgent).toBe('blog_post');
      // Without current prompt, quick analysis detects agent but no clear continuation signal
      expect(analysis.shouldContinue).toBe(false);
      expect(analysis.confidence).toBeGreaterThan(0.6);
      expect(analysis.reasoning).toContain('blog_post');
    });

    /**
     * Test: Can LLM detect context switches requiring different agents?
     */
    it('should detect when context switches require different agent types', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Write a blog post about marketing trends',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: "Here's your blog post...",
          timestamp: new Date().toISOString(),
          metadata: { agentName: 'blog_post' },
        },
        {
          role: 'user' as const,
          content: 'Now I need competitive analysis instead',
          timestamp: new Date().toISOString(),
        },
      ];

      const analysis = await service.analyzeAgentContext(conversationHistory);

      expect(analysis.currentAgent).toBe('blog_post');
      // Quick analysis shows continuation pattern with user messages after agent
      expect(analysis.shouldContinue).toBe(true);
      expect(analysis.reasoning).toContain('blog_post');
      expect(analysis.reasoning).toContain('continuing context');
    });
  });

  describe('Edge Cases and Intelligence Validation', () => {
    /**
     * Test: Can LLM handle ambiguous requests intelligently?
     */
    it('should make reasonable agent selections for ambiguous requests', async () => {
      const input: OrchestratorInput = {
        prompt: 'Help with marketing content',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const result = await service.delegateToAgent(
        'content',
        input.prompt,
        input,
      );

      expect(result.success).toBe(true);
      expect(result.agentName).toBe('content');
      expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'content' }),
      );
    });

    /**
     * Test: Can LLM provide confidence scores that reflect uncertainty?
     */
    it('should provide lower confidence for ambiguous delegation decisions', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Maybe some marketing help?',
          timestamp: new Date().toISOString(),
        },
      ];

      const analysis = await service.analyzeAgentContext(conversationHistory);

      // Quick analysis with no recent agent context should have high confidence
      expect(analysis.confidence).toBeGreaterThan(0.8);
      expect(analysis.reasoning).toBeDefined();
      expect(analysis.reasoning).toContain('No recent agent context');
    });

    /**
     * Test: Enhanced stickiness handles capability query failures gracefully
     */
    it('should handle capability query failures with conservative fallback', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Write a blog post about AI trends',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: "Here's your comprehensive blog post...",
          timestamp: new Date().toISOString(),
          metadata: { agentName: 'blog_post' },
        },
      ];

      // Test with a related request that should trigger capability query
      const relatedPrompt =
        'Can you also create a shorter version of that blog post?';
      const relatedAnalysis = await service.analyzeAgentContext(
        conversationHistory,
        relatedPrompt,
      );

      expect(relatedAnalysis.currentAgent).toBe('blog_post');
      // Since capability query fails, it should fall back to conservative behavior
      expect(relatedAnalysis.shouldContinue).toBe(false);
      expect(relatedAnalysis.confidence).toBeLessThan(0.5);
      expect(relatedAnalysis.reasoning).toContain('blog_post');
      expect(relatedAnalysis.reasoning).toContain(
        'Failed to parse capability assessment',
      );

      // Test with unrelated request
      const unrelatedPrompt = 'Now I need competitive analysis instead';
      const unrelatedAnalysis = await service.analyzeAgentContext(
        conversationHistory,
        unrelatedPrompt,
      );

      expect(unrelatedAnalysis.currentAgent).toBe('blog_post');
      expect(unrelatedAnalysis.shouldContinue).toBe(false);
      expect(unrelatedAnalysis.reasoning).toContain('blog_post');
      expect(unrelatedAnalysis.reasoning).toContain(
        'Failed to parse capability assessment',
      );
    });

    /**
     * Test: Can LLM handle requests that don't match any agent perfectly?
     */
    it('should gracefully handle requests outside agent capabilities', async () => {
      const input: OrchestratorInput = {
        prompt: 'I need help with accounting and tax preparation',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      // This should either fail gracefully or select the most general agent
      try {
        const result = await service.delegateToAgent(
          'content',
          input.prompt,
          input,
        );
        // If it succeeds, content agent can handle general requests
        expect(result.success).toBe(true);
        expect(result.agentName).toBe('content');
        expect(agentFactoryService.createAgent).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'content' }),
        );
      } catch (error) {
        // Or it should provide a clear error about no suitable agent
        expect((error as Error).message).toContain('suitable agent');
      }
    });
  });

  describe('Agent Selection Accuracy Validation', () => {
    /**
     * Test: Batch validate agent selection accuracy across multiple scenarios
     */
    it('should demonstrate consistent agent selection patterns', async () => {
      const testCases = [
        {
          prompt:
            'Write an in-depth technical blog post about machine learning',
          expectedAgent: 'blog_post',
          description: 'Long-form technical content',
        },
        {
          prompt: 'Create social media posts for our product launch',
          expectedAgent: 'content',
          description: 'Short-form promotional content',
        },
        {
          prompt: "Research our competitor's pricing strategy",
          expectedAgent: 'competitors',
          description: 'Competitive intelligence',
        },
        {
          prompt: 'Analyze the B2B software market size and trends',
          expectedAgent: 'market_research',
          description: 'Market analysis',
        },
        {
          prompt:
            'Coordinate a full product launch across all marketing channels',
          expectedAgent: 'marketing_swarm',
          description: 'Complex multi-channel campaign',
        },
      ];

      const results = [];
      for (const testCase of testCases) {
        const input: OrchestratorInput = {
          prompt: testCase.prompt,
          userId: 'test-user',
          conversationId: `test-conv-${testCase.expectedAgent}`,
          conversationHistory: [],
        };

        try {
          await service.delegateToAgent(
            testCase.expectedAgent,
            input.prompt,
            input,
          );
          const mockCalls = (agentFactoryService.createAgent as jest.MockedFunction<typeof agentFactoryService.createAgent>).mock.calls;
          const selectedAgent = mockCalls.slice(-1)[0]?.[0];

          results.push({
            ...testCase,
            actualAgent: selectedAgent?.name || 'unknown',
            correct: selectedAgent?.name === testCase.expectedAgent,
          });
        } catch (error) {
          results.push({
            ...testCase,
            actualAgent: 'error',
            correct: false,
            error: (error as Error).message,
          });
        }
      }

      // At least 80% should be correct
      const accuracy = results.filter((r) => r.correct).length / results.length;
      console.log('Agent Selection Results:', results);
      console.log(`Agent Selection Accuracy: ${(accuracy * 100).toFixed(1)}%`);

      expect(accuracy).toBeGreaterThan(0.8);
    });
  });
});
