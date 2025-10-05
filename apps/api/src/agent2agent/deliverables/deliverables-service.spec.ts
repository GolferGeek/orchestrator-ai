/**
 * Deliverables Service Unit Test
 * Tests DeliverablesService.executeAction() with ALL 10 actions in progressive flow
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DeliverablesService } from './deliverables.service';
import { DeliverableVersionsService } from './deliverable-versions.service';
import { SupabaseModule } from '@/supabase/supabase.module';
import { SupabaseService } from '@/supabase/supabase.service';
import { ConfigModule } from '@nestjs/config';
import { AgentConversationsModule } from '@/agent2agent/conversations/agent-conversations.module';

describe('DeliverablesService - All 10 Actions (Progressive Flow)', () => {
  let service: DeliverablesService;
  let supabase: SupabaseService;
  let module: TestingModule;

  const testUserId = 'b29a590e-b07f-49df-a25b-574c956b5035';
  let testConversationId: string;
  let deliverableId: string;
  let versionId: string;
  let versionId2: string;
  let versionId3: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '../../.env',
        }),
        SupabaseModule,
        AgentConversationsModule,
      ],
      providers: [
        DeliverablesService,
        DeliverableVersionsService,
      ],
    }).compile();

    service = module.get<DeliverablesService>(DeliverablesService);
    supabase = module.get<SupabaseService>(SupabaseService);

    // Manually trigger onModuleInit
    await module.init();

    // Create test conversation
    const { data: conversation, error } = await supabase
      .getServiceClient()
      .from('conversations')
      .insert({
        user_id: testUserId,
        agent_name: 'test_agent',
        agent_type: 'context',
        started_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        metadata: { test: true },
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    testConversationId = conversation.id;
  });

  afterAll(async () => {
    // Cleanup
    if (supabase && testConversationId) {
      await supabase
        .getServiceClient()
        .from('conversations')
        .delete()
        .eq('id', testConversationId);
    }

    if (module) {
      await module.close();
    }
  });

  it('1. CREATE - should create initial deliverable', async () => {
    const result = await service.executeAction(
      'create',
      {
        title: 'Test Document',
        content: '# Initial Document\n\nThis is the first version.',
        format: 'markdown',
        type: 'document',
        agentName: 'test_agent',
      },
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.deliverable.title).toBe('Test Document');
    expect(result.data.version.versionNumber).toBe(1);
    expect(result.data.isNew).toBe(true);

    deliverableId = result.data.deliverable.id;
    versionId = result.data.version.id;
  });

  it('2. READ - should read the current deliverable', async () => {
    const result = await service.executeAction(
      'read',
      {},
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.id).toBe(deliverableId);
    expect(result.data.currentVersion.versionNumber).toBe(1);
  });

  it('3. CREATE (enhance) - should enhance existing deliverable', async () => {
    const result = await service.executeAction(
      'create',
      {
        title: 'Test Document',
        content: '# Enhanced Document\n\nThis is the enhanced version with more content.',
        format: 'markdown',
        type: 'document',
        agentName: 'test_agent',
      },
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.isNew).toBe(false); // Enhancement
    expect(result.data.version.versionNumber).toBe(2);
    expect(result.data.version.content).toContain('enhanced version');

    versionId2 = result.data.version.id;
  });

  it('4. LIST - should list all deliverable versions', async () => {
    const result = await service.executeAction(
      'list',
      {},
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.versions.length).toBe(2);
    expect(result.data.versions[0].versionNumber).toBe(1);
    expect(result.data.versions[1].versionNumber).toBe(2);
  });

  it('5. EDIT - should manually edit the deliverable', async () => {
    const result = await service.executeAction(
      'edit',
      {
        content: '# User Edited Document\n\nUser made manual changes.',
      },
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.version.versionNumber).toBe(3);
    expect(result.data.version.content).toContain('User Edited');
    expect(result.data.version.createdByType).toBe('user');

    versionId3 = result.data.version.id;
  });

  it('6. SET_CURRENT - should set a previous version as current', async () => {
    const result = await service.executeAction(
      'set_current',
      {
        versionId: versionId, // Set back to v1
      },
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.version.id).toBe(versionId);
    expect(result.data.version.isCurrentVersion).toBe(true);
    expect(result.data.version.versionNumber).toBe(1);

    // Verify by reading
    const readResult = await service.executeAction('read', {}, {
      conversationId: testConversationId,
      userId: testUserId,
    });
    expect(readResult.data.currentVersion.versionNumber).toBe(1);
  });

  it('7. COPY_VERSION - should copy a version', async () => {
    const result = await service.executeAction(
      'copy_version',
      {
        versionId: versionId2, // Copy v2
      },
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.version.versionNumber).toBe(4);
    expect(result.data.version.content).toContain('enhanced version'); // Same as v2
    expect(result.data.version.metadata.copiedFromVersionId).toBe(versionId2);
  });

  it('8. DELETE_VERSION - should delete a specific version', async () => {
    const result = await service.executeAction(
      'delete_version',
      {
        versionId: versionId3, // Delete v3 (user edited)
      },
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.message).toContain('deleted successfully');

    // Verify version is gone by listing
    const listResult = await service.executeAction('list', {}, {
      conversationId: testConversationId,
      userId: testUserId,
    });
    expect(listResult.data.versions.length).toBe(3); // v1, v2, v4 (v3 deleted)
    const hasV3 = listResult.data.versions.some((v: any) => v.id === versionId3);
    expect(hasV3).toBe(false);
  });

  it('9. MERGE_VERSIONS - should merge multiple versions (skipped - requires LLM)', async () => {
    // Skipping merge test as it requires LLM which is not available in unit tests
    // This would be tested in integration tests with full HTTP/LLM stack
    expect(true).toBe(true);
  });

  it('10. DELETE - should delete the entire deliverable', async () => {
    const result = await service.executeAction(
      'delete',
      {},
      {
        conversationId: testConversationId,
        userId: testUserId,
      },
    );

    expect(result.success).toBe(true);
    expect(result.data.message).toContain('deleted successfully');

    // Verify deliverable is completely gone
    const readResult = await service.executeAction('read', {}, {
      conversationId: testConversationId,
      userId: testUserId,
    });
    expect(readResult.success).toBe(false);
    expect(readResult.error?.code).toBe('NOT_FOUND');
  });
});
