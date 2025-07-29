import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Content Agent E2E Test', () => {
  let app: INestApplication;
  let authToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Wait for agents to be discovered
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Authenticate to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPABASE_TEST_USER || 'testuser@golfergeek.com',
        password: process.env.SUPABASE_TEST_PASSWORD || 'testuser01!',
      })
      .expect(200);

    authToken = loginResponse.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should create and execute a content creation task successfully', async () => {
    // Step 1: Create a task for the content agent
    const taskData = {
      method: 'process',
      prompt: 'Create a compelling blog post about the benefits of AI-powered project management tools for remote teams. Include SEO optimization and a strong call-to-action.',
      timeoutSeconds: 300,
    };

    const createResponse = await request(app.getHttpServer())
      .post('/agents/specialists/content/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(taskData)
      .expect(200);

    const { taskId, conversationId } = createResponse.body;
    expect(taskId).toBeDefined();
    expect(conversationId).toBeDefined();

    // Step 2: Check task status
    const checkStatus = async () => {
      const statusResponse = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      return statusResponse.body;
    };

    // Step 3: Wait for task completion (with timeout)
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds for content generation
    let task = await checkStatus();

    while (
      task.status !== 'completed' &&
      task.status !== 'failed' &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      task = await checkStatus();
      attempts++;
    }

    // Step 4: Verify final result
    expect(task.status).toBe('completed');
    expect(task.response).toBeDefined();
    expect(task.response).toContain('AI'); // Should contain AI-related content
    expect(task.response).toContain('project management'); // Should contain project management content
    expect(task.response).toContain('remote teams'); // Should contain remote teams content
    expect(task.agentConversationId).toBe(conversationId);

    // Step 5: Verify conversation was created
    const conversationResponse = await request(app.getHttpServer())
      .get(`/agent-conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(conversationResponse.body).toBeDefined();

    console.log('✅ Content Agent test completed successfully');
    console.log(`📝 Generated content length: ${task.response.length} characters`);
  }, 90000); // 90 second timeout for the entire test

  it('should create and execute a content strategy task successfully', async () => {
    // Step 1: Create a strategy task for the content agent
    const taskData = {
      method: 'process',
      prompt: 'Develop a comprehensive content strategy for Q2 SaaS product launch. Include content calendar, channel distribution, and success metrics.',
      timeoutSeconds: 300,
    };

    const createResponse = await request(app.getHttpServer())
      .post('/agents/specialists/content/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(taskData)
      .expect(200);

    const { taskId, conversationId } = createResponse.body;

    // Step 2: Wait for completion
    const checkStatus = async () => {
      const statusResponse = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);
      return statusResponse.body;
    };

    let attempts = 0;
    const maxAttempts = 60;
    let task = await checkStatus();

    while (
      task.status !== 'completed' &&
      task.status !== 'failed' &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      task = await checkStatus();
      attempts++;
    }

    // Step 3: Verify strategy content
    expect(task.status).toBe('completed');
    expect(task.response).toBeDefined();
    expect(task.response).toContain('content strategy'); // Should contain strategy content
    expect(task.response).toContain('Q2'); // Should reference Q2
    expect(task.response).toContain('calendar'); // Should include calendar planning
    expect(task.agentConversationId).toBe(conversationId);

    console.log('✅ Content Strategy test completed successfully');
    console.log(`📊 Generated strategy length: ${task.response.length} characters`);
  }, 90000);
}); 