/**
 * Plan Execution Service Tests - Error Handling Validation
 * 
 * Tests that the service properly throws descriptive errors for unimplemented features
 * Following CLAUDE.md principles: "ALWAYS ERROR RATHER than create fallbacks"
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PlanExecutionService } from './plan-execution.service';
import { LLMModule } from '../../../../../llms/llm.module';
import { SupabaseModule } from '../../../../../supabase/supabase.module';
import { CIDAFMModule } from '../../../../../cidafm/cidafm.module';
import supabaseConfig from '../../../../../supabase/supabase.config';
import { Project, ProjectStatus } from '../../../../../orchestration/orchestration.types';

describe('PlanExecutionService - Error Handling Validation', () => {
  let service: PlanExecutionService;

  const testProject: Project = {
    id: 'test-project-123',
    conversationId: 'test-conversation',
    status: 'planning' as ProjectStatus,
    planJson: {
      projectName: 'Test Project',
      description: 'A test project',
      steps: [],
      metadata: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            '/Users/golfergeek/projects/golfergeek/orchestrator-ai/.env',
            '../../.env',
            '.env',
          ],
          expandVariables: true,
          load: [supabaseConfig],
        }),
        SupabaseModule,   
        CIDAFMModule,     
        LLMModule,        
      ],
      providers: [PlanExecutionService],
    }).compile();

    service = module.get<PlanExecutionService>(PlanExecutionService);
    await module.init();
  });

  describe('Service Initialization', () => {
    it('should initialize and log warning about incomplete implementation', () => {
      expect(service).toBeDefined();
      // Service should exist but warn about incomplete features
    });
  });

  describe('Error Handling for Unimplemented Features', () => {
    it('should throw descriptive error for startProject', async () => {
      await expect(service.startProject(testProject)).rejects.toThrow(
        /PlanExecutionService\.startProject: Not implemented/
      );
    });

    it('should throw descriptive error for resumeProject', async () => {
      await expect(service.resumeProject('test-id')).rejects.toThrow(
        /PlanExecutionService\.resumeProject: Not implemented/
      );
    });

    it('should throw descriptive error for abortProject', async () => {
      await expect(service.abortProject('test-id')).rejects.toThrow(
        /PlanExecutionService\.abortProject: Not implemented/
      );
    });

    it('should throw descriptive error for retryStep', async () => {
      await expect(service.retryStep('test-project', 'test-step')).rejects.toThrow(
        /PlanExecutionService\.retryStep: Not implemented/
      );
    });
  });

  describe('Error Message Quality', () => {
    it('should provide clear guidance in error messages', async () => {
      try {
        await service.startProject(testProject);
        fail('Expected error to be thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('LangGraph');
        expect(message).toContain('integration');
        expect(message).toContain('real');
        // Message properly states "not a mock" which is good
      }
    });

    it('should explain specific technical issues', async () => {
      try {
        await service.resumeProject('test-id');
        fail('Expected error to be thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Checkpoint system');
        expect(message).toContain('database schema');
      }
    });
  });
});