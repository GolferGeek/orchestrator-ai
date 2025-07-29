import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Calendar Agent E2E Test', () => {
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

    // Authenticate first
    const authResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'testuser@golfergeek.com',
        password: 'testuser01!',
      })
      .expect(201);

    authToken =
      authResponse.body.token ||
      authResponse.body.accessToken ||
      authResponse.body.access_token;
    expect(authToken).toBeDefined();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should handle calendar scheduling request successfully', async () => {
    console.log('🗓️ Testing Calendar Agent...');

    const taskRequest = {
      method: 'executeTask',
      prompt:
        'Schedule a quarterly board meeting with 8 executives across different time zones (EST, PST, GMT, CET). Need to find optimal time slots considering executive availability and provide alternative options if conflicts arise.',
      providerId: null,
      modelId: null,
      temperature: 0.7,
      sessionId: `test-session-${Date.now()}`,
    };

    // Create task
    const createResponse = await request(app.getHttpServer())
      .post('/agents/operations/calendar/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(taskRequest)
      .expect(201);

    expect(createResponse.body).toHaveProperty('taskId');
    expect(createResponse.body).toHaveProperty('status');

    const taskId = createResponse.body.taskId;
    console.log(`   Task created: ${taskId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max
    let finalResponse;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      console.log(
        `   Attempt ${attempts + 1}: Status = ${statusResponse.body.status}`,
      );

      if (statusResponse.body.status === 'completed') {
        finalResponse = statusResponse.body;
        break;
      } else if (statusResponse.body.status === 'failed') {
        throw new Error(
          `Task failed: ${statusResponse.body.error || 'Unknown error'}`,
        );
      }

      attempts++;
    }

    // Verify completion
    expect(finalResponse).toBeDefined();
    expect(finalResponse.status).toBe('completed');
    expect(finalResponse.response).toBeDefined();
    expect(finalResponse.response.length).toBeGreaterThan(0);

    console.log(`✅ Calendar Agent test completed successfully`);
    console.log(
      `   Response length: ${finalResponse.response.length} characters`,
    );
    console.log(
      `   First 200 chars: ${finalResponse.response.substring(0, 200)}...`,
    );
  }, 90000); // 90 second timeout
});
