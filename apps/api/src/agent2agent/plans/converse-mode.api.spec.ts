import { randomUUID } from 'crypto';
/**
 * CONVERSE MODE - Strict A2A Protocol Integration Tests
 * Tests the single converse action with JSON-RPC 2.0 strict typing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { AppModule } from '@/app.module';
import * as request from 'supertest';
import type {
  StrictConverseRequest,
  ConverseMessageResponse,
} from '@orchestrator-ai/a2a-protocol';
import { AgentTaskMode } from '@orchestrator-ai/a2a-protocol';

describe('A2A Protocol - CONVERSE MODE (1 action)', () => {
  let app: INestApplication;
  let supabase: SupabaseService;
  let authToken: string;
  let testUserId: string;
  let testConversationId: string;

  // Helper to create strict converse request
  const createConverseRequest = (
    userMessage: string,
    messages: any[] = [],
    payload: any = {},
  ): StrictConverseRequest => ({
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'converse',
    params: {
      mode: AgentTaskMode.CONVERSE,
      conversationId: testConversationId,
      userMessage,
      messages,
      payload: {
        ...payload,
      },
    },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    supabase = moduleFixture.get<SupabaseService>(SupabaseService);

    // Get test user credentials
    const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@orchestratorai.io';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'DemoUser123!';

    // Authenticate
    const { data: authData, error: authError } = await supabase
      .getAnonClient()
      .auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    if (authError || !authData.session) {
      throw new Error(`Failed to authenticate: ${authError?.message}`);
    }

    authToken = authData.session.access_token;
    testUserId = authData.user.id;

    // Create test conversation
    const { data: conversation, error: convError } = await supabase
      .getServiceClient()
      .from('conversations')
      .insert({
        user_id: testUserId,
        agent_name: 'blog_post_writer',
        agent_type: 'context',
        started_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        metadata: { test: true, testType: 'converse_mode_strict' },
      })
      .select('id')
      .single();

    if (convError) {
      throw new Error(`Failed to create conversation: ${convError.message}`);
    }

    testConversationId = conversation.id;
  });

  afterAll(async () => {
    await supabase
      .getServiceClient()
      .from('conversations')
      .delete()
      .eq('id', testConversationId);

    await app.close();
  });

  it('converse.send - should handle a simple message', async () => {
    const strictRequest = createConverseRequest(
      'What topics should I write about for my AI blog?',
      [],
      {
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as ConverseMessageResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(strictRequest.id);
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('converse');
    expect(body.result.payload.content).toBeDefined();
  });

  it('converse.send - should maintain conversation history', async () => {
    const strictRequest = createConverseRequest(
      'Can you elaborate on that?',
      [
        {
          role: 'user',
          content: 'What topics should I write about?',
        },
        {
          role: 'assistant',
          content: 'You could write about machine learning, NLP, and computer vision',
        },
      ],
      {
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as ConverseMessageResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(strictRequest.id);
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('converse');
    expect(body.result.payload.content).toBeDefined();
  });

  it('converse.send - should handle empty message history', async () => {
    const strictRequest = createConverseRequest(
      'Tell me about AI trends',
      [],
      {
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as ConverseMessageResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('converse');
    expect(body.result.payload.content).toBeDefined();
  });

  it('should reject requests without auth token', async () => {
    const strictRequest = createConverseRequest('Test message', [], {});

    await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .send(strictRequest)
      .expect(401);
  });

  it('should reject requests with empty user message', async () => {
    const strictRequest = createConverseRequest(
      '',
      [],
      {
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest);

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
