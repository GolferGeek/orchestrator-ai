import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MarketingManagerOrchestratorService } from './agent-service';
import { SupabaseModule } from '../../../../supabase/supabase.module';
import { LLMModule } from '../../../../llms/llm.module';
import { CIDAFMModule } from '../../../../cidafm/cidafm.module';
import { HttpModule } from '@nestjs/axios';
import { TasksModule } from '../../../../tasks/tasks.module';
import { WebSocketModule } from '../../../../websocket/websocket.module';
import { AuthModule } from '../../../../auth/auth.module';
import { AgentConversationsModule } from '../../../../agent-conversations/agent-conversations.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AgentDiscoveryService } from '../../../../agent-discovery.service';
import { AgentFactoryService } from '../../../../agent-factory.service';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';

/**
 * Marketing Manager Orchestrator - Realistic User Prompt Tests
 *
 * Tests realistic user prompts to validate the orchestrator can distinguish between:
 * - content: All marketing content creation (blogs, copy, social media, educational content)
 * - market_research: Market research AND competitive intelligence
 *
 * Uses multiple attempts per agent type to find patterns in what works vs what doesn't.
 * This helps validate that the delegation context can handle real user variability.
 */
describe('Marketing Manager - Realistic User Prompt Tests', () => {
  let marketingManager: MarketingManagerOrchestratorService;

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
        OrchestratorModule,
        SupabaseModule,
        LLMModule,
        CIDAFMModule,
        AuthModule,
        TasksModule,
        WebSocketModule,
        AgentConversationsModule,
      ],
      providers: [
        MarketingManagerOrchestratorService,
        AgentDiscoveryService,
        AgentFactoryService,
      ],
    }).compile();

    marketingManager = module.get<MarketingManagerOrchestratorService>(
      MarketingManagerOrchestratorService,
    );

    // Set agent path for delegation context
    (marketingManager as any).agentPath =
      'orchestrator/marketing_manager_orchestrator';

    if (marketingManager.onModuleInit) {
      await marketingManager.onModuleInit();
    }
  });

  describe('Blog Post Agent - Realistic User Prompts', () => {
    const blogPrompts = [
      'Write a blog post about AI in small business',
      'I need an article on the future of automation for our company blog',
      'Can you create a thought leadership piece about remote work trends?',
      'Write something educational about project management best practices',
      'Create a blog article that positions us as experts in our field',
      'I want a long-form piece about industry trends our customers would find valuable',
      'Write a tutorial blog post about getting started with our type of software',
    ];

    blogPrompts.forEach((prompt, index) => {
      it(`should handle blog prompt ${index + 1}: "${prompt.substring(0, 40)}..."`, async () => {
        console.log(`\n📝 Testing Blog Prompt ${index + 1}: ${prompt}`);

        const result = await marketingManager.executeTask('executeTask', {
          prompt,
          userId: `test-blog-${index}`,
          conversationId: `test-conv-blog-${index}`,
          conversationHistory: [],
        });

        console.log(`✅ Routed to: ${result.agentName || 'CONVERSATION'}`);
        console.log(`🎯 Action: ${result.action || 'unknown'}`);
        
        if (result.response && result.response.includes("I'm the orchestrator")) {
          console.log('❌ CONVERSATION FALLBACK - Should have delegated');
        }

        expect(result.success).toBe(true);
        
        // Track what happened for analysis
        if (result.agentName === 'content') {
          console.log('🎉 SUCCESS: Correctly delegated to content');
        } else if (result.agentName === 'market_research') {
          console.log('❓ UNEXPECTED: Delegated to market_research');
        } else {
          console.log('❌ FAILED: Conversation fallback instead of delegation');
        }
      }, 60000);
    });
  });

  describe('Content Agent - Realistic User Prompts', () => {
    const contentPrompts = [
      'Write copy for our new product landing page',
      'Create social media posts for our latest feature launch',
      'I need email marketing content for our newsletter',
      'Write ad copy for Google Ads about our service',
      'Create website copy that converts visitors to customers',
      'Write promotional content for our upcoming webinar',
      'I need marketing copy that highlights our key benefits',
      'Create content for our sales brochure',
    ];

    contentPrompts.forEach((prompt, index) => {
      it(`should handle content prompt ${index + 1}: "${prompt.substring(0, 40)}..."`, async () => {
        console.log(`\n✍️ Testing Content Prompt ${index + 1}: ${prompt}`);

        const result = await marketingManager.executeTask('executeTask', {
          prompt,
          userId: `test-content-${index}`,
          conversationId: `test-conv-content-${index}`,
          conversationHistory: [],
        });

        console.log(`✅ Routed to: ${result.agentName || 'CONVERSATION'}`);
        console.log(`🎯 Action: ${result.action || 'unknown'}`);
        
        if (result.response && result.response.includes("I'm the orchestrator")) {
          console.log('❌ CONVERSATION FALLBACK - Should have delegated');
        }

        expect(result.success).toBe(true);
        
        // Track what happened for analysis
        if (result.agentName === 'content') {
          console.log('🎉 SUCCESS: Correctly delegated to content');
        } else if (result.agentName === 'market_research') {
          console.log('❓ UNEXPECTED: Delegated to market_research');
        } else {
          console.log('❌ FAILED: Conversation fallback instead of delegation');
        }
      }, 60000);
    });
  });

  describe('Market Research Agent - Realistic User Prompts', () => {
    const researchPrompts = [
      'Who are our main competitors in the market?',
      'I need market research on our target customers',
      'What trends are happening in our industry?',
      'Research our competitive landscape and positioning',
      'Analyze customer feedback and market sentiment',
      'I want to understand our market share vs competitors',
      'Study our target market demographics and behavior',
      'Compare our pricing with competitor pricing strategies',
      'Research emerging opportunities in our market',
    ];

    researchPrompts.forEach((prompt, index) => {
      it(`should handle research prompt ${index + 1}: "${prompt.substring(0, 40)}..."`, async () => {
        console.log(`\n📊 Testing Research Prompt ${index + 1}: ${prompt}`);

        const result = await marketingManager.executeTask('executeTask', {
          prompt,
          userId: `test-research-${index}`,
          conversationId: `test-conv-research-${index}`,
          conversationHistory: [],
        });

        console.log(`✅ Routed to: ${result.agentName || 'CONVERSATION'}`);
        console.log(`🎯 Action: ${result.action || 'unknown'}`);
        
        if (result.response && result.response.includes("I'm the orchestrator")) {
          console.log('❌ CONVERSATION FALLBACK - Should have delegated');
        }

        expect(result.success).toBe(true);
        
        // Track what happened for analysis
        if (result.agentName === 'market_research') {
          console.log('🎉 SUCCESS: Correctly delegated to market_research');
        } else if (result.agentName === 'content') {
          console.log('❓ UNEXPECTED: Delegated to content');
        } else {
          console.log('❌ FAILED: Conversation fallback instead of delegation');
        }
      }, 60000);
    });
  });

  describe('Cross-Agent Ambiguous Prompts', () => {
    // These are deliberately ambiguous prompts that could reasonably go to multiple agents
    const ambiguousPrompts = [
      {
        prompt: 'Write about our competitive advantages',
        reasonableAgents: ['content', 'market_research'],
        description: 'Could be blog content, marketing copy, or competitive analysis'
      },
      {
        prompt: 'Create content about industry trends',
        reasonableAgents: ['content', 'market_research'],
        description: 'Could be thought leadership, marketing content, or research analysis'
      },
      {
        prompt: 'I need something about our target market',
        reasonableAgents: ['content', 'market_research'],
        description: 'Could be marketing copy or market research'
      },
      {
        prompt: 'Help me understand our positioning vs competitors',
        reasonableAgents: ['market_research', 'content'],
        description: 'Could be competitive analysis or thought leadership'
      },
      {
        prompt: 'Write something that shows we understand our customers',
        reasonableAgents: ['content', 'market_research'],
        description: 'Very ambiguous - could go multiple ways'
      }
    ];

    ambiguousPrompts.forEach((testCase, index) => {
      it(`should handle ambiguous prompt ${index + 1}: "${testCase.prompt}"`, async () => {
        console.log(`\n🤷 Testing Ambiguous Prompt ${index + 1}: ${testCase.prompt}`);
        console.log(`💭 ${testCase.description}`);
        console.log(`✅ Reasonable agents: ${testCase.reasonableAgents.join(', ')}`);

        const result = await marketingManager.executeTask('executeTask', {
          prompt: testCase.prompt,
          userId: `test-ambiguous-${index}`,
          conversationId: `test-conv-ambiguous-${index}`,
          conversationHistory: [],
        });

        console.log(`✅ Routed to: ${result.agentName || 'CONVERSATION'}`);
        console.log(`🎯 Action: ${result.action || 'unknown'}`);
        
        if (result.response && result.response.includes("I'm the orchestrator")) {
          console.log('❌ CONVERSATION FALLBACK - Should have delegated to someone');
        }

        expect(result.success).toBe(true);
        
        // For ambiguous prompts, any of the reasonable agents is acceptable
        if (result.agentName && testCase.reasonableAgents.includes(result.agentName)) {
          console.log(`🎉 REASONABLE: Delegated to ${result.agentName} (acceptable choice)`);
        } else if (result.agentName) {
          console.log(`🤔 UNEXPECTED: Delegated to ${result.agentName} (not in expected list)`);
        } else {
          console.log('❌ FAILED: Should have delegated to someone, got conversation fallback');
        }
      }, 60000);
    });
  });

  describe('Overall Delegation Pattern Analysis', () => {
    it('should demonstrate overall delegation intelligence across agent types', async () => {
      console.log('\n🧠 COMPREHENSIVE DELEGATION PATTERN TEST');
      console.log('Testing one clear example for each agent type...\n');

      // Test one clear case for each agent
      const testCases = [
        {
          prompt: 'Write a comprehensive blog post about the future of AI in business',
          expectedAgent: 'content',
          type: 'Blog Content'
        },
        {
          prompt: 'Create compelling ad copy for our new product launch campaign',
          expectedAgent: 'content', 
          type: 'Marketing Copy'
        },
        {
          prompt: 'Research our top 5 competitors and analyze their market positioning',
          expectedAgent: 'market_research',
          type: 'Competitive Research'
        }
      ];

      const results = [];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        if (!testCase) continue;
        
        console.log(`📋 ${testCase.type}: "${testCase.prompt}"`);

        const result = await marketingManager.executeTask('executeTask', {
          prompt: testCase.prompt,
          userId: `test-pattern-${i}`,
          conversationId: `test-conv-pattern-${i}`,
          conversationHistory: [],
        });

        const success = result.agentName === testCase.expectedAgent;
        console.log(`${success ? '✅' : '❌'} ${testCase.type} → ${result.agentName || 'CONVERSATION'} ${success ? '(CORRECT)' : '(EXPECTED: ' + testCase.expectedAgent + ')'}`);
        
        results.push({
          type: testCase.type,
          expected: testCase.expectedAgent,
          actual: result.agentName,
          success: success
        });
      }

      console.log('\n📊 DELEGATION INTELLIGENCE SUMMARY:');
      const successCount = results.filter(r => r.success).length;
      console.log(`🎯 Success Rate: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);
      
      results.forEach(r => {
        console.log(`   ${r.success ? '✅' : '❌'} ${r.type}: ${r.actual || 'CONVERSATION'}`);
      });

      if (successCount === results.length) {
        console.log('\n🎉 PERFECT: All clear cases delegated correctly!');
      } else if (successCount >= results.length * 0.67) {
        console.log('\n🤔 GOOD: Most cases working, some need delegation context refinement');
      } else {
        console.log('\n❌ NEEDS WORK: Delegation context needs significant improvement');
      }

      // At least 2/3 should work for this to be considered passing
      expect(successCount).toBeGreaterThanOrEqual(Math.ceil(results.length * 0.67));
    }, 180000);
  });
});