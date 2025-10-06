import { randomUUID } from 'crypto';
/**
 * PLAN MODE - Strict A2A Protocol Integration Tests
 * Tests all 9 plan actions with JSON-RPC 2.0 strict typing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { AppModule } from '@/app.module';
import * as request from 'supertest';
import type {
  StrictPlanRequest,
  PlanCreateResponse,
  PlanReadResponse,
  PlanListResponse,
  PlanEditResponse,
  PlanSetCurrentResponse,
  PlanDeleteVersionResponse,
  PlanMergeVersionsResponse,
  PlanCopyVersionResponse,
  PlanDeleteResponse,
} from '@orchestrator-ai/a2a-protocol';
import { AgentTaskMode } from '@orchestrator-ai/a2a-protocol';

describe('A2A Protocol - PLAN MODE (9 actions)', () => {
  let app: INestApplication;
  let supabase: SupabaseService;
  let authToken: string;
  let testUserId: string;
  let testConversationId: string;
  let createdPlanId: string;
  let versionId: string;
  let versionId2: string;

  // Helper to create strict plan request
  const createPlanRequest = (
    action: string,
    payload: any,
    userMessage?: string,
  ): StrictPlanRequest => ({
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'plan',
    params: {
      mode: AgentTaskMode.PLAN,
      conversationId: testConversationId,
      userMessage: userMessage || '',
      payload: {
        action: action as any,
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
        metadata: { test: true, testType: 'plan_mode_strict' },
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

  it('plan.create - should create a new plan', async () => {
    const strictRequest = createPlanRequest(
      'create',
      {
        title: 'AI Blog Post Plan',
        content: '# AI Blog Post Plan\n\n1. Research AI trends\n2. Draft outline\n3. Write content',
        format: 'markdown',
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
      'Create a plan for blog post about AI',
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanCreateResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(strictRequest.id);
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.plan).toBeDefined();
    expect(body.result.payload.content.version).toBeDefined();

    createdPlanId = body.result.payload.content.plan.id;
    versionId = body.result.payload.content.version.id;
  });

  it('plan.read - should read the current plan', async () => {
    const strictRequest = createPlanRequest('read', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanReadResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.plan).toBeDefined();
    expect(body.result.payload.content.version).toBeDefined();
    expect(body.result.payload.content.plan.id).toBe(createdPlanId);
  });

  it('plan.list - should list all plan versions', async () => {
    const strictRequest = createPlanRequest('list', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanListResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.plan).toBeDefined();
    expect(body.result.payload.content.versions).toBeInstanceOf(Array);
  });

  it('plan.edit - should edit the current plan', async () => {
    const strictRequest = createPlanRequest(
      'edit',
      {
        content: '# Updated Plan\n\n1. Research deeply\n2. Write outline\n3. Get feedback',
      },
      'Update the plan with more detail',
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanEditResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.version.content).toContain('Updated Plan');
    expect(body.result.payload.content.version.createdByType).toBe('user');

    versionId2 = body.result.payload.content.version.id;
  });

  it('plan.set_current - should set a specific version as current', async () => {
    const strictRequest = createPlanRequest('set_current', {
      versionId: versionId,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanSetCurrentResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.version.id).toBe(versionId);
    expect(body.result.payload.content.version.isCurrentVersion).toBe(true);
  });

  it('plan.copy_version - should copy a version', async () => {
    const strictRequest = createPlanRequest('copy_version', {
      versionId: versionId2,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanCopyVersionResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.copiedVersion.content).toContain('Updated Plan');
    expect(body.result.payload.content.copiedVersion.metadata?.copiedFromVersionId).toBe(versionId2);
  });

  it('plan.merge_versions - should merge multiple versions', async () => {
    const strictRequest = createPlanRequest('merge_versions', {
      versionIds: [versionId, versionId2],
      llmSelection: {
        provider: 'ollama',
        model: 'llama3.2:1b',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanMergeVersionsResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.mergedVersion.content).toBeDefined();
    expect(body.result.payload.content.mergedVersion.metadata?.mergedFromVersionIds).toBeDefined();
  });

  it('plan.delete_version - should delete a specific version', async () => {
    const strictRequest = createPlanRequest('delete_version', {
      versionId: versionId2,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanDeleteVersionResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.deletedVersionId).toBe(versionId2);
    expect(body.result.payload.content.remainingVersions).toBeInstanceOf(Array);
  });

  it('plan.delete - should delete the entire plan', async () => {
    const strictRequest = createPlanRequest('delete', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as PlanDeleteResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('plan');
    expect(body.result.payload.content.deletedPlanId).toBe(createdPlanId);
    expect(body.result.payload.content.deletedVersionCount).toBeGreaterThan(0);

    // Verify plan is gone
    const readRequest = createPlanRequest('read', {});
    const readResponse = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(readRequest);

    expect(readResponse.body.result.success).toBe(false);
    expect(readResponse.body.result.payload.content.error.code).toBe('NOT_FOUND');
  });

  it('should reject requests without auth token', async () => {
    const strictRequest = createPlanRequest('read', {});

    await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .send(strictRequest)
      .expect(401);
  });
});
