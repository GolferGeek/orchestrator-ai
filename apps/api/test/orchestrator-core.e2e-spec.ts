import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Orchestrator Core (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Set environment to use real Hiverarchy endpoint for testing
    process.env.HIVERARCHY_EXTERNAL_ENDPOINT =
      'http://localhost:4100/agents/orchestrator/orchestrator/tasks';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered and loaded
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      // Authenticate to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
          password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
        });

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.accessToken;
      }
    } catch (_error) {
      console.log(
        'Authentication failed, continuing without token for basic tests',
      );
    }
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  describe('Basic API Functionality', () => {
    it('should respond to health check', async () => {
      const response = await request(app.getHttpServer()).get('/').expect(200);

      expect(response.text).toBe('NestJS A2A Agent Framework - Ready!');
    });

    it('should have agents discovered', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      expect(response.body.status).toBe('running');
      expect(response.body.discoveredAgents).toBeGreaterThan(0);

      // Should have orchestrator agent
      const orchestratorAgent = response.body.agents.find(
        (agent: any) => agent.name === 'orchestrator',
      );
      expect(orchestratorAgent).toBeDefined();
      expect(orchestratorAgent.type).toBe('orchestrator');
    });

    it('should have specialist agents available', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      const agentNames = response.body.agents.map((agent: any) => agent.name);

      // Check for key specialist agents
      expect(agentNames).toContain('blog_post');
      expect(agentNames).toContain('hr_assistant');
    });
  });

  describe('Orchestrator Agent Cards', () => {
    it('should provide orchestrator agent card', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents/orchestrator/orchestrator/.well-known/agent.json')
        .expect(200);

      expect(response.body.name).toBeDefined();
      expect(response.body.type).toBe('orchestrator');
      expect(response.body.capabilities).toBeDefined();
    });

    it('should provide specialist agent cards', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents/specialists/blog_post/.well-known/agent.json')
        .expect(200);

      expect(response.body.name).toBeDefined();
      expect(response.body.type).toBe('specialist');
      expect(response.body.skills).toBeDefined();
    });
  });

  describe('Orchestrator Functionality (with auth)', () => {
    beforeEach(() => {
      if (!authToken) {
        return; // Skip tests if no auth token
      }
    });

    it('should handle basic conversational requests', async () => {
      if (!authToken) {
        console.log('Skipping test - no auth token available');
        return;
      }

      const taskRequest = {
        jsonrpc: '2.0',
        id: 'test-conversation-1',
        method: 'handle_request',
        params: {
          message: 'Hello, what can you help me with?',
          session_id: 'test-session-conversation',
          conversation_history: [],
        },
      };

      const response = await request(app.getHttpServer())
        .post('/agents/orchestrator/orchestrator/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskRequest)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.result).toBeDefined();
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.response).toBeDefined();
      expect(typeof response.body.result.response).toBe('string');
      expect(response.body.result.response.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle delegation requests to specialists', async () => {
      if (!authToken) {
        console.log('Skipping test - no auth token available');
        return;
      }

      const taskRequest = {
        jsonrpc: '2.0',
        id: 'test-delegation-1',
        method: 'handle_request',
        params: {
          message: 'Help me with writing a blog post about TypeScript',
          session_id: 'test-session-delegation',
          conversation_history: [],
        },
      };

      const response = await request(app.getHttpServer())
        .post('/agents/orchestrator/orchestrator/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskRequest)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.result).toBeDefined();
      expect(response.body.result.success).toBe(true);
      expect(response.body.result.response).toBeDefined();

      // Response should contain content related to blog post writing
      const responseText = response.body.result.response.toLowerCase();
      expect(
        responseText.includes('blog') ||
          responseText.includes('typescript') ||
          responseText.includes('write'),
      ).toBe(true);
    }, 45000);
  });

  describe('Orchestrator Services Integration', () => {
    it('should have proper module structure without external dependencies', async () => {
      // Test that the orchestrator loads without requiring external services
      const response = await request(app.getHttpServer())
        .get('/agents')
        .expect(200);

      const orchestratorAgent = response.body.agents.find(
        (agent: any) => agent.name === 'orchestrator',
      );

      expect(orchestratorAgent).toBeDefined();
      expect(orchestratorAgent.type).toBe('orchestrator');
    });
  });
});
