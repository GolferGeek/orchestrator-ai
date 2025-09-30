import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MarketingManagerOrchestratorService } from './agent-service';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { SupabaseModule } from '../../../../supabase/supabase.module';
import { LLMModule } from '../../../../llms/llm.module';
import { CIDAFMModule } from '../../../../cidafm/cidafm.module';
import { AuthModule } from '../../../../auth/auth.module';
import { TasksModule } from '../../../../tasks/tasks.module';
import { WebSocketModule } from '../../../../websocket/websocket.module';
import { AgentConversationsModule } from '../../../../agent-conversations/agent-conversations.module';
import {
  OrchestratorInput,
  OrchestratorResponse,
} from '../../../../orchestration/orchestration.types';

/**
 * Marketing Manager Orchestrator - Complete LLM Workflow Tests
 *
 * These tests validate the COMPLETE intelligence of the Marketing Manager:
 * - Can it distinguish between different types of marketing requests?
 * - Does it delegate to the right specialists based on task complexity?
 * - Can it create comprehensive marketing project plans?
 * - Does it handle the complete conversation + tasks paradigm properly?
 *
 * This is the REAL TEST of LLM orchestration intelligence!
 */
describe('MarketingManagerOrchestratorService - Complete LLM Workflow Tests', () => {
  let service: MarketingManagerOrchestratorService;

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
        TasksModule,
        WebSocketModule,
        AgentConversationsModule,
        OrchestratorModule,
      ],
      providers: [MarketingManagerOrchestratorService],
    }).compile();

    service = module.get<MarketingManagerOrchestratorService>(
      MarketingManagerOrchestratorService,
    );
  });

  describe('LLM Intent Recognition for Marketing Requests', () => {
    /**
     * Test: Can Marketing Manager distinguish delegation vs conversation vs project?
     */
    it('should correctly classify simple content request as delegation', async () => {
      const input: OrchestratorInput = {
        prompt:
          'I need a blog post about the future of AI in project management',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      // Explicitly trigger initialization to load delegation context
      await service.onModuleInit();

      // This should be classified as delegation to blog_post agent
      const response: OrchestratorResponse = await service.executeTask(
        'executeTask',
        input,
      );

      expect(response.success).toBe(true);
      expect(response.action || response.metadata?.action).toMatch(
        /(DELEGATE|delegate)/i,
      );
      // Should have routed to a specific agent
      expect(
        response.agentName || response.metadata?.delegatedAgent,
      ).toBeDefined();
    });

    /**
     * Test: Can it recognize complex campaign requests as project creation?
     */
    it('should classify complex marketing campaign as project creation', async () => {
      const input: OrchestratorInput = {
        prompt:
          'I want to launch a comprehensive marketing campaign for our new AI product. This needs market research, competitor analysis, blog content, social media posts, email sequences, and coordinated timing over 2 months.',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      // Should recognize this as a project requiring planning
      expect(response.metadata?.action).toMatch(/(CREATE_PROJECT|project)/i);
      expect(response.projectId || response.planId).toBeDefined();
    });

    /**
     * Test: Can it handle marketing questions as conversation?
     */
    it('should handle strategic marketing questions as conversation', async () => {
      const input: OrchestratorInput = {
        prompt:
          "What are the current trends in B2B marketing? I'm trying to understand what strategies work best for SaaS companies.",
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      expect(response.message || response.response).toBeDefined();
      expect(response.metadata?.action).toMatch(/(CONVERSE|conversation)/i);
    });
  });

  describe('LLM Agent Selection Intelligence', () => {
    /**
     * Test: Can it select the right agent for different content types?
     */
    it('should delegate blog content to blog_post writer', async () => {
      const input: OrchestratorInput = {
        prompt:
          'Create a comprehensive 2000-word thought leadership article about AI transforming project management, with SEO optimization and industry insights',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      // Should delegate to blog_post agent for long-form content
      const delegatedAgent =
        response.agentName || response.metadata?.delegatedAgent;
      expect(delegatedAgent).toMatch(/(blog_post|blog)/i);
    });

    /**
     * Test: Can it select content writer for promotional copy?
     */
    it('should delegate promotional copy to content writer', async () => {
      const input: OrchestratorInput = {
        prompt:
          'Write compelling copy for our product landing page including headlines, feature descriptions, benefits, and call-to-action buttons',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      const delegatedAgent =
        response.agentName || response.metadata?.delegatedAgent;
      expect(delegatedAgent).toMatch(/(content|copy)/i);
    });

    /**
     * Test: Can it select research agents for analysis tasks?
     */
    it('should delegate market analysis to research agents', async () => {
      const input: OrchestratorInput = {
        prompt:
          'I need a detailed competitive analysis of the top 5 project management tools, including pricing, features, and market positioning',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      const delegatedAgent =
        response.agentName || response.metadata?.delegatedAgent;
      expect(delegatedAgent).toMatch(/(competitors|market_research|research)/i);
    });

    /**
     * Test: Can it select marketing swarm for complex campaigns?
     */
    it('should delegate complex campaigns to marketing swarm', async () => {
      const input: OrchestratorInput = {
        prompt:
          'Launch a complete product announcement campaign with press release, multiple blog posts, social media content across platforms, email sequences, and landing page copy',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      const delegatedAgent =
        response.agentName || response.metadata?.delegatedAgent;
      expect(delegatedAgent).toMatch(/(marketing_swarm|swarm)/i);
    });
  });

  describe('LLM Project Planning Intelligence', () => {
    /**
     * Test: Can it create structured marketing campaign plans?
     */
    it('should create comprehensive marketing campaign project plans', async () => {
      const input: OrchestratorInput = {
        prompt:
          'Plan a 6-week product launch campaign for our new AI-powered analytics dashboard. Target enterprise customers, include thought leadership content, competitive positioning, lead generation, and coordinated launch activities.',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      expect(response.projectId || response.planId).toBeDefined();

      // Should provide a structured plan description
      const planDescription = response.message || response.response;
      expect(planDescription).toBeDefined();
      expect(planDescription.length).toBeGreaterThan(200);

      // Should mention key marketing activities
      expect(planDescription.toLowerCase()).toMatch(
        /(blog|content|social|email|launch)/,
      );

      // Should indicate next steps
      expect(planDescription.toLowerCase()).toMatch(
        /(review|approve|next|step)/,
      );
    });

    /**
     * Test: Can it handle plan refinement requests?
     */
    it('should handle plan refinement intelligently', async () => {
      // First create a project
      const initialInput: OrchestratorInput = {
        prompt: 'Create a simple blog content plan for our product',
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const initialResponse = await service.executeTask(
        'executeTask',
        initialInput,
      );
      expect(initialResponse.success).toBe(true);

      // Then refine it
      const refinementInput: OrchestratorInput = {
        prompt:
          "Actually, let's expand this to include social media promotion and email marketing to amplify the blog content",
        userId: 'test-user',
        conversationId: 'test-conv',
        projectId: initialResponse.projectId,
        conversationHistory: [
          {
            role: 'user',
            content: initialInput.prompt,
            timestamp: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content: initialResponse.message || 'Plan created',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'marketing_manager_orchestrator' },
          },
        ],
      };

      const refinedResponse = await service.executeTask(
        'executeTask',
        refinementInput,
      );

      expect(refinedResponse.success).toBe(true);
      expect(refinedResponse.message || refinedResponse.response).toContain(
        'social',
      );
      expect(refinedResponse.message || refinedResponse.response).toContain(
        'email',
      );
    });
  });

  describe('LLM Conversation Context Intelligence', () => {
    /**
     * Test: Can it maintain context in ongoing conversations?
     */
    it('should maintain context in marketing conversations', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'I need help with our product marketing strategy',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content:
            'I can help you develop a comprehensive marketing strategy. What specific aspects would you like to focus on?',
          timestamp: new Date().toISOString(),
          metadata: { agentName: 'marketing_manager_orchestrator' },
        },
      ];

      const input: OrchestratorInput = {
        prompt:
          "Let's focus on content marketing and thought leadership to establish our expertise in the AI space",
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory,
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      // Should understand this as continuation of strategy discussion
      const responseText = response.message || response.response;
      expect(responseText.toLowerCase()).toMatch(
        /(content|thought leadership|ai|strategy)/,
      );
    });

    /**
     * Test: Can it detect when to continue with delegated agents?
     */
    it('should detect continuation with previously delegated agents', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Create a blog post about AI in project management',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content:
            "I've created a comprehensive blog post about AI in project management...",
          timestamp: new Date().toISOString(),
          metadata: { agentName: 'blog_post' },
        },
      ];

      const input: OrchestratorInput = {
        prompt:
          "That's great! Can you also create a shorter version for LinkedIn and Twitter?",
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory,
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);
      // Should either continue with blog_post agent or delegate to content agent for social media
      const delegatedAgent =
        response.agentName || response.metadata?.delegatedAgent;
      expect(
        ['blog_post', 'content'].some((agent) =>
          delegatedAgent?.toLowerCase().includes(agent),
        ),
      ).toBe(true);
    });
  });

  describe('LLM Decision Quality Validation', () => {
    /**
     * Test: Batch validate decision quality across scenarios
     */
    it('should demonstrate consistent high-quality marketing decisions', async () => {
      const testScenarios = [
        {
          prompt:
            'Write a technical blog post about machine learning algorithms',
          expectedDecision: 'delegate_to_blog_writer',
          description: 'Technical long-form content',
        },
        {
          prompt:
            'Create social media posts announcing our new product features',
          expectedDecision: 'delegate_to_content_writer',
          description: 'Short-form promotional content',
        },
        {
          prompt: 'Research what our competitors are doing with their pricing',
          expectedDecision: 'delegate_to_competitors_agent',
          description: 'Competitive intelligence',
        },
        {
          prompt:
            'Plan a complete rebranding campaign with new messaging across all channels',
          expectedDecision: 'create_project',
          description: 'Complex multi-step initiative',
        },
        {
          prompt:
            "What's the best way to position our product against competitors?",
          expectedDecision: 'conversation',
          description: 'Strategic discussion',
        },
      ];

      const results = [];

      for (const scenario of testScenarios) {
        const input: OrchestratorInput = {
          prompt: scenario.prompt,
          userId: 'test-user',
          conversationId: `test-${scenario.expectedDecision}`,
          conversationHistory: [],
        };

        try {
          const _response = await service.executeTask('executeTask', input);

          // Analyze the decision made
          let actualDecision = 'unknown';
          if (response.projectId || response.planId) {
            actualDecision = 'create_project';
          } else if (response.agentName || response.metadata?.delegatedAgent) {
            const agent =
              response.agentName || response.metadata?.delegatedAgent;
            if (agent.includes('blog'))
              actualDecision = 'delegate_to_blog_writer';
            else if (agent.includes('content'))
              actualDecision = 'delegate_to_content_writer';
            else if (agent.includes('competitors'))
              actualDecision = 'delegate_to_competitors_agent';
            else actualDecision = 'delegate_to_other';
          } else {
            actualDecision = 'conversation';
          }

          const correct =
            actualDecision === scenario.expectedDecision ||
            (actualDecision.startsWith('delegate') &&
              scenario.expectedDecision.startsWith('delegate'));

          results.push({
            ...scenario,
            actualDecision,
            correct,
            confidence: response.metadata?.confidence || 'N/A',
          });
        } catch (_error) {
          results.push({
            ...scenario,
            actualDecision: '_error',
            correct: false,
            error: _error instanceof Error ? _error.message : 'Unknown _error',
          });
        }
      }

      console.log('\nMarketing Manager Decision Results:');
      results.forEach((result) => {
        console.log(
          `${result.correct ? '✅' : '❌'} ${result.description}: ${result.expectedDecision} → ${result.actualDecision}`,
        );
      });

      const accuracy = results.filter((r) => r.correct).length / results.length;
      console.log(
        `\nMarketing Manager Decision Accuracy: ${(accuracy * 100).toFixed(1)}%`,
      );

      // Should achieve at least 80% accuracy
      expect(accuracy).toBeGreaterThan(0.8);
    });

    /**
     * Test: Response quality and completeness
     */
    it('should provide high-quality, complete responses', async () => {
      const input: OrchestratorInput = {
        prompt:
          "I'm launching a new B2B SaaS product and need a complete marketing strategy. What should I consider?",
        userId: 'test-user',
        conversationId: 'test-conv',
        conversationHistory: [],
      };

      const _response = await service.executeTask('executeTask', input);

      expect(response.success).toBe(true);

      const responseText = response.message || response.response;
      expect(responseText).toBeDefined();
      expect(responseText.length).toBeGreaterThan(100);

      // Should provide strategic marketing guidance
      expect(responseText.toLowerCase()).toMatch(
        /(strategy|marketing|b2b|saas|target|audience|content|campaign)/,
      );

      // Should include actionable suggestions
      expect(responseText.toLowerCase()).toMatch(
        /(recommend|suggest|consider|start|create|develop)/,
      );

      // Should maintain professional marketing manager tone
      expect(responseText).toMatch(/[.!?]/); // Proper sentences
    });
  });
});
