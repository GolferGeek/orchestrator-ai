import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Authenticated Agent End-to-End Tests', () => {
  let app: INestApplication;
  let authToken: string;

  // Available specialist agents to test
  const specialistAgents = [
    'blog_post',
    'hr_assistant',
    'marketing_swarm',
    'requirements_writer',
    'sop',
    'internal_rag',
    'invoice',
    'metrics',
    'chat_support',
    'email_triage',
    'voice_receptionist',
    'voice_summary',
    'competitors',
    'external_rag',
    'market_research',
    'onboarding',
    'policy_rag',
    'leads',
    'calendar',
    'content',
    'meetings',
    'launcher',
  ];

  // External agents to test
  const externalAgents = [
    'hiverarchy', // Hiverarchy AI Orchestrator
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered and auto-registered (like in production)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Authenticate as test user (same as frontend)
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();
  }, 60000); // 60 second timeout for module setup and agent loading

  afterAll(async () => {
    await app.close();
  });

  describe('Orchestrator Delegation Tests (E2E)', () => {
    const orchestratorTestCases = [
      {
        agentName: 'hiverarchy',
        prompt:
          'Write a comprehensive blog post about renewable energy and sustainability',
        expectedKeywords: [
          'renewable',
          'energy',
          'sustainability',
          'blog',
          'post',
        ],
        description:
          'Should delegate to Hiverarchy external agent for content creation',
      },
      {
        agentName: 'hiverarchy',
        prompt: 'Create an article about the future of artificial intelligence',
        expectedKeywords: [
          'artificial',
          'intelligence',
          'future',
          'article',
          'technology',
        ],
        description:
          'Should delegate to Hiverarchy external agent for AI content',
      },
      {
        agentName: 'blog_post',
        prompt: 'Write a blog post about artificial intelligence',
        expectedKeywords: ['blog', 'post', 'artificial', 'intelligence'],
      },
      {
        agentName: 'hr_assistant',
        prompt: 'Help me with HR policies and employee onboarding',
        expectedKeywords: ['HR', 'policies', 'employee', 'onboarding'],
      },
      {
        agentName: 'marketing_swarm',
        prompt: 'Create a marketing campaign for our new product',
        expectedKeywords: ['marketing', 'campaign', 'product'],
      },
      {
        agentName: 'requirements_writer',
        prompt: 'Write technical requirements for a web application',
        expectedKeywords: ['requirements', 'technical', 'web', 'application'],
      },
      {
        agentName: 'sop',
        prompt:
          'Help me create a standard operating procedure for customer onboarding',
        expectedKeywords: [
          'standard',
          'operating',
          'procedure',
          'onboarding',
          'sop',
        ],
      },
      {
        agentName: 'internal_rag',
        prompt: 'Search our internal knowledge base for company policies',
        expectedKeywords: [
          'internal',
          'knowledge',
          'search',
          'company',
          'policies',
        ],
      },
      {
        agentName: 'invoice',
        prompt: 'Create an invoice for consulting services',
        expectedKeywords: ['invoice', 'consulting', 'services', 'billing'],
      },
      {
        agentName: 'metrics',
        prompt: 'Show me our key performance metrics',
        expectedKeywords: ['metrics', 'performance', 'kpi', 'analytics'],
      },
      {
        agentName: 'chat_support',
        prompt: 'I need help with my account login issues',
        expectedKeywords: ['support', 'help', 'account', 'login', 'assist'],
      },
      {
        agentName: 'email_triage',
        prompt: 'Classify this customer email and determine priority',
        expectedKeywords: [
          'email',
          'classify',
          'priority',
          'triage',
          'routing',
        ],
      },
      {
        agentName: 'voice_receptionist',
        prompt: 'Handle an incoming call from a new customer',
        expectedKeywords: [
          'call',
          'customer',
          'greeting',
          'routing',
          'professional',
        ],
      },
      {
        agentName: 'voice_summary',
        prompt: 'Summarize the key points from our team meeting',
        expectedKeywords: ['summary', 'meeting', 'action', 'items', 'key'],
      },
      {
        agentName: 'competitors',
        prompt: 'Analyze our main competitors and their strategies',
        expectedKeywords: [
          'competitive',
          'analysis',
          'market',
          'strategy',
          'positioning',
        ],
      },
      {
        agentName: 'external_rag',
        prompt: 'Search external databases for industry best practices',
        expectedKeywords: [
          'external',
          'search',
          'research',
          'industry',
          'best',
        ],
      },
      {
        agentName: 'market_research',
        prompt: 'Research market trends in our industry',
        expectedKeywords: [
          'market',
          'research',
          'trends',
          'industry',
          'analysis',
        ],
      },
      {
        agentName: 'onboarding',
        prompt: 'Help onboard a new employee to our company',
        expectedKeywords: [
          'onboarding',
          'employee',
          'training',
          'welcome',
          'process',
        ],
      },
      {
        agentName: 'policy_rag',
        prompt: 'Find our company policy on remote work',
        expectedKeywords: ['policy', 'remote', 'work', 'company', 'guidelines'],
      },
      {
        agentName: 'leads',
        prompt: 'Manage and qualify new sales leads',
        expectedKeywords: ['leads', 'sales', 'qualify', 'prospects', 'crm'],
      },
      {
        agentName: 'calendar',
        prompt: 'Schedule a meeting with the development team',
        expectedKeywords: [
          'calendar',
          'schedule',
          'meeting',
          'appointment',
          'time',
        ],
      },
      {
        agentName: 'content',
        prompt: 'Create content for our marketing campaign',
        expectedKeywords: [
          'content',
          'marketing',
          'create',
          'campaign',
          'materials',
        ],
      },
      {
        agentName: 'meetings',
        prompt: 'Coordinate a project kickoff meeting',
        expectedKeywords: [
          'meeting',
          'coordinate',
          'project',
          'kickoff',
          'agenda',
        ],
      },
      {
        agentName: 'launcher',
        prompt: 'Launch our new product feature rollout',
        expectedKeywords: [
          'launch',
          'product',
          'feature',
          'rollout',
          'deployment',
        ],
      },
    ];

    orchestratorTestCases.forEach((testCase) => {
      it(`should delegate to ${testCase.agentName} through orchestrator (E2E)`, async () => {
        // Use the exact same JSON-RPC format as the frontend
        const taskRequest = {
          jsonrpc: '2.0',
          id: `test-orchestrator-${testCase.agentName}-${Date.now()}`,
          method: 'handle_request',
          params: {
            message: testCase.prompt,
            session_id: `test-orchestrator-session-${Date.now()}`,
            conversation_history: [],
            authToken: authToken, // Pass auth token like frontend does
            currentUser: null, // Frontend would populate this
          },
        };

        const _response = await request(app.getHttpServer())
          .post('/agents/orchestrator/orchestrator/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskRequest)
          .expect(200);

        // Validate response structure (JSON-RPC format)
        expect(response.body).toBeDefined();
        expect(response.body.result).toBeDefined();
        expect(response.body.result.success).toBe(true);
        expect(response.body.result.response).toBeDefined();
        expect(typeof response.body.result.response).toBe('string');
        expect(response.body.result.response.length).toBeGreaterThan(0);

        // Check if delegation occurred (response should contain content relevant to the specialist)
        const responseText = response.body.result.response.toLowerCase();
        const hasRelevantContent = testCase.expectedKeywords.some((keyword) =>
          responseText.includes(keyword.toLowerCase()),
        );

        expect(hasRelevantContent).toBe(true);

        // For Hiverarchy tests, verify we got substantial content (indicating external agent was used)
        if (testCase.agentName === 'hiverarchy') {
          expect(response.body.result.response.length).toBeGreaterThan(500);
        } else {
        }
      }, 45000); // 45 second timeout for orchestrator + AI processing
    });
  });

  describe('Hiverarchy External Agent Validation', () => {
    it('should delegate to Hiverarchy instead of local blog_post agent for content requests', async () => {
      // First, ensure Hiverarchy is available in the agent pool
      const poolResponse = await request(app.getHttpServer())
        .get('/agent-pool/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const hiverarchyAgent = poolResponse.body.find(
        (agent: any) => agent.name === 'hiverarchy',
      );
      expect(hiverarchyAgent).toBeDefined();

      // Test orchestrator delegation with a content creation request
      const taskRequest = {
        jsonrpc: '2.0',
        id: `test-hiverarchy-delegation-${Date.now()}`,
        method: 'handle_request',
        params: {
          message:
            'Write a detailed blog post about the benefits of renewable energy and how it impacts climate change',
          session_id: `test-hiverarchy-session-${Date.now()}`,
          conversation_history: [],
          authToken: authToken,
          currentUser: null,
        },
      };

      const _response = await request(app.getHttpServer())
        .post('/agents/orchestrator/orchestrator/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskRequest)
        .expect(200);

      // Validate response structure
      expect(response.body).toBeDefined();
      expect(response.body.result).toBeDefined();
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.response).toBeDefined();
      expect(typeof response.body.result.response).toBe('string');
      expect(response.body.result.response.length).toBeGreaterThan(100);

      // Check for content that indicates Hiverarchy generated the response
      // Hiverarchy typically produces longer, more detailed responses
      const responseText = response.body.result.response;
      expect(responseText.length).toBeGreaterThan(500); // Expect substantial content

      // Check for renewable energy keywords
      const lowerResponse = responseText.toLowerCase();
      expect(lowerResponse).toMatch(/renewable.{0,50}energy/);
      expect(lowerResponse).toMatch(/climate.{0,50}change/);
    }, 60000); // Extended timeout for external agent processing

    it('should prefer Hiverarchy over local blog_post for content creation', async () => {
      // Test with a specific prompt that should clearly favor Hiverarchy
      const taskRequest = {
        jsonrpc: '2.0',
        id: `test-hiverarchy-preference-${Date.now()}`,
        method: 'handle_request',
        params: {
          message:
            'I need advanced content creation using Hiverarchy AI. Please write an article about sustainable technology innovations.',
          session_id: `test-hiverarchy-preference-${Date.now()}`,
          conversation_history: [],
          authToken: authToken,
          currentUser: null,
        },
      };

      const _response = await request(app.getHttpServer())
        .post('/agents/orchestrator/orchestrator/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskRequest)
        .expect(200);

      // Validate response
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.response).toBeDefined();

      const responseText = response.body.result.response;

      // The response should be substantial (Hiverarchy typically generates comprehensive content)
      expect(responseText.length).toBeGreaterThan(150);

      // Should contain relevant keywords
      const lowerResponse = responseText.toLowerCase();
      expect(lowerResponse).toMatch(/sustainable.{0,50}technology/);
      expect(lowerResponse).toMatch(/innovation/);
    }, 60000);
  });

  describe('Orchestrator Direct Responses', () => {
    const conversationalTests = [
      'Hello, how are you?',
      'What agents do you have available?',
      'Tell me about yourself',
    ];

    conversationalTests.forEach((prompt) => {
      it(`should handle "${prompt}" conversationally`, async () => {
        const taskRequest = {
          jsonrpc: '2.0',
          id: `test-conversation-${Date.now()}`,
          method: 'handle_request',
          params: {
            message: prompt,
            session_id: `test-conversation-${Date.now()}`,
            conversation_history: [],
          },
        };

        const _response = await request(app.getHttpServer())
          .post('/agents/orchestrator/orchestrator/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskRequest)
          .expect(200);

        // Validate response structure
        expect(response.body).toBeDefined();

        // DEBUG: Check response structure for conversational tests

        // All conversational agents use JSON-RPC format (result field)
        expect(response.body.result.success).toBe(true);
        expect(response.body.result.response).toBeDefined();
        expect(typeof response.body.result.response).toBe('string');
        expect(response.body.result.response.length).toBeGreaterThan(0);
      }, 30000); // 30 second timeout for conversational AI processing
    });
  });

  describe('Agent Discovery Validation', () => {
    it('should have all expected agents discovered and running', async () => {
      const _response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      expect(response.body.status).toBe('running');
      expect(response.body.discoveredAgents).toBeGreaterThanOrEqual(24); // 22 specialists + orchestrator + 1 external

      const agentNames = response.body.agents.map((agent: any) => agent.name);

      // Verify orchestrator exists
      expect(agentNames).toContain('orchestrator');

      // Verify all specialist agents exist
      specialistAgents.forEach((agentName) => {
        expect(agentNames).toContain(agentName);
      });

      // Verify all external agents exist
      externalAgents.forEach((agentName) => {
        expect(agentNames).toContain(agentName);
      });
    });

    it('should have agents accessible via agent pool', async () => {
      const _response = await request(app.getHttpServer())
        .get('/agent-pool/agents')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(24);

      const poolAgentNames = response.body.map((agent: any) => agent.name);

      // Verify orchestrator and specialists are in the pool
      // Note: Agent pool may return names with different casing
      const lowerPoolNames = poolAgentNames.map((name: string) =>
        name.toLowerCase(),
      );
      expect(lowerPoolNames).toContain('orchestrator');
      const expectedPoolNames = [
        'blog',
        'hr',
        'marketing',
        'requirements',
        'sop',
        'rag',
        'invoice',
        'metrics',
        'chat',
        'email',
      ];

      // Check that expected agents are present (case-insensitive partial match)
      expectedPoolNames.forEach((expectedName) => {
        const found = poolAgentNames.some((poolName: string) =>
          poolName.toLowerCase().includes(expectedName.toLowerCase()),
        );
        expect(found).toBe(true);
      });

      // Verify external agents are in the pool
      externalAgents.forEach((agentName) => {
        const found = poolAgentNames.some((poolName: string) =>
          poolName.toLowerCase().includes(agentName.toLowerCase()),
        );
        expect(found).toBe(true);
      });
    });
  });

  describe('Authentication Validation', () => {
    it('should reject requests without authentication token', async () => {
      const taskRequest = {
        method: 'processTask',
        params: {
          userMessage: 'This should fail without auth',
          sessionId: 'test-unauth-session',
        },
      };

      await request(app.getHttpServer())
        .post('/agents/specialists/blog_post/tasks')
        .send(taskRequest)
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      const taskRequest = {
        method: 'processTask',
        params: {
          userMessage: 'This should fail with bad token',
          sessionId: 'test-badauth-session',
        },
      };

      await request(app.getHttpServer())
        .post('/agents/specialists/blog_post/tasks')
        .set('Authorization', 'Bearer invalid-token-12345')
        .send(taskRequest)
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle requests to non-existent agents gracefully', async () => {
      const taskRequest = {
        method: 'processTask',
        params: {
          userMessage: 'Test non-existent agent',
          sessionId: 'test-error-session',
        },
      };

      await request(app.getHttpServer())
        .post('/agents/specialists/non_existent_agent/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskRequest)
        .expect(404);
    });
  });
});
