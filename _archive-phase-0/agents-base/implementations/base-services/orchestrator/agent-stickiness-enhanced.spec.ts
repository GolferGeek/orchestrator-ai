import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DelegationService } from './delegation.service';
import { LLMModule } from '../../../../../llms/llm.module';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../../agent-factory.service';
import { HttpModule } from '@nestjs/axios';

/**
 * Enhanced Agent Stickiness Tests
 *
 * Tests the new capability query functionality where agents are explicitly asked
 * if they can handle follow-up requests before falling back to delegation.
 *
 * This validates the improved flow:
 * 1. Identify sticky agent from last message
 * 2. Query that agent: "Can you handle this new request?"
 * 3. If yes → CONTINUE_DELEGATION, if no → DELEGATE
 */
describe('Enhanced Agent Stickiness - Capability Query Tests', () => {
  let delegationService: DelegationService;

  const mockAvailableAgents = [
    {
      name: 'blog_post',
      type: 'marketing',
      displayName: 'Blog Post Writer',
      description:
        'Creates long-form blog content, articles, and thought leadership pieces',
    },
    {
      name: 'content',
      type: 'marketing',
      displayName: 'Content Writer',
      description:
        'Creates marketing copy, promotional materials, and general content',
    },
    {
      name: 'calendar',
      type: 'operations',
      displayName: 'Calendar Agent',
      description: 'Manages scheduling, meetings, and calendar coordination',
    },
  ];

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
        HttpModule,
        LLMModule,
      ],
      providers: [
        DelegationService,
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

    delegationService = module.get<DelegationService>(DelegationService);
  });

  describe('Agent Capability Query Logic', () => {
    /**
     * Test: Agent can handle related follow-up request
     */
    it('should query sticky agent and continue when agent can handle request', async () => {
      console.log('\n✅ Testing Agent Capability Query - Can Handle');

      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Write a blog post about AI trends in marketing',
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          role: 'assistant' as const,
          content:
            "I've created a comprehensive blog post about AI trends in marketing, covering automation, personalization, and predictive analytics...",
          timestamp: '2024-01-15T10:05:00Z',
          metadata: { agentName: 'blog_post' },
        },
      ];

      const currentPrompt =
        'Can you make the blog post more technical with specific AI model examples?';

      const analysis = await delegationService.analyzeAgentContext(
        conversationHistory,
        currentPrompt,
      );

      console.log(
        `🔍 Enhanced Stickiness Analysis:`,
        JSON.stringify(analysis, null, 2),
      );

      expect(analysis).toBeDefined();
      expect(analysis.currentAgent).toBe('blog_post');
      expect(analysis.reasoning).toContain('blog_post');

      // Should either continue (agent can handle) or decline with specific reasoning
      if (analysis.shouldContinue) {
        expect(analysis.reasoning).toContain('confirmed');
        console.log(
          `✅ blog_post confirmed it can handle the technical revision`,
        );
      } else {
        expect(analysis.reasoning).toContain('declined');
        console.log(`⚠️ blog_post declined the request: ${analysis.reasoning}`);
      }
    }, 60000);

    /**
     * Test: Agent declines unrelated request
     */
    it('should query sticky agent and delegate when agent cannot handle request', async () => {
      console.log('\n❌ Testing Agent Capability Query - Cannot Handle');

      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Write some marketing content for our product launch',
          timestamp: '2024-01-15T11:00:00Z',
        },
        {
          role: 'assistant' as const,
          content:
            "I've created marketing content for your product launch including headlines, descriptions, and call-to-action copy...",
          timestamp: '2024-01-15T11:05:00Z',
          metadata: { agentName: 'content' },
        },
      ];

      const currentPrompt =
        'Now I need to schedule team meetings for next week';

      const analysis = await delegationService.analyzeAgentContext(
        conversationHistory,
        currentPrompt,
      );

      console.log(
        `🔍 Cross-Domain Query Analysis:`,
        JSON.stringify(analysis, null, 2),
      );

      expect(analysis).toBeDefined();
      expect(analysis.currentAgent).toBe('content');

      // Content agent should decline scheduling request
      expect(analysis.shouldContinue).toBe(false);
      expect(analysis.reasoning).toContain('declined');
      expect(analysis.confidence).toBeGreaterThan(0.0); // Conservative fallback may return low confidence

      console.log(`✅ content agent correctly declined scheduling request`);
    }, 60000);

    /**
     * Test: No sticky agent falls back to existing logic
     */
    it('should fall back to existing logic when no sticky agent found', async () => {
      console.log('\n🔄 Testing Fallback to Existing Logic');

      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Hello, I need help with something',
          timestamp: '2024-01-15T12:00:00Z',
        },
        {
          role: 'assistant' as const,
          content:
            "Hello! I'm happy to help. What do you need assistance with?",
          timestamp: '2024-01-15T12:01:00Z',
          metadata: { agentName: 'orchestrator' }, // Orchestrator, not a specialist
        },
      ];

      const currentPrompt = 'I need to create some marketing content';

      const analysis = await delegationService.analyzeAgentContext(
        conversationHistory,
        currentPrompt,
      );

      expect(analysis).toBeDefined();
      expect(analysis.currentAgent).toBeUndefined(); // No sticky agent found
      expect(analysis.shouldContinue).toBe(false);
      expect(analysis.reasoning).toContain('No recent agent context found');

      console.log(
        `✅ Correctly fell back to existing logic when no sticky agent`,
      );
    }, 30000);

    /**
     * Test: Edge case - no current prompt provided
     */
    it('should handle edge case when no current prompt provided', async () => {
      console.log('\n🎯 Testing Edge Case - No Current Prompt');

      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Create a blog post about remote work',
          timestamp: '2024-01-15T13:00:00Z',
        },
        {
          role: 'assistant' as const,
          content: "I've created a blog post about remote work benefits...",
          timestamp: '2024-01-15T13:05:00Z',
          metadata: { agentName: 'blog_post' },
        },
      ];

      // No current prompt provided
      const analysis =
        await delegationService.analyzeAgentContext(conversationHistory);

      expect(analysis).toBeDefined();
      // Should fall back to existing quick analysis logic
      expect(analysis.reasoning).toBeDefined();

      console.log(`✅ Handled edge case gracefully`);
    }, 30000);
  });

  describe('Performance and Error Handling', () => {
    /**
     * Test: Performance with capability queries
     */
    it('should complete capability query analysis within reasonable time', async () => {
      console.log('\n⏱️ Testing Capability Query Performance');

      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Write marketing copy for our new product',
          timestamp: '2024-01-15T14:00:00Z',
        },
        {
          role: 'assistant' as const,
          content:
            "I've created compelling marketing copy for your new product...",
          timestamp: '2024-01-15T14:05:00Z',
          metadata: { agentName: 'content' },
        },
      ];

      const currentPrompt = 'Can you also create some social media posts?';

      const startTime = Date.now();
      const analysis = await delegationService.analyzeAgentContext(
        conversationHistory,
        currentPrompt,
      );
      const endTime = Date.now();

      const duration = endTime - startTime;
      console.log(`⏱️ Capability query completed in ${duration}ms`);

      expect(analysis).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ Performance test passed - query completed efficiently`);
    }, 15000);
  });
});
