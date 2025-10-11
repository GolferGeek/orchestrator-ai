import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import * as request from 'supertest';
import { TasksService } from '../../src/agent2agent/tasks/tasks.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentTaskMode } from '../../src/agent2agent/dto/task-request.dto';
import * as jwt from 'jsonwebtoken';

describe('SSE Streaming (Agent2AgentController)', () => {
  let app: INestApplication;
  let tasksService: TasksService;
  let eventEmitter: EventEmitter2;

  let authToken: string;
  let testUserId: string;

  const agentSlug = 'blog_post';
  const organizationSlug = 'global';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tasksService = moduleFixture.get(TasksService);
    eventEmitter = moduleFixture.get(EventEmitter2);

    // Use API key authentication for E2E tests (more reliable in test environment)
    authToken = process.env.TEST_API_SECRET_KEY || 'test-secret-key';
    testUserId = process.env.SUPABASE_TEST_USERID || 'b29a590e-b07f-49df-a25b-574c956b5035';

    if (!authToken || !testUserId) {
      throw new Error('Failed to set up test authentication. Ensure TEST_API_SECRET_KEY and SUPABASE_TEST_USERID are set.');
    }
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

  describe('stream-token endpoint', () => {
    it('returns a signed token for valid task/user', async () => {
      const task = await tasksService.createTask(testUserId, agentSlug, 'specialist', {
        method: 'converse',
        prompt: 'SSE token test prompt',
      });

      const response = await request(app.getHttpServer())
        .post(`/agent-to-agent/${organizationSlug}/${agentSlug}/tasks/${task.id}/stream-token`)
        .set('X-Test-Api-Key', authToken)
        .send({ streamId: 'token-test-stream' })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          expiresAt: expect.any(String),
        }),
      );
    });
  });

  describe('SSE stream endpoint', () => {
    it('streams chunk and complete events when authenticated with stream token', async () => {
      const task = await tasksService.createTask(testUserId, agentSlug, 'specialist', {
        method: AgentTaskMode.CONVERSE,
        prompt: 'SSE chunk test prompt',
      });

      const streamId = 'sse-stream-test';

      const tokenResponse = await request(app.getHttpServer())
        .post(`/agent-to-agent/${organizationSlug}/${agentSlug}/tasks/${task.id}/stream-token`)
        .set('X-Test-Api-Key', authToken)
        .send({ streamId })
        .expect(201);

      const { token } = tokenResponse.body;
      expect(token).toBeDefined();

      const streamPromise = new Promise<string>((resolve, reject) => {
        let streamData = '';
        const req = request(app.getHttpServer())
          .get(
            `/agent-to-agent/${organizationSlug}/${agentSlug}/tasks/${task.id}/stream?streamId=${streamId}&token=${token}`,
          )
          .set('Accept', 'text/event-stream')
          .buffer(false);
        
        req.on('response', (res) => {
          // Listen directly on the response object to capture SSE data
          res.on('data', (chunk: Buffer) => {
            streamData += chunk.toString('utf8');
            if (streamData.includes('event: agent_stream_complete')) {
              resolve(streamData);
            }
          });
          
          res.on('end', () => {
            // Resolve with whatever data we have if complete event wasn't detected
            if (!streamData.includes('event: agent_stream_complete')) {
              resolve(streamData);
            }
          });
        });
        
        req.on('error', (err: Error) => reject(err));
        
        // Send the request
        req.end();
      });

      const eventPayload = {
        streamId,
        conversationId: task.agentConversationId,
        orchestrationRunId: null,
        organizationSlug,
        agentSlug,
        mode: AgentTaskMode.CONVERSE,
      };

      setTimeout(() => {
        eventEmitter.emit('agent.stream.chunk', {
          ...eventPayload,
          chunk: {
            type: 'partial',
            content: 'Hello from SSE test',
            metadata: { progress: 25 },
          },
        });

        eventEmitter.emit('agent.stream.complete', {
          ...eventPayload,
        });
      }, 100);

      const streamedData = await streamPromise;

      expect(streamedData).toContain('event: agent_stream_chunk');
      expect(streamedData).toContain('Hello from SSE test');
      expect(streamedData).toContain('event: agent_stream_complete');
    }, 5000);
  });
});
