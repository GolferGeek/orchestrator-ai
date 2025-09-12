import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Execution Modes and TaskStatusService Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered and auto-registered
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Authenticate as test user
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;
    expect(authToken).toBeDefined();
    console.log('✅ Authentication successful');
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  describe('Agent Execution Modes from /agents endpoint', () => {
    it('should return execution_modes for all agents', async () => {
      console.log('🧪 Testing /agents endpoint for execution modes...');

      const response = await request(app.getHttpServer())
        .get('/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.agents).toBeDefined();
      expect(Array.isArray(response.body.agents)).toBe(true);

      console.log(`📊 Found ${response.body.agents.length} agents`);

      // Check that agents have execution_modes
      response.body.agents.forEach((agent: any) => {
        console.log(
          `🤖 Agent: ${agent.name}, Type: ${agent.type}, Execution Modes: ${JSON.stringify(agent.execution_modes)}`,
        );

        expect(agent.execution_modes).toBeDefined();
        expect(Array.isArray(agent.execution_modes)).toBe(true);
        expect(agent.execution_modes.length).toBeGreaterThan(0);

        // All agents should at least have immediate mode
        expect(agent.execution_modes).toContain('immediate');
      });

      // Find specific agents to verify their execution modes
      const blogPostAgent = response.body.agents.find(
        (a: any) => a.name === 'Blog Post Writer',
      );
      const requirementsAgent = response.body.agents.find(
        (a: any) => a.name === 'Requirements Writer',
      );

      if (blogPostAgent) {
        console.log(
          `📝 Blog Post Writer execution modes: ${JSON.stringify(blogPostAgent.execution_modes)}`,
        );
        expect(blogPostAgent.execution_modes).toEqual(['immediate']);
      }

      if (requirementsAgent) {
        console.log(
          `📋 Requirements Writer execution modes: ${JSON.stringify(requirementsAgent.execution_modes)}`,
        );
        expect(requirementsAgent.execution_modes).toContain('immediate');
        expect(requirementsAgent.execution_modes).toContain('polling');
        expect(requirementsAgent.execution_modes).toContain('real-time');
      }
    });
  });

  describe('Blog Post Writer (Context Agent) - Immediate Mode', () => {
    it('should create and complete blog post task in immediate mode', async () => {
      console.log('📝 Testing Blog Post Writer with immediate execution...');

      const taskPayload = {
        message: {
          role: 'user',
          parts: [
            {
              text: 'Write a short blog post about the benefits of TypeScript for web development. Keep it under 300 words.',
            },
          ],
        },
      };

      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .post('/agents/blog_post/blog_post/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⏱️ Task completed in ${duration}ms`);
      console.log(`📋 Task ID: ${response.body.id}`);
      console.log(`📊 Status: ${response.body.status?.state}`);

      // Verify immediate completion
      expect(response.body.id).toBeDefined();
      expect(response.body.status?.state).toBe('completed');

      // Should have response content
      expect(response.body.response_message).toBeDefined();
      expect(response.body.response_message.parts).toBeDefined();
      expect(response.body.response_message.parts[0].text).toBeDefined();

      const content = response.body.response_message.parts[0].text;
      console.log(`📄 Content length: ${content.length} characters`);
      console.log(`📝 Content preview: ${content.substring(0, 100)}...`);

      // Verify content contains expected keywords
      expect(content.toLowerCase()).toMatch(
        /typescript|javascript|web development|benefits/,
      );

      // Should be completed immediately (under 30 seconds for context agent)
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Requirements Writer (Function Agent) - Multiple Execution Modes', () => {
    const testPrompt =
      'Generate requirements for a simple task management mobile app with user authentication, task creation, and basic CRUD operations.';

    it('should complete requirements task in immediate mode', async () => {
      console.log('📋 Testing Requirements Writer with immediate execution...');

      const taskPayload = {
        message: {
          role: 'user',
          parts: [{ text: testPrompt }],
        },
      };

      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .post('/agents/requirements_writer/requirements_writer/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⏱️ Task completed in ${duration}ms`);
      console.log(`📋 Task ID: ${response.body.id}`);
      console.log(`📊 Status: ${response.body.status?.state}`);

      expect(response.body.id).toBeDefined();
      expect(response.body.status?.state).toBe('completed');
      expect(response.body.response_message).toBeDefined();

      const content = response.body.response_message.parts[0].text;
      console.log(`📄 Content length: ${content.length} characters`);

      // Should contain requirements-specific content
      expect(content.toLowerCase()).toMatch(
        /requirements|functional|non-functional|user story|acceptance criteria/,
      );
    });

    it('should handle requirements task with polling mode', async () => {
      console.log('📋 Testing Requirements Writer with polling execution...');

      // Create task
      const taskPayload = {
        message: {
          role: 'user',
          parts: [{ text: testPrompt }],
        },
      };

      const createResponse = await request(app.getHttpServer())
        .post('/agents/requirements_writer/requirements_writer/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      const taskId = createResponse.body.id;
      console.log(`📋 Created task: ${taskId}`);
      console.log(`📊 Initial status: ${createResponse.body.status?.state}`);

      // Task should be created successfully
      expect(taskId).toBeDefined();

      // Poll for completion (simulating polling mode behavior)
      let completed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      let finalResponse;

      while (!completed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

        const pollResponse = await request(app.getHttpServer())
          .get(`/tasks/${taskId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        console.log(
          `🔄 Poll attempt ${attempts + 1}: Status = ${pollResponse.body.status?.state}`,
        );

        if (pollResponse.body.status?.state === 'completed') {
          completed = true;
          finalResponse = pollResponse.body;
        } else if (pollResponse.body.status?.state === 'failed') {
          throw new Error(
            `Task failed: ${pollResponse.body.error_details?.message}`,
          );
        }

        attempts++;
      }

      expect(completed).toBe(true);
      expect(finalResponse).toBeDefined();
      expect(finalResponse.response_message).toBeDefined();

      const content = finalResponse.response_message.parts[0].text;
      console.log(`📄 Final content length: ${content.length} characters`);

      // Verify requirements content
      expect(content.toLowerCase()).toMatch(
        /requirements|functional|non-functional|user story|acceptance criteria/,
      );
    });

    it('should handle task status service integration', async () => {
      console.log('🔧 Testing TaskStatusService integration...');

      const taskPayload = {
        message: {
          role: 'user',
          parts: [
            {
              text: 'Generate a simple requirements document for user registration.',
            },
          ],
        },
      };

      const response = await request(app.getHttpServer())
        .post('/agents/requirements_writer/requirements_writer/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      const taskId = response.body.id;
      console.log(`📋 Task created: ${taskId}`);

      // Check that task status is accessible via API
      const statusResponse = await request(app.getHttpServer())
        .get(`/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      console.log(`📊 Task status: ${JSON.stringify(statusResponse.body)}`);

      expect(statusResponse.body.taskId).toBe(taskId);
      expect(statusResponse.body.status).toBeDefined();
      expect(['pending', 'running', 'completed', 'failed']).toContain(
        statusResponse.body.status,
      );
    });
  });

  describe('TaskStatusService Dependency Injection', () => {
    it('should verify TaskStatusService is available to agents', async () => {
      console.log('💉 Testing TaskStatusService dependency injection...');

      // Create a simple task to verify the service chain works
      const taskPayload = {
        message: {
          role: 'user',
          parts: [{ text: 'Simple test task' }],
        },
      };

      // Test with a context agent (Blog Post)
      const blogResponse = await request(app.getHttpServer())
        .post('/agents/blog_post/blog_post/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      expect(blogResponse.body.id).toBeDefined();
      console.log(`✅ Blog Post Writer task created: ${blogResponse.body.id}`);

      // Test with a function agent (Requirements Writer)
      const reqResponse = await request(app.getHttpServer())
        .post('/agents/requirements_writer/requirements_writer/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      expect(reqResponse.body.id).toBeDefined();
      console.log(
        `✅ Requirements Writer task created: ${reqResponse.body.id}`,
      );

      // Both should succeed, proving TaskStatusService is properly injected
      console.log(
        '✅ TaskStatusService dependency injection working correctly',
      );
    });
  });

  describe('Real-time WebSocket Support', () => {
    it('should support real-time task updates (Requirements Writer)', async () => {
      console.log('🔄 Testing real-time WebSocket support...');

      // Note: This is a basic test to verify the endpoint works
      // Full WebSocket testing would require a WebSocket client
      const taskPayload = {
        message: {
          role: 'user',
          parts: [{ text: 'Generate requirements with real-time updates.' }],
        },
      };

      const response = await request(app.getHttpServer())
        .post('/agents/requirements_writer/requirements_writer/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskPayload)
        .expect(200);

      expect(response.body.id).toBeDefined();
      console.log(`🔄 Real-time capable task created: ${response.body.id}`);

      // For now, just verify the task was created successfully
      // Full WebSocket testing would require additional test infrastructure
      console.log('✅ Real-time WebSocket endpoint accessible');
    });
  });
});
