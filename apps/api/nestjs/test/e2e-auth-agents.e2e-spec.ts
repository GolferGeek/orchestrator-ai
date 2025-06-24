require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authenticated Agent End-to-End Tests', () => {
  let app: INestApplication;
  let authToken: string;
  const testUser = {
    email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
    password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
  };

  // Helper function to refresh token if needed
  const ensureValidToken = async () => {
    try {
      // Test if current token is still valid
      const testResponse = await request(app.getHttpServer())
        .get('/agent-pool/agents')
        .set('Authorization', `Bearer ${authToken}`);

      if (testResponse.status === 401) {
        console.log('Token expired, refreshing...');
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send(testUser)
          .expect(200);

        authToken = loginResponse.body.access_token;
        console.log('Token refreshed successfully');
      }
    } catch (error: any) {
      console.log('Error checking token, refreshing...', error.message);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(testUser)
        .expect(200);

      authToken = loginResponse.body.access_token;
      console.log('Token refreshed after error');
    }
  };

  // Available specialist agents to test
  const specialistAgents = [
    'blog_post',
    'hr_assistant',
    'marketing_swarm',
    'requirements_writer',
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    console.log('Waiting for server startup and agent discovery...');

    // Wait for agents to be discovered and auto-registered (like in production)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('Logging in test user...');

    // Authenticate as test user (same as frontend)
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.access_token;
    expect(authToken).toBeDefined();
    console.log('Authentication successful, token obtained');
  }, 60000); // 60 second timeout for module setup and agent loading

  afterAll(async () => {
    await app.close();
  });

  describe('Orchestrator Delegation Tests (E2E)', () => {
    const orchestratorTestCases = [
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

        const response = await request(app.getHttpServer())
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

        console.log(
          `✅ E2E Orchestrator delegation test for ${testCase.agentName} passed - Response: ${response.body.result.response.substring(0, 100)}...`,
        );
      }, 45000); // 45 second timeout for orchestrator + AI processing
    });
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

        const response = await request(app.getHttpServer())
          .post('/agents/orchestrator/orchestrator/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskRequest)
          .expect(200);

        // Validate response structure
        expect(response.body).toBeDefined();

        // DEBUG: Check response structure for conversational tests
        console.log('\n🔍 DEBUGGING CONVERSATIONAL RESPONSE STRUCTURE');
        console.log(
          'Full response.body:',
          JSON.stringify(response.body, null, 2),
        );
        console.log('response.body.success:', response.body.success);
        console.log('response.body.result:', response.body.result);
        console.log(
          'response.body.result?.success:',
          response.body.result?.success,
        );

        // All conversational agents use JSON-RPC format (result field)
        expect(response.body.result.success).toBe(true);
        expect(response.body.result.response).toBeDefined();
        expect(typeof response.body.result.response).toBe('string');
        expect(response.body.result.response.length).toBeGreaterThan(0);

        console.log(
          `✅ Conversational ${prompt} test passed - Response: ${response.body.result.response.substring(0, 100)}...`,
        );
      }, 30000); // 30 second timeout for conversational AI processing
    });
  });

  describe('Agent Discovery Validation', () => {
    it('should have all expected agents discovered and running', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      expect(response.body.status).toBe('running');
      expect(response.body.discoveredAgents).toBeGreaterThanOrEqual(5); // 4 specialists + orchestrator

      const agentNames = response.body.agents.map((agent: any) => agent.name);

      // Verify orchestrator exists
      expect(agentNames).toContain('orchestrator');

      // Verify all specialist agents exist
      specialistAgents.forEach((agentName) => {
        expect(agentNames).toContain(agentName);
      });

      console.log('✅ All expected agents discovered:', agentNames);
    });

    it('should have agents accessible via agent pool', async () => {
      const response = await request(app.getHttpServer())
        .get('/agent-pool/agents')
        .expect(200);

      // DEBUG: Log agent pool response
      console.log('\n🔍 DEBUGGING AGENT POOL RESPONSE:');
      console.log('response.body:', JSON.stringify(response.body, null, 2));
      console.log(
        'Array.isArray(response.body):',
        Array.isArray(response.body),
      );
      console.log('response.body.length:', response.body.length);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(5);

      const poolAgentNames = response.body.map((agent: any) => agent.name);

      // Verify orchestrator and specialists are in the pool
      // Note: Agent pool returns lowercase names
      expect(poolAgentNames).toContain('orchestrator');
      const expectedPoolNames = [
        'blog_post',
        'hr_assistant',
        'marketing_swarm',
        'requirements_writer',
      ];
      expectedPoolNames.forEach((agentName) => {
        expect(poolAgentNames).toContain(agentName);
      });

      console.log(
        '✅ Agent pool contains all expected agents:',
        poolAgentNames,
      );
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

      console.log('✅ Properly rejected unauthenticated request');
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

      console.log('✅ Properly rejected request with invalid token');
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

      console.log('✅ Properly handled non-existent agent request');
    });
  });
});
