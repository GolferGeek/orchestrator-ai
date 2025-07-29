import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Voice Summary Agent E2E Test', () => {
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

  it('should create and execute a meeting summary task successfully', async () => {
    // Step 1: Create a task for the voice summary agent
    const taskData = {
      method: 'process',
      prompt:
        'Create a comprehensive executive summary of our Q4 board meeting. The meeting covered strategic decisions including European market expansion with $2.5M budget approval, engineering team scaling with 25 new hires, and marketing budget increase of 20%. Extract key action items with owners and deadlines, and analyze the overall sentiment and engagement of the leadership team.',
      timeoutSeconds: 300,
    };

    const createResponse = await request(app.getHttpServer())
      .post('/agents/specialists/voice_summary/tasks')
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
    const maxAttempts = 60; // 60 seconds for voice analysis
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
    expect(task.response).toContain('executive'); // Should contain executive content
    expect(task.response).toContain('action'); // Should contain action items
    expect(task.response).toContain('meeting'); // Should contain meeting content
    expect(task.agentConversationId).toBe(conversationId);

    // Step 5: Verify conversation was created
    const conversationResponse = await request(app.getHttpServer())
      .get(`/agent-conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(conversationResponse.body).toBeDefined();

    console.log('✅ Voice Summary Agent test completed successfully');
    console.log(
      `📊 Generated summary length: ${task.response.length} characters`,
    );
  }, 90000); // 90 second timeout for the entire test

  it('should create and execute an action item extraction task successfully', async () => {
    // Step 1: Create an action extraction task for the voice summary agent
    const taskData = {
      method: 'process',
      prompt:
        'Extract and prioritize all action items from our client implementation call. The call included urgent technical issues requiring immediate CTO attention, stakeholder communication needs, data migration planning, and user training coordination. Organize by urgency levels and include owners and deadlines.',
      timeoutSeconds: 300,
    };

    const createResponse = await request(app.getHttpServer())
      .post('/agents/specialists/voice_summary/tasks')
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

    // Step 3: Verify action item content
    expect(task.status).toBe('completed');
    expect(task.response).toBeDefined();
    expect(task.response).toContain('action'); // Should contain action items
    expect(task.response).toContain('priority'); // Should include prioritization
    expect(task.response).toContain('urgent'); // Should include urgency levels
    expect(task.agentConversationId).toBe(conversationId);

    console.log('✅ Action Item Extraction test completed successfully');
    console.log(
      `📋 Generated action plan length: ${task.response.length} characters`,
    );
  }, 90000);
});
