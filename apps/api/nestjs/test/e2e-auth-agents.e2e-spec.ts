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

    console.log('Waiting for agent discovery...');
    
    // Wait for agents to be discovered and loaded
    await new Promise(resolve => setTimeout(resolve, 3000));

    // MANUAL AGENT POOL REGISTRATION FOR TESTING
    // Since HTTP-based registration fails in test environment, 
    // manually register agents with the pool
    const { AgentPoolService } = await import('../src/agent-pool/agent-pool.service');
    const { AgentDiscoveryService } = await import('../src/agent-discovery.service');
    const agentPoolService = app.get(AgentPoolService);
    const agentDiscoveryService = app.get(AgentDiscoveryService);
    
    // Get discovered agents and register them manually
    const discoveredAgents = agentDiscoveryService.getDiscoveredAgents();
    console.log('🔧 DEBUG: Discovered agents for manual registration:', discoveredAgents.map((a: any) => a.path));
    
    for (const agent of discoveredAgents) {
      // Map agent types to valid registration types
      const typeMapping: Record<string, 'orchestrator' | 'specialist' | 'manager' | 'external'> = {
        'orchestrator': 'orchestrator',
        'specialists': 'specialist',
        'managers': 'manager',
        'external': 'external'
      };
      
      // Create registration object
      const registration = {
        id: `${agent.type}_${agent.name.toLowerCase()}`,
        name: agent.name.charAt(0).toUpperCase() + agent.name.slice(1),
        type: typeMapping[agent.type] || 'specialist',
        path: agent.path,
        url: `http://localhost:3000/agents/${agent.path}/tasks`,
        description: `${agent.name} - A specialized agent for handling specific tasks`,
        capabilities: ['processTask', 'generateResponse'],
        skills: [] as any[], // Empty array of AgentSkill
        inputModes: ['text', 'json'],
        outputModes: ['text', 'json'],
        status: 'online' as const,
        metadata: {}
      };
      
      console.log(`🔧 DEBUG: Manually registering agent: ${registration.id}`);
      await agentPoolService.registerAgent(registration);
    }
    
    // Verify registration worked
    const registeredAgents = agentPoolService.getRegisteredAgents();
    console.log(`🔧 DEBUG: Successfully registered ${registeredAgents.length} agents manually`);

    console.log('Logging in test user...');
    
    // Authenticate as test user
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!'
      })
      .expect(200);

    authToken = loginResponse.body.access_token;
    expect(authToken).toBeDefined();
    console.log('Authentication successful, token obtained');
  }, 60000); // 60 second timeout for module setup and agent loading

  afterAll(async () => {
    await app.close();
  });

  describe('Direct Agent Tests', () => {
    specialistAgents.forEach(agentName => {
      it(`should call ${agentName} agent directly`, async () => {
        const taskRequest = {
          jsonrpc: '2.0',
          id: `test-${agentName}-${Date.now()}`,
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
        
        // DEBUG: Log actual response structure for investigation
        if (agentName === 'blog_post') {
          console.log('\n🔍 DEBUGGING RESPONSE STRUCTURE FOR', agentName);
          console.log('Full response.body:', JSON.stringify(response.body, null, 2));
          console.log('typeof response.body:', typeof response.body);
          console.log('response.body.success:', response.body.success);
          console.log('response.body.result:', response.body.result);
          console.log('response.body.result?.success:', response.body.result?.success);
          console.log('response.body.result?.response:', response.body.result?.response);
        }
        
        // Different response formats for different agent types
        if (agentName === 'blog_post') {
          // blog_post uses ContextAgentBaseService - direct response format
          expect(response.body.success).toBe(true);
          expect(response.body.response).toBeDefined();
          expect(typeof response.body.response).toBe('string');
          expect(response.body.response.length).toBeGreaterThan(0);
          console.log(`✅ Direct ${agentName} test passed - Response: ${response.body.response.substring(0, 100)}...`);
        } else {
          // Other agents use FunctionAgentBaseService + A2A - JSON-RPC format with result field
          expect(response.body.result.success).toBe(true);
          expect(response.body.result.response).toBeDefined();
          expect(typeof response.body.result.response).toBe('string');
          expect(response.body.result.response.length).toBeGreaterThan(0);
          console.log(`✅ Direct ${agentName} test passed - Response: ${response.body.result.response.substring(0, 100)}...`);
        }
      }, 30000); // 30 second timeout for AI processing
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
          jsonrpc: '2.0',
          id: `test-orchestrator-${testCase.agentName}-${Date.now()}`,
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
        
        // DEBUG: Check if orchestrator delegation worked
        if (testCase.agentName === 'orchestrator') {
          console.log('\n🔍 DEBUGGING ORCHESTRATOR DELEGATION RESPONSE');
          console.log('Full response.body:', JSON.stringify(response.body, null, 2));
          console.log('response.body.success:', response.body.success);
          console.log('response.body.result:', response.body.result);
          console.log('response.body.result?.success:', response.body.result?.success);
        }
        
        // Orchestrator uses JSON-RPC format (result field)
        expect(response.body.result.success).toBe(true);
        expect(response.body.result.response).toBeDefined();
        expect(typeof response.body.result.response).toBe('string');
        expect(response.body.result.response.length).toBeGreaterThan(0);
        
        // Check if delegation occurred (response should contain content relevant to the specialist)
        const responseText = response.body.result.response.toLowerCase();
        const hasRelevantContent = testCase.expectedKeywords.some(keyword => 
          responseText.includes(keyword.toLowerCase())
        );
        
        expect(hasRelevantContent).toBe(true);
        
        console.log(`✅ Orchestrator delegation test for ${testCase.agentName} passed - Response: ${response.body.result.response.substring(0, 100)}...`);
      }, 30000); // 30 second timeout for orchestrator + AI processing
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
          jsonrpc: '2.0',
          id: `test-conversation-${Date.now()}`,
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
        
        // DEBUG: Check response structure for conversational tests
        console.log('\n🔍 DEBUGGING CONVERSATIONAL RESPONSE STRUCTURE');
        console.log('Full response.body:', JSON.stringify(response.body, null, 2));
        console.log('response.body.success:', response.body.success);
        console.log('response.body.result:', response.body.result);
        console.log('response.body.result?.success:', response.body.result?.success);
        
        // All conversational agents use JSON-RPC format (result field)
        expect(response.body.result.success).toBe(true);
        expect(response.body.result.response).toBeDefined();
        expect(typeof response.body.result.response).toBe('string');
        expect(response.body.result.response.length).toBeGreaterThan(0);
        
        console.log(`✅ Conversational ${prompt} test passed - Response: ${response.body.result.response.substring(0, 100)}...`);
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
      specialistAgents.forEach(agentName => {
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
      console.log('Array.isArray(response.body):', Array.isArray(response.body));
      console.log('response.body.length:', response.body.length);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(5);

      const poolAgentNames = response.body.map((agent: any) => agent.name);
      
      // Verify orchestrator and specialists are in the pool
      // Note: Agent pool returns capitalized names
      expect(poolAgentNames).toContain('Orchestrator');
      const expectedPoolNames = ['Blog_post', 'Hr_assistant', 'Marketing_swarm', 'Requirements_writer'];
      expectedPoolNames.forEach(agentName => {
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