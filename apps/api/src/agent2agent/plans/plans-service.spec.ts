/**
 * Plans Service Unit Test
 * Tests PlansService.executeAction() directly without HTTP layer
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './services/plans.service';
import { PlanVersionsService } from './services/plan-versions.service';
import { PlansRepository } from './repositories/plans.repository';
import { PlanVersionsRepository } from './repositories/plan-versions.repository';
import { SupabaseModule } from '@/supabase/supabase.module';
import { SupabaseService } from '@/supabase/supabase.service';
import { ConfigModule } from '@nestjs/config';

describe('PlansService Unit Test (executeAction)', () => {
  let service: PlansService;
  let supabase: SupabaseService;
  let module: TestingModule;

  const testUserId = 'b29a590e-b07f-49df-a25b-574c956b5035';
  let testConversationId: string;
  let planId: string;
  let versionId: string;
  let versionId2: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '../../.env',
        }),
        SupabaseModule,
      ],
      providers: [
        PlansService,
        PlanVersionsService,
        PlansRepository,
        PlanVersionsRepository,
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
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
    await supabase
      .getServiceClient()
      .from('conversations')
      .delete()
      .eq('id', testConversationId);

    await module.close();
  });

  describe('Action: CREATE', () => {
    it('should CREATE a new plan (action: create)', async () => {
      const result = await service.executeAction(
        'create',
        {
          title: 'Test Plan v1',
          content: '# Test Plan\n\n1. Step one\n2. Step two',
          format: 'markdown',
          agentName: 'test_agent',
          namespace: 'test',
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.plan).toBeDefined();
      expect(result.data.plan.title).toBe('Test Plan v1');
      expect(result.data.version).toBeDefined();
      expect(result.data.version.versionNumber).toBe(1);
      expect(result.data.isNew).toBe(true);

      planId = result.data.plan.id;
      versionId = result.data.version.id;
    });

    it('should REFINE existing plan (action: create again)', async () => {
      const result = await service.executeAction(
        'create',
        {
          title: 'Test Plan v1',
          content: '# Test Plan v2\n\n1. Step one\n2. Step two\n3. Step three',
          format: 'markdown',
          agentName: 'test_agent',
          namespace: 'test',
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.isNew).toBe(false); // Refinement
      expect(result.data.version.versionNumber).toBe(2);
      expect(result.data.version.content).toContain('Step three');

      versionId2 = result.data.version.id;
    });
  });

  describe('Action: READ', () => {
    it('should READ the current plan (action: read)', async () => {
      const result = await service.executeAction(
        'read',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(planId);
      expect(result.data.currentVersion).toBeDefined();
      expect(result.data.currentVersion.versionNumber).toBe(2); // Latest version
    });
  });

  describe('Action: LIST', () => {
    it('should LIST all plan versions (action: list)', async () => {
      const result = await service.executeAction(
        'list',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.plan).toBeDefined();
      expect(result.data.versions).toBeInstanceOf(Array);
      expect(result.data.versions.length).toBe(2);
      expect(result.data.versions[0].versionNumber).toBe(1);
      expect(result.data.versions[1].versionNumber).toBe(2);
    });
  });

  describe('Action: EDIT', () => {
    it('should EDIT the plan manually (action: edit)', async () => {
      const result = await service.executeAction(
        'edit',
        {
          content: '# Manually Edited Plan\n\n1. User changes\n2. More user changes',
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.version.versionNumber).toBe(3);
      expect(result.data.version.content).toContain('Manually Edited');
      expect(result.data.version.createdByType).toBe('user');
    });
  });

  describe('Action: SET_CURRENT', () => {
    it('should SET_CURRENT version (action: set_current)', async () => {
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
    });
  });

  describe('Action: COPY_VERSION', () => {
    it('should COPY a version (action: copy_version)', async () => {
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
      expect(result.data.version.content).toContain('Step three'); // Same as v2
      expect(result.data.version.metadata.copiedFromVersionId).toBe(versionId2);
    });
  });

  describe('Action: DELETE_VERSION', () => {
    it('should DELETE a specific version (action: delete_version)', async () => {
      const result = await service.executeAction(
        'delete_version',
        {
          versionId: versionId2, // Delete v2
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('deleted successfully');

      // Verify version is gone
      const listResult = await service.executeAction(
        'list',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );
      expect(listResult.data.versions.length).toBe(3); // Should have 3 versions now (v1, v3, v4)
    });
  });

  describe('Action: MERGE_VERSIONS', () => {
    it('should MERGE multiple versions (action: merge_versions)', async () => {
      const result = await service.executeAction(
        'merge_versions',
        {
          versionIds: [versionId], // Just use one version for simplicity (no LLM in test)
          mergePrompt: 'Merge these versions',
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.version).toBeDefined();
      expect(result.data.version.metadata.mergedFromVersionIds).toBeDefined();
    });
  });

  describe('Action: DELETE', () => {
    it('should DELETE the entire plan (action: delete)', async () => {
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

      // Verify plan is gone
      const readResult = await service.executeAction(
        'read',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );
      expect(readResult.success).toBe(false);
      expect(readResult.error?.code).toBe('NOT_FOUND');
    });
  });
});
