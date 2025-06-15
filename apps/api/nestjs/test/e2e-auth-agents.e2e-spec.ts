require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authenticated Agent End-to-End Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let testUser = {
    email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
    password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!'
  };

  // Available specialist agents to test
  const specialistAgents = [
    'blog_post',
    'hr_assistant', 
    'marketing_swarm',
    'requirements_writer'
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered
    console.log('Waiting for agent discovery...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Login once and get auth token for all tests
    console.log('Logging in test user...');
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser)
      .expect(200);

    authToken = loginResponse.body.access_token;
    expect(authToken).toBeDefined();
    console.log('Authentication successful, token obtained');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Direct Agent Tests', () => {
    specialistAgents.forEach(agentName => {
      it(`should call ${agentName} agent directly`, async () => {
        const taskRequest = {
          method: 'processTask',
          params: {
            userMessage: `Test direct call to ${agentName}`,
            sessionId: `test-session-${Date.now()}`
          }
        };

        const response = await request(app.getHttpServer())
          .post(`/agents/specialists/${agentName}/tasks`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskRequest)
          .expect(200);

        // Validate response structure
        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.response).toBeDefined();
        expect(typeof response.body.response).toBe('string');
        expect(response.body.response.length).toBeGreaterThan(0);
        
        console.log(`✅ Direct ${agentName} test passed - Response: ${response.body.response.substring(0, 100)}...`);
      });
    });
  });

  describe('Orchestrator Delegation Tests', () => {
    const orchestratorTestCases = [
      {
        agentName: 'blog_post',
        prompt: 'Write a blog post about artificial intelligence',
        expectedKeywords: ['blog', 'post', 'artificial', 'intelligence']
      },
      {
        agentName: 'hr_assistant', 
        prompt: 'Help me with HR policies and employee onboarding',
        expectedKeywords: ['HR', 'policies', 'employee', 'onboarding']
      },
      {
        agentName: 'marketing_swarm',
        prompt: 'Create a marketing campaign for our new product',
        expectedKeywords: ['marketing', 'campaign', 'product']
      },
      {
        agentName: 'requirements_writer',
        prompt: 'Write technical requirements for a web application',
        expectedKeywords: ['requirements', 'technical', 'web', 'application']
      }
    ];

    orchestratorTestCases.forEach(testCase => {
      it(`should delegate to ${testCase.agentName} through orchestrator`, async () => {
        const taskRequest = {
          method: 'processTask',
          params: {
            userMessage: testCase.prompt,
            sessionId: `test-orchestrator-session-${Date.now()}`
          }
        };

        const response = await request(app.getHttpServer())
          .post('/agents/orchestrator/orchestrator/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskRequest)
          .expect(200);

        // Validate response structure
        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.response).toBeDefined();
        expect(typeof response.body.response).toBe('string');
        expect(response.body.response.length).toBeGreaterThan(0);

        // Check if delegation occurred (response should contain content relevant to the specialist)
        const responseText = response.body.response.toLowerCase();
        const hasRelevantContent = testCase.expectedKeywords.some(keyword => 
          responseText.includes(keyword.toLowerCase())
        );
        
        expect(hasRelevantContent).toBe(true);
        
        console.log(`✅ Orchestrator → ${testCase.agentName} delegation test passed`);
        console.log(`   Response preview: ${response.body.response.substring(0, 150)}...`);
      });
    });
  });

  describe('Orchestrator Direct Responses', () => {
    const conversationalTests = [
      'Hello, how are you?',
      'What agents do you have available?',
      'Tell me about yourself'
    ];

    conversationalTests.forEach(prompt => {
      it(`should handle "${prompt}" conversationally`, async () => {
        const taskRequest = {
          method: 'processTask',
          params: {
            userMessage: prompt,
            sessionId: `test-conversation-${Date.now()}`
          }
        };

        const response = await request(app.getHttpServer())
          .post('/agents/orchestrator/orchestrator/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send(taskRequest)
          .expect(200);

        // Validate response structure
        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.response).toBeDefined();
        expect(typeof response.body.response).toBe('string');
        expect(response.body.response.length).toBeGreaterThan(0);

        // Should be a direct orchestrator response, not delegation
        expect(response.body.metadata?.agentType).toBe('orchestrator');
        
        console.log(`✅ Conversational test "${prompt}" passed`);
        console.log(`   Response: ${response.body.response.substring(0, 100)}...`);
      });
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
      specialistAgents.forEach(agentName => {
        expect(agentNames).toContain(agentName);
      });

      console.log('✅ All expected agents discovered:', agentNames);
    });

    it('should have agents accessible via agent pool', async () => {
      const response = await request(app.getHttpServer())
        .get('/agent-pool/agents')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(5);

      const poolAgentNames = response.body.map((agent: any) => agent.name);
      
      // Verify orchestrator and specialists are in the pool
      expect(poolAgentNames).toContain('orchestrator');
      specialistAgents.forEach(agentName => {
        expect(poolAgentNames).toContain(agentName);
      });

      console.log('✅ Agent pool contains all expected agents:', poolAgentNames);
    });
  });

  describe('Authentication Validation', () => {
    it('should reject requests without authentication token', async () => {
      const taskRequest = {
        method: 'processTask',
        params: {
          userMessage: 'This should fail without auth',
          sessionId: 'test-unauth-session'
        }
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
          sessionId: 'test-badauth-session'
        }
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
          sessionId: 'test-error-session'
        }
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