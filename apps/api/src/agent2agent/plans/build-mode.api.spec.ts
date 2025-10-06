import { randomUUID } from 'crypto';
/**
 * BUILD MODE - Strict A2A Protocol Integration Tests
 * Tests all 10 build actions with JSON-RPC 2.0 strict typing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { AppModule } from '@/app.module';
import * as request from 'supertest';
import type {
  StrictBuildRequest,
  BuildCreateResponse,
  BuildReadResponse,
  BuildListResponse,
  BuildEditResponse,
  BuildRerunResponse,
  BuildSetCurrentResponse,
  BuildDeleteVersionResponse,
  BuildMergeVersionsResponse,
  BuildCopyVersionResponse,
  BuildDeleteResponse,
} from '@orchestrator-ai/a2a-protocol';
import { AgentTaskMode } from '@orchestrator-ai/a2a-protocol';

describe('A2A Protocol - BUILD MODE (10 actions)', () => {
  let app: INestApplication;
  let supabase: SupabaseService;
  let authToken: string;
  let testUserId: string;
  let testConversationId: string;
  let deliverableId: string;
  let versionId: string;
  let versionId2: string;

  // Helper to create strict build request
  const createBuildRequest = (
    action: string,
    payload: any,
    userMessage?: string,
  ): StrictBuildRequest => ({
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'build',
    params: {
      mode: AgentTaskMode.BUILD,
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
        metadata: { test: true, testType: 'build_mode_strict' },
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

  it('build.create - should create a new deliverable', async () => {
    const strictRequest = createBuildRequest(
      'create',
      {
        title: 'AI Trends Blog Post',
        content: '# AI Trends in 2025\n\nArtificial intelligence is rapidly evolving...',
        format: 'markdown',
        type: 'document',
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
      'Create a blog post deliverable',
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildCreateResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(strictRequest.id);
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.deliverable).toBeDefined();
    expect(body.result.payload.content.version).toBeDefined();

    deliverableId = body.result.payload.content.deliverable.id;
    versionId = body.result.payload.content.version.id;
  });

  it('build.read - should read the current deliverable', async () => {
    const strictRequest = createBuildRequest('read', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildReadResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.deliverable).toBeDefined();
    expect(body.result.payload.content.version).toBeDefined();
    expect(body.result.payload.content.deliverable.id).toBe(deliverableId);
  });

  it('build.list - should list all deliverable versions', async () => {
    const strictRequest = createBuildRequest('list', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildListResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.deliverable).toBeDefined();
    expect(body.result.payload.content.versions).toBeInstanceOf(Array);
  });

  it('build.edit - should edit the current deliverable', async () => {
    const strictRequest = createBuildRequest(
      'edit',
      {
        content: '# AI Trends in 2025 - Updated\n\nAI is transforming industries...',
      },
      'Update the blog post',
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildEditResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.version.content).toContain('Updated');
    expect(body.result.payload.content.version.createdByType).toBe('user');

    versionId2 = body.result.payload.content.version.id;
  });

  it('build.rerun - should rerun the deliverable generation', async () => {
    const strictRequest = createBuildRequest(
      'rerun',
      {
        llmSelection: {
          provider: 'ollama',
          model: 'llama3.2:1b',
        },
      },
      'Regenerate the blog post',
    );

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildRerunResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.rerunVersion).toBeDefined();
    expect(body.result.payload.content.rerunVersion.createdByType).toBe('agent');
  });

  it('build.set_current - should set a specific version as current', async () => {
    const strictRequest = createBuildRequest('set_current', {
      versionId: versionId,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildSetCurrentResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.version.id).toBe(versionId);
    expect(body.result.payload.content.version.isCurrentVersion).toBe(true);
  });

  it('build.copy_version - should copy a version', async () => {
    const strictRequest = createBuildRequest('copy_version', {
      versionId: versionId2,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildCopyVersionResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.copiedVersion.content).toContain('Updated');
    expect(body.result.payload.content.copiedVersion.metadata?.copiedFromVersionId).toBe(versionId2);
  });

  it('build.merge_versions - should merge multiple versions', async () => {
    const strictRequest = createBuildRequest('merge_versions', {
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

    const body = response.body as BuildMergeVersionsResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.mergedVersion.content).toBeDefined();
    expect(body.result.payload.content.mergedVersion.metadata?.mergedFromVersionIds).toBeDefined();
  });

  it('build.delete_version - should delete a specific version', async () => {
    const strictRequest = createBuildRequest('delete_version', {
      versionId: versionId2,
    });

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildDeleteVersionResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.deletedVersionId).toBe(versionId2);
    expect(body.result.payload.content.remainingVersions).toBeInstanceOf(Array);
  });

  it('build.delete - should delete the entire deliverable', async () => {
    const strictRequest = createBuildRequest('delete', {});

    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(strictRequest)
      .expect(201);

    const body = response.body as BuildDeleteResponse;

    expect(body.jsonrpc).toBe('2.0');
    expect(body.result.success).toBe(true);
    expect(body.result.mode).toBe('build');
    expect(body.result.payload.content.deletedDeliverableId).toBe(deliverableId);
    expect(body.result.payload.content.deletedVersionCount).toBeGreaterThan(0);

    // Verify deliverable is gone
    const readRequest = createBuildRequest('read', {});
    const readResponse = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send(readRequest);

    expect(readResponse.body.result.success).toBe(false);
    expect(readResponse.body.result.payload.content.error.code).toBe('NOT_FOUND');
  });

  it('should reject requests without auth token', async () => {
    const strictRequest = createBuildRequest('read', {});

    await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/blog_post_writer/tasks')
      .send(strictRequest)
      .expect(401);
  });
});
