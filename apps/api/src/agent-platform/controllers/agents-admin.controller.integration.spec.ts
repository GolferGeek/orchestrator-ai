import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentsAdminController } from './agents-admin.controller';
import { SupabaseService } from '@/supabase/supabase.service';
import { AgentValidationService } from '../services/agent-validation.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { AgentDryRunService } from '../services/agent-dry-run.service';
import { AgentPolicyService } from '../services/agent-policy.service';
import { CreateAgentDto, AgentType } from '../dto/agent-admin.dto';

describe('AgentsAdminController (Integration)', () => {
  let controller: AgentsAdminController;
  let supabaseService: SupabaseService;
  let supabaseClient: SupabaseClient;
  let testUserId: string;
  let accessToken: string;

  beforeAll(async () => {
    // Set up environment variables for the test
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
    process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    // Set up the testing module with real services
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      controllers: [AgentsAdminController],
      providers: [
        SupabaseService,
        AgentValidationService,
        AgentsRepository,
        AgentDryRunService,
        AgentPolicyService,
      ],
    }).compile();

    // Initialize the module to trigger onModuleInit
    await module.init();

    controller = module.get<AgentsAdminController>(AgentsAdminController);
    supabaseService = module.get<SupabaseService>(SupabaseService);
    supabaseClient = supabaseService.getServiceClient();

    // Authenticate test user
    const testEmail = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';

    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    testUserId = authData.user!.id;
    accessToken = authData.session!.access_token;
  });

  afterAll(async () => {
    // Clean up test data - delete agents created during tests
    const { error } = await supabaseClient
      .from('agents')
      .delete()
      .or('slug.eq.test_blog_writer,slug.eq.test_hr_assistant,slug.eq.test_function_agent');

    if (error) {
      console.warn('Cleanup warning:', error.message);
    }
  });

  describe('POST /api/admin/agents (upsert)', () => {
    it('should create a new function agent with validation', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_blog_writer',
        display_name: 'Test Blog Writer',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        description: 'Test blog post writer',
        context: {
          system: 'You are a blog post writer.',
        },
        config: {
          configuration: {
            function: {
              timeout_ms: 5000,
              code: `module.exports = async (input, ctx) => {
                const title = input?.title || 'Untitled';
                return { ok: true, format: 'text/markdown', content: \`# \${title}\` };
              }`,
            },
          },
        },
      };

      const result = await controller.upsert(dto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.slug).toBe('test_blog_writer');
      expect(result.data!.agent_type).toBe('function');
      expect(result.data!.config?.configuration?.function?.timeout_ms).toBe(5000);
    });

    it('should create a context agent', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_hr_assistant',
        display_name: 'Test HR Assistant',
        agent_type: AgentType.CONTEXT,
        mode_profile: 'conversation_only',
        yaml: "input_modes: ['text/plain']\noutput_modes: ['text/markdown']\n",
        context: {
          system: 'You are an HR assistant.',
        },
      };

      const result = await controller.upsert(dto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.slug).toBe('test_hr_assistant');
      expect(result.data!.agent_type).toBe('context');
    });

    it('should reject agent with missing input_modes', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_invalid',
        display_name: 'Invalid Agent',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "output_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 5000,
              code: 'module.exports = async (input) => ({ ok: true });',
            },
          },
        },
      };

      const result = await controller.upsert(dto);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.some((i: any) => i.message.includes('input_modes'))).toBe(true);
    });
  });

  describe('POST /api/admin/agents/validate', () => {
    it('should validate function agent with dry-run', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_function_agent',
        display_name: 'Test Function',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 2000,
              code: `module.exports = async (input, ctx) => {
                return { ok: true, result: 'success', format: 'text/plain' };
              }`,
            },
          },
        },
      };

      const result = await controller.validate(dto, 'true');

      expect(result.success).toBe(true);
      expect(result.dryRun).toBeDefined();
      expect(result.dryRun.ok).toBe(true);
      expect(result.dryRun.result?.result).toBe('success');
    });

    it('should validate context agent', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_context',
        display_name: 'Test Context',
        agent_type: AgentType.CONTEXT,
        mode_profile: 'conversation_only',
        yaml: "input_modes: ['text/plain']\noutput_modes: ['text/markdown']\n",
        context: {
          system: 'Test system prompt',
        },
      };

      const result = await controller.validate(dto);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report validation errors for function with excessive timeout', async () => {
      const dto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_timeout',
        display_name: 'Test Timeout',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 60000, // Exceeds policy limit of 30000
              code: 'module.exports = async (input) => ({ ok: true });',
            },
          },
        },
      };

      const result = await controller.validate(dto);

      expect(result.success).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues.some((i: any) => i.message.includes('timeout_ms'))).toBe(true);
    });
  });

  describe('GET /api/admin/agents', () => {
    it('should list agents filtered by type', async () => {
      const result = await controller.list('function');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);

      // All returned agents should be function type
      result.data.forEach((agent: any) => {
        expect(agent.agent_type).toBe('function');
      });
    });

    it('should list all agents when no type filter provided', async () => {
      const result = await controller.list();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('PATCH /api/admin/agents/:id', () => {
    it('should update agent configuration', async () => {
      // First create an agent
      const createDto: CreateAgentDto = {
        organization_slug: 'my-org',
        slug: 'test_patchable',
        display_name: 'Test Patchable',
        agent_type: AgentType.FUNCTION,
        mode_profile: 'draft',
        yaml: "input_modes: ['application/json']\noutput_modes: ['text/markdown']\n",
        config: {
          configuration: {
            function: {
              timeout_ms: 5000,
              code: 'module.exports = async (input) => ({ ok: true, version: 1 });',
            },
          },
        },
      };

      const created = await controller.upsert(createDto);
      expect(created.success).toBe(true);

      const agentId = created.data!.id;

      // Now patch it
      const patchDto = {
        display_name: 'Updated Patchable',
        config: {
          configuration: {
            function: {
              timeout_ms: 3000,
              code: 'module.exports = async (input) => ({ ok: true, version: 2 });',
            },
          },
        },
      };

      const patched = await controller.patch(agentId, patchDto);

      expect(patched.success).toBe(true);
      expect(patched.data.display_name).toBe('Updated Patchable');
      expect(patched.data.config?.configuration?.function?.timeout_ms).toBe(3000);

      // Clean up
      await supabaseClient.from('agents').delete().eq('id', agentId);
    });
  });

  describe('POST /api/admin/agents/smoke-run', () => {
    it('should validate seed payloads from files', async () => {
      const result = await controller.smokeRun();

      // Should succeed or provide detailed issues
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);

      // Check blog_post_writer
      const blogResult = result.results.find((r: any) =>
        r.file.includes('blog_post_writer.json')
      );
      expect(blogResult).toBeDefined();
      if (blogResult.success) {
        expect(blogResult.dryRun?.ok).toBe(true);
      }

      // Check hr_assistant
      const hrResult = result.results.find((r: any) =>
        r.file.includes('hr_assistant.json')
      );
      expect(hrResult).toBeDefined();
      expect(hrResult.success).toBe(true);
    });
  });
});
