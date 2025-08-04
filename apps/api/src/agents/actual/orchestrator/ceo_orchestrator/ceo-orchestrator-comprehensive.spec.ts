import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { CEOOrchestratorService } from './agent-service';
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
 * CEO Orchestrator - Comprehensive Cross-Departmental Intelligence Tests
 * 
 * Tests the CEO's ability to intelligently coordinate across all departments:
 * - marketing_manager_orchestrator: Strategic marketing initiatives
 * - engineering: Product development and technical strategy  
 * - hr: Human resources and organizational development
 * - finance: Financial planning and analysis
 * - productivity: Operations and efficiency improvements
 * - sales: Customer acquisition and revenue generation
 * - operations: Daily business operations and support
 * - research: Knowledge management and insights
 * - product: Product strategy and launch coordination
 * 
 * Validates real LLM decision-making for cross-functional project coordination.
 */
describe('CEO Orchestrator - Comprehensive Cross-Departmental Intelligence Tests', () => {
  let ceoOrchestrator: CEOOrchestratorService;
  let agentDiscovery: AgentDiscoveryService;

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
        AgentConversationsModule
      ],
      providers: [
        CEOOrchestratorService,
        AgentDiscoveryService,
        AgentFactoryService
      ],
    }).compile();

    ceoOrchestrator = module.get<CEOOrchestratorService>(CEOOrchestratorService);
    agentDiscovery = module.get<AgentDiscoveryService>(AgentDiscoveryService);
    
    // Manually set the agent path for tests so delegation context can be loaded
    (ceoOrchestrator as any).agentPath = 'orchestrator/ceo_orchestrator';
    
    // Manually initialize the CEO orchestrator for tests
    if (ceoOrchestrator.onModuleInit) {
      await ceoOrchestrator.onModuleInit();
    }
  });

  describe('Cross-Departmental Delegation Intelligence', () => {
    /**
     * Test: Marketing Strategy Delegation
     */
    it('should intelligently delegate marketing strategy to marketing_manager_orchestrator', async () => {
      console.log('\\n🎯 Testing Marketing Strategy Delegation');
      
      const marketingRequest = {
        prompt: "Develop a comprehensive go-to-market strategy for our new AI product. We need market positioning, competitive analysis, content strategy, and launch campaign coordination.",
        userId: "test-ceo-marketing",
        conversationId: "test-conv-ceo-marketing",
        conversationHistory: []
      };

      const result = await ceoOrchestrator.executeTask('executeTask', marketingRequest);
      
      console.log(`🔍 Debug result:`, JSON.stringify(result, null, 2));
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      
      // CEO should either trigger clarification for complex requests or delegate directly
      if (result.action === 'CLARIFY') {
        console.log(`✅ CEO triggered intelligent clarification for complex marketing strategy`);
        expect(result.requiresUserChoice).toBe(true);
        expect(result.options).toBeDefined();
        expect(result.options?.delegate?.agentName).toBeDefined();
        
        console.log(`🤖 Option A: ${result.options?.delegate?.agentName}`);
        console.log(`📋 Option B: ${result.options?.project?.description}`);
        
        // Should suggest marketing_manager_orchestrator for marketing strategy
        expect(['marketing_manager_orchestrator', 'product_launch_coordinator']).toContain(result.options?.delegate?.agentName);
      } else {
        expect(result.agentName).toBeDefined();
        console.log(`✅ CEO delegated directly to: ${result.agentName}`);
        
        // Should delegate to marketing_manager_orchestrator for strategic marketing initiatives
        expect(['marketing_manager_orchestrator', 'product_launch_coordinator']).toContain(result.agentName);
      }
      
      console.log(`📊 Response: ${result.response?.substring(0, 200)}...`);
      
    }, 90000);

    /**
     * Test: Engineering/Technical Strategy Delegation  
     */
    it('should intelligently delegate technical strategy to engineering agents', async () => {
      console.log('\\n⚙️ Testing Engineering Strategy Delegation');
      
      const engineeringRequest = {
        prompt: "We need to define technical requirements for a new AI-powered project management system. Include architecture decisions, technology stack recommendations, and development roadmap.",
        userId: "test-ceo-engineering",
        conversationId: "test-conv-ceo-engineering", 
        conversationHistory: []
      };

      const result = await ceoOrchestrator.executeTask('executeTask', engineeringRequest);
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.agentName).toBeDefined();
      
      console.log(`✅ Delegated to: ${result.agentName}`);
      console.log(`📊 Technical Strategy: ${result.response?.substring(0, 200)}...`);
      
      // Should delegate to engineering agents for technical strategy
      expect(['requirements_writer', 'launcher', 'golf_rules_agent']).toContain(result.agentName);
      
    }, 90000);

    /**
     * Test: HR/Organizational Development Delegation
     */
    it('should intelligently delegate HR initiatives to hr agents', async () => {
      console.log('\\n👥 Testing HR Strategy Delegation');
      
      const hrRequest = {
        prompt: "Design a comprehensive onboarding program for new engineering hires. Include technical training, culture integration, and performance milestone tracking.",
        userId: "test-ceo-hr",
        conversationId: "test-conv-ceo-hr",
        conversationHistory: []
      };

      const result = await ceoOrchestrator.executeTask('executeTask', hrRequest);
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.agentName).toBeDefined();
      
      console.log(`✅ Delegated to: ${result.agentName}`);
      console.log(`📊 HR Strategy: ${result.response?.substring(0, 200)}...`);
      
      // Should delegate to HR agents for organizational initiatives
      expect(['hr_assistant', 'onboarding']).toContain(result.agentName);
      
    }, 90000);

    /**
     * Test: Financial Strategy Delegation
     */
    it('should intelligently delegate financial planning to finance agents', async () => {
      console.log('\\n💰 Testing Finance Strategy Delegation');
      
      const financeRequest = {
        prompt: "Analyze our current business metrics and create a financial forecast for Q2. Include revenue projections, cost analysis, and investment recommendations.",
        userId: "test-ceo-finance",
        conversationId: "test-conv-ceo-finance",
        conversationHistory: []
      };

      const result = await ceoOrchestrator.executeTask('executeTask', financeRequest);
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.agentName).toBeDefined();
      
      console.log(`✅ Delegated to: ${result.agentName}`);
      console.log(`📊 Financial Analysis: ${result.response?.substring(0, 200)}...`);
      
      // Should delegate to finance agents for financial planning
      expect(['metrics', 'invoice']).toContain(result.agentName);
      
    }, 90000);

    /**
     * Test: Operations/Productivity Delegation
     */
    it('should intelligently delegate operational efficiency to operations agents', async () => {
      console.log('\\n📋 Testing Operations Strategy Delegation');
      
      const operationsRequest = {
        prompt: "Optimize our team meeting processes and calendar management. Create standard operating procedures that improve productivity and reduce meeting overhead.",
        userId: "test-ceo-operations",
        conversationId: "test-conv-ceo-operations",
        conversationHistory: []
      };

      const result = await ceoOrchestrator.executeTask('executeTask', operationsRequest);
      
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.agentName).toBeDefined();
      
      console.log(`✅ Delegated to: ${result.agentName}`);
      console.log(`📊 Operations Strategy: ${result.response?.substring(0, 200)}...`);
      
      // Should delegate to operations/productivity agents
      expect(['calendar', 'meetings', 'sop', 'notion']).toContain(result.agentName);
      
    }, 90000);

  });

  describe('Cross-Functional Project Coordination Intelligence', () => {
    /**
     * Test: Complex cross-departmental requests that should trigger clarification
     */
    it('should handle complex cross-departmental initiatives with clarification workflow', async () => {
      console.log('\\n🔄 Testing Cross-Functional Project Clarification');
      
      // Complex request that spans multiple departments
      const complexRequest = {
        prompt: "Launch a company-wide digital transformation initiative that includes new technology implementation, employee training, process optimization, and performance tracking across all departments.",
        userId: "test-ceo-complex",
        conversationId: "test-conv-ceo-complex",
        conversationHistory: []
      };

      const clarificationResult = await ceoOrchestrator.executeTask('executeTask', complexRequest);
      
      expect(clarificationResult).toBeDefined();
      expect(clarificationResult.success).toBe(true);
      
      // For CEO, complex cross-functional requests should either:
      // 1. Trigger clarification (CLARIFY action)
      // 2. Delegate to most appropriate orchestrator
      // 3. Attempt project creation for coordination
      
      if (clarificationResult.action === 'CLARIFY') {
        console.log(`✅ Clarification triggered for cross-functional initiative`);
        expect(clarificationResult.requiresUserChoice).toBe(true);
        expect(clarificationResult.options).toBeDefined();
        
        console.log(`🤖 Option A: ${clarificationResult.options?.delegate?.agentName}`);
        console.log(`📋 Option B: ${clarificationResult.options?.project?.outline}`);
        
        // Test user choosing delegation
        const delegationChoice = {
          prompt: "A", // Choose delegation
          userId: "test-ceo-complex",
          conversationId: "test-conv-ceo-complex",
          conversationHistory: [
            {
              role: 'user' as const,
              content: complexRequest.prompt,
              timestamp: new Date().toISOString()
            },
            {
              role: 'assistant' as const,
              content: clarificationResult.response || 'Clarification presented',
              timestamp: new Date().toISOString(),
              metadata: { 
                agentName: 'CEO Orchestrator',
                action: 'CLARIFY',
                requiresUserChoice: true 
              }
            }
          ]
        };

        const delegationResult = await ceoOrchestrator.executeTask('executeTask', delegationChoice);
        
        expect(delegationResult).toBeDefined();
        expect(delegationResult.success).toBe(true);
        expect(delegationResult.agentName).toBeDefined();
        
        console.log(`✅ Cross-functional delegation to: ${delegationResult.agentName}`);
        
      } else {
        // Direct delegation or project creation
        console.log(`ℹ️ Direct handling: ${clarificationResult.action} → ${clarificationResult.agentName}`);
        expect(clarificationResult.agentName).toBeDefined();
      }
      
      console.log('\\n🎉 Cross-functional coordination workflow validated!');
      
    }, 180000);

    /**
     * Test: Strategic decision-making across departments
     */
    it('should demonstrate strategic decision-making for department coordination', async () => {
      console.log('\\n🎯 Testing Strategic Cross-Department Decision Making');
      
      // Sequence of requests that require cross-departmental thinking
      const strategicRequests = [
        {
          prompt: "Our customer acquisition costs are too high. What's our strategy to improve this?",
          expectedDepartments: ['marketing_manager_orchestrator', 'metrics', 'chat_support'],
          description: "Customer acquisition optimization"
        },
        {
          prompt: "We need to improve employee productivity and satisfaction while reducing operational costs.",
          expectedDepartments: ['hr_assistant', 'calendar', 'sop', 'notion'],
          description: "Employee productivity optimization"
        },
        {
          prompt: "Plan a new product feature that requires market research, technical development, and go-to-market strategy.",
          expectedDepartments: ['marketing_manager_orchestrator', 'requirements_writer', 'product_launch_coordinator'],
          description: "New product feature coordination"
        }
      ];

      for (let i = 0; i < strategicRequests.length; i++) {
        const request = strategicRequests[i];
        if (!request) continue;
        
        console.log(`\\n📋 Strategic Request ${i + 1}: ${request.description}`);
        
        const result = await ceoOrchestrator.executeTask('executeTask', {
          prompt: request.prompt,
          userId: `test-ceo-strategic-${i}`,
          conversationId: `test-conv-ceo-strategic-${i}`,
          conversationHistory: []
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        
        // CEO should make intelligent strategic decisions
        if (result.action === 'CLARIFY') {
          console.log(`🔄 Strategic clarification triggered`);
          expect(result.requiresUserChoice).toBe(true);
        } else {
          console.log(`✅ Strategic delegation to: ${result.agentName}`);
          expect(result.agentName).toBeDefined();
          
          // Validate strategic thinking - should choose appropriate department
          const delegatedCorrectly = request.expectedDepartments.some(dept => 
            result.agentName?.includes(dept) || dept.includes(result.agentName || '')
          );
          expect(delegatedCorrectly).toBe(true);
        }
      }
      
      console.log('\\n🎉 Strategic cross-department decision making validated!');
      
    }, 240000); // 4 minute timeout for multiple strategic decisions

  });

  describe('Executive Leadership Intelligence', () => {
    /**
     * Test: CEO-level strategic conversations
     */
    it('should handle executive-level strategic conversations directly', async () => {
      console.log('\\n🏛️ Testing Executive Strategic Conversations');
      
      const executiveRequests = [
        {
          prompt: "What's our current competitive position and how should we respond to new market entrants?",
          description: "Competitive strategy discussion"
        },
        {
          prompt: "How should we prioritize our Q2 initiatives given limited resources?",
          description: "Resource allocation strategy"
        },
        {
          prompt: "What are the key risks facing our business and how do we mitigate them?",
          description: "Risk management strategy"
        }
      ];

      for (let i = 0; i < executiveRequests.length; i++) {
        const request = executiveRequests[i];
        if (!request) continue;
        
        console.log(`\\n📋 Executive Request ${i + 1}: ${request.description}`);
        
        const result = await ceoOrchestrator.executeTask('executeTask', {
          prompt: request.prompt,
          userId: `test-ceo-executive-${i}`,
          conversationId: `test-conv-ceo-executive-${i}`,
          conversationHistory: []
        });

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.response).toBeDefined();
        
        console.log(`✅ Executive response: ${result.response?.substring(0, 100)}...`);
        
        // CEO should either provide strategic guidance directly or delegate appropriately
        if (result.agentName) {
          console.log(`📊 Delegated to: ${result.agentName}`);
        } else {
          console.log(`🎯 Direct executive guidance provided`);
        }
      }
      
      console.log('\\n🎉 Executive leadership intelligence validated!');
      
    }, 180000);

    /**
     * Test: Crisis management and escalation handling
     */
    it('should demonstrate crisis management and escalation intelligence', async () => {
      console.log('\\n🚨 Testing Crisis Management Intelligence');
      
      const crisisRequest = {
        prompt: "We've discovered a critical security vulnerability in our product that affects all customers. We need immediate response coordination across engineering, customer support, legal, and communications.",
        userId: "test-ceo-crisis",
        conversationId: "test-conv-ceo-crisis",
        conversationHistory: []
      };

      const result = await ceoOrchestrator.executeTask('executeTask', crisisRequest);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      
      console.log(`✅ Crisis response: ${result.response?.substring(0, 200)}...`);
      
      // For crisis management, CEO should either:
      // 1. Take direct control and provide strategic guidance
      // 2. Coordinate through appropriate department heads
      // 3. Create a crisis management project
      
      if (result.agentName) {
        console.log(`📊 Crisis delegated to: ${result.agentName}`);
        // Should delegate to appropriate crisis response agents
        expect(['requirements_writer', 'chat_support', 'marketing_manager_orchestrator']).toContain(result.agentName);
      } else {
        console.log(`🎯 Direct CEO crisis management`);
        // Direct crisis management response should be substantial
        expect(result.response?.length).toBeGreaterThan(100);
      }
      
      console.log('\\n🎉 Crisis management intelligence validated!');
      
    }, 120000);

  });
});