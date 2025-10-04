/**
 * Plans Integration Test
 * Tests the complete mode × action architecture for plans
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './services/plans.service';
import { PlanVersionsService } from './services/plan-versions.service';
import { PlansRepository } from './repositories/plans.repository';
import { PlanVersionsRepository } from './repositories/plan-versions.repository';
import { SupabaseModule } from '@/supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';

describe('PlansService Integration (executeAction)', () => {
  let service: PlansService;
  let module: TestingModule;

  const testUserId = 'test-user-123';
  const testConversationId = 'conv-' + Date.now();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
  });

  afterAll(async () => {
    // Cleanup: delete test plan
    try {
      await service.executeAction(
        'delete',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );
    } catch (error) {
      // Ignore if already deleted
    }

    await module.close();
  });

  describe('executeAction() - mode × action routing', () => {
    let createdPlanId: string;
    let versionId: string;

    it('should CREATE a new plan (action: create)', async () => {
      const result = await service.executeAction(
        'create',
        {
          title: 'Test Blog Post Plan',
          content: '# Blog Post Plan\n\n1. Research topic\n2. Write outline\n3. Draft content',
          format: 'markdown',
          agentName: 'blog_post_writer',
          namespace: 'test',
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('plan');
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('isNew');
      expect(result.data.isNew).toBe(true);
      expect(result.data.plan.title).toBe('Test Blog Post Plan');
      expect(result.data.version.content).toContain('Research topic');

      createdPlanId = result.data.plan.id;
      versionId = result.data.version.id;
    });

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
      expect(result.data.id).toBe(createdPlanId);
      expect(result.data.currentVersion).toBeDefined();
      expect(result.data.currentVersion.content).toContain('Research topic');
    });

    it('should REFINE the plan (action: create again)', async () => {
      const result = await service.executeAction(
        'create',
        {
          title: 'Test Blog Post Plan',
          content: '# Blog Post Plan v2\n\n1. Research topic deeply\n2. Create detailed outline\n3. Draft and revise content',
          format: 'markdown',
          agentName: 'blog_post_writer',
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.isNew).toBe(false); // Refinement, not new
      expect(result.data.version.versionNumber).toBe(2);
      expect(result.data.version.content).toContain('Research topic deeply');
    });

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

    it('should EDIT the plan manually (action: edit)', async () => {
      const result = await service.executeAction(
        'edit',
        {
          content: '# Blog Post Plan - Manually Edited\n\n1. User made changes\n2. New direction',
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

    it('should SET_CURRENT version (action: set_current)', async () => {
      const result = await service.executeAction(
        'set_current',
        {
          versionId: versionId, // Set back to version 1
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.version.id).toBe(versionId);
      expect(result.data.version.isCurrentVersion).toBe(true);
    });

    it('should COPY a version (action: copy_version)', async () => {
      const result = await service.executeAction(
        'copy_version',
        {
          versionId: versionId,
        },
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.version.versionNumber).toBe(4);
      expect(result.data.version.content).toContain('Research topic'); // Same as v1
      expect(result.data.version.metadata.copiedFromVersionId).toBe(versionId);
    });

    it('should handle INVALID action gracefully', async () => {
      const result = await service.executeAction(
        'invalid_action',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unknown plan action');
    });

    it('should DELETE the plan (action: delete)', async () => {
      const result = await service.executeAction(
        'delete',
        {},
        {
          conversationId: testConversationId,
          userId: testUserId,
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
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
