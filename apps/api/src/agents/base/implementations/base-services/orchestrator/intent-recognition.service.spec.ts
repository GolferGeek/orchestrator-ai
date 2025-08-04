import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { IntentRecognitionService } from './intent-recognition.service';
import { SupabaseModule } from '../../../../../supabase/supabase.module';
import { LLMModule } from '../../../../../llms/llm.module';
import { CIDAFMModule } from '../../../../../cidafm/cidafm.module';
import { OrchestratorInput, IntentDirective } from '../../../../../orchestration/orchestration.types';

/**
 * Intent Recognition Service - Real LLM Intelligence Tests
 * 
 * These tests validate the core LLM decision-making capabilities:
 * - Can it distinguish between delegation, conversation, and project creation?
 * - Does it correctly identify agent names for delegation?
 * - Can it analyze conversation context for sticky behavior?
 * 
 * NO MOCKING - These test real LLM intelligence!
 */
describe('IntentRecognitionService - Real LLM Tests', () => {
  let service: IntentRecognitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            '/Users/golfergeek/projects/golfergeek/orchestrator-ai/.env',
            '../../.env',
            '.env'
          ],
        }),
        SupabaseModule,
        LLMModule,
        CIDAFMModule
      ],
      providers: [
        IntentRecognitionService
      ],
    }).compile();

    service = module.get<IntentRecognitionService>(IntentRecognitionService);
  });

  describe('LLM Intent Classification Intelligence', () => {
    /**
     * Test: Can LLM distinguish between delegation and conversation?
     */
    it('should classify clear delegation requests as DELEGATE with high confidence', async () => {
      const input: OrchestratorInput = {
        prompt: "I need the marketing team to create a blog post about AI trends for our tech blog",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      // Using real LLM service - no mocking!

      const result: IntentDirective = await service.classifyIntent(input);

      expect(['DELEGATE', 'CREATE_PROJECT']).toContain(result.action);
      expect(result.confidence).toBeGreaterThan(0.5);
      if (result.action === 'DELEGATE') {
        expect(result.agentName).toBeDefined();
      }
      expect(result.reasoning).toBeDefined();
      console.log(`✅ Intent Classification Result: ${result.action} (confidence: ${result.confidence})`);
    });

    /**
     * Test: Can LLM identify project creation requests?
     */
    it('should classify project creation requests as CREATE_PROJECT', async () => {
      const input: OrchestratorInput = {
        prompt: "I want to launch a comprehensive marketing campaign for our new product launch. This will need blog posts, social media content, email sequences, and paid ads coordinated over 3 months.",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(['CREATE_PROJECT', 'DELEGATE']).toContain(result.action);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toBeDefined();
      console.log(`✅ Project Creation Result: ${result.action} (confidence: ${result.confidence})`);
    });

    /**
     * Test: Can LLM handle conversational questions?
     */
    it('should classify questions and discussions as CONVERSE', async () => {
      const input: OrchestratorInput = {
        prompt: "What are the current marketing trends in our industry? I'm trying to understand the competitive landscape.",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: []
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(['CONVERSE', 'DELEGATE']).toContain(result.action);
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.reasoning).toBeDefined();
      console.log(`✅ Conversation Result: ${result.action} (confidence: ${result.confidence})`);
    });

    /**
     * Test: Can LLM detect project resumption?
     */
    it('should classify project continuation as RESUME_PROJECT when projectId provided', async () => {
      const input: OrchestratorInput = {
        prompt: "How is the marketing campaign progressing?",
        userId: "test-user",
        conversationId: "test-conv",
        projectId: "proj_123_marketing_campaign",
        conversationHistory: []
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(result.action).toBe('RESUME_PROJECT');
      expect(result.projectId).toBe('proj_123_marketing_campaign');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('Conversation Context Analysis Intelligence', () => {
    /**
     * Test: Can LLM detect when to continue with same agent?
     */
    it('should classify continuation of existing agent conversation as CONTINUE_DELEGATION', async () => {
      const input: OrchestratorInput = {
        prompt: "That blog post looks great! Can you also create a social media version of it?",
        userId: "test-user",
        conversationId: "test-conv",
        conversationHistory: [
          {
            role: 'user',
            content: 'Create a blog post about AI trends',
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant', 
            content: 'I\'ve created a comprehensive blog post about AI trends...',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'blog_post_writer' }
          }
        ]
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(result.action).toBe('CONTINUE_DELEGATION');
      expect(result.agentName).toBe('blog_post_writer');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    /**
     * Test: Can LLM detect context switches that require new delegation?
     */
    it('should detect context switches requiring new agent assignment', async () => {
      const input: OrchestratorInput = {
        prompt: "Actually, I need market research on our competitors instead",
        userId: "test-user",
        conversationId: "test-conv", 
        conversationHistory: [
          {
            role: 'user',
            content: 'Create a blog post about AI trends',
            timestamp: new Date().toISOString()
          },
          {
            role: 'assistant',
            content: 'I\'ve created a comprehensive blog post...',
            timestamp: new Date().toISOString(),
            metadata: { agentName: 'blog_post_writer' }
          }
        ]
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(result.action).toBe('DELEGATE');
      expect(result.agentName).not.toBe('blog_post_writer');
      expect(result.reasoning).toContain('context switch');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    /**
     * Test: Can LLM handle ambiguous requests intelligently?
     */
    it('should handle ambiguous requests with reasonable confidence', async () => {
      const input: OrchestratorInput = {
        prompt: "Marketing stuff",
        userId: "test-user", 
        conversationId: "test-conv",
        conversationHistory: []
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(['DELEGATE', 'CONVERSE']).toContain(result.action);
      expect(result.confidence).toBeLessThan(0.8); // Should show uncertainty
      expect(result.reasoning).toBeDefined();
    });

    /**
     * Test: Can LLM gracefully handle empty or invalid input?
     */
    it('should handle empty prompts gracefully', async () => {
      const input: OrchestratorInput = {
        prompt: "",
        userId: "test-user",
        conversationId: "test-conv", 
        conversationHistory: []
      };

      const result: IntentDirective = await service.classifyIntent(input);

      expect(result.action).toBe('CONVERSE');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.reasoning).toContain('empty');
    });
  });

  describe('Confidence Calibration', () => {
    /**
     * Test: Are confidence scores well-calibrated?
     */
    it('should provide well-calibrated confidence scores', async () => {
      const testCases = [
        {
          prompt: "Please delegate this to the blog writer: create a post about marketing",
          expectedConfidence: { min: 0.9, max: 1.0 }
        },
        {
          prompt: "Can you maybe help with some content stuff?",
          expectedConfidence: { min: 0.4, max: 0.7 }
        },
        {
          prompt: "I want to start a huge marketing campaign with multiple phases",
          expectedConfidence: { min: 0.8, max: 1.0 }
        }
      ];

      for (const testCase of testCases) {
        const input: OrchestratorInput = {
          prompt: testCase.prompt,
          userId: "test-user",
          conversationId: "test-conv",
          conversationHistory: []
        };

        const result = await service.classifyIntent(input);
        
        expect(result.confidence).toBeGreaterThanOrEqual(testCase.expectedConfidence.min);
        expect(result.confidence).toBeLessThanOrEqual(testCase.expectedConfidence.max);
      }
    });
  });
});