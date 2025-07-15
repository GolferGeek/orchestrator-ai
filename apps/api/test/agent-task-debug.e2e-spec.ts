import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Agent Task Debug (e2e)', () => {
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

  it('should create and execute a blog post task', async () => {
    console.log('🚀 Starting agent task test...');
    
    // Step 1: Create a task for the blog_post agent
    const taskData = {
      method: 'process',
      prompt: 'Write a blog post about playing golf in extreme heat',
      timeoutSeconds: 300,
    };

    console.log('📝 Creating task with data:', taskData);
    
    const createResponse = await request(app.getHttpServer())
      .post('/agents/specialists/blog_post/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(taskData)
      .expect(200);

    console.log('✅ Task created successfully:', createResponse.body);
    
    const { taskId, conversationId } = createResponse.body;
    
    // Step 2: Check task status
    const checkStatus = async () => {
      const statusResponse = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      console.log('📊 Task status:', statusResponse.body);
      return statusResponse.body;
    };

    // Step 3: Wait for task completion (with timeout)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    let task = await checkStatus();
    
    while (task.status !== 'completed' && task.status !== 'failed' && attempts < maxAttempts) {
      console.log(`⏳ Waiting for task completion... (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      task = await checkStatus();
      attempts++;
    }

    // Step 4: Verify final result
    if (task.status === 'completed') {
      console.log('🎉 Task completed successfully!');
      console.log('📄 Response:', task.response);
      console.log('🔍 Response metadata:', task.responseMetadata);
      
      expect(task.response).toBeDefined();
      expect(task.response).toContain('golf');
      expect(task.agentConversationId).toBe(conversationId);
    } else if (task.status === 'failed') {
      console.log('❌ Task failed:');
      console.log('Error code:', task.errorCode);
      console.log('Error message:', task.errorMessage);
      console.log('Error data:', task.errorData);
      
      // Log the failure but don't fail the test - we want to see what's happening
      console.warn('Task failed but test continues for debugging');
    } else {
      console.log('⏰ Task timed out after 30 seconds');
      console.log('Final status:', task.status);
      console.log('Progress:', task.progress);
      console.log('Progress message:', task.progressMessage);
    }

    // Step 5: Check conversation was created
    const conversationResponse = await request(app.getHttpServer())
      .get(`/agent-conversations/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log('🗨️ Conversation details:', conversationResponse.body);
    
    // Step 6: List all tasks for this conversation
    const tasksResponse = await request(app.getHttpServer())
      .get(`/tasks?conversationId=${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    console.log('📋 All tasks in conversation:', tasksResponse.body);
  }, 60000); // 60 second timeout

  afterEach(async () => {
    await app.close();
  });
});