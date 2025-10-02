import { Body, Controller, Get, Patch, Query, Param, Post, Req } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { AdminOnly } from '@/auth/decorators/roles.decorator';
import { CreateAgentDto, UpdateAgentDto } from '../dto/agent-admin.dto';
import { AgentValidationService } from '../services/agent-validation.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { AgentDryRunService } from '../services/agent-dry-run.service';
import { AgentPolicyService } from '../services/agent-policy.service';
import { AgentPromotionService } from '../services/agent-promotion.service';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

@Controller('api/admin/agents')
export class AgentsAdminController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly validator: AgentValidationService,
    private readonly agents: AgentsRepository,
    private readonly dryRun: AgentDryRunService,
    private readonly policy: AgentPolicyService,
    private readonly promotion: AgentPromotionService,
  ) {}

  @Get()
  @AdminOnly()
  async list(@Query('type') type?: string) {
    let q = this.supabase.getServiceClient().from('agents').select('*');
    if (type) q = q.eq('agent_type', type);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { success: true, data };
  }

  @Post()
  @AdminOnly()
  async upsert(@Body() dto: CreateAgentDto) {
    // Run JSON-schema validation by type
    const type = dto.agent_type as any;
    const { ok, issues } = this.validator.validateByType(type, dto as any);
    const policyIssues = this.policy.check(dto);
    if (!ok || policyIssues.length) {
      return { success: false, issues: [...issues, ...policyIssues] };
    }

    // Normalize null org when empty string
    const organization_slug = dto.organization_slug ?? null;

    const record = await this.agents.upsert({
      organization_slug,
      slug: dto.slug,
      display_name: dto.display_name,
      description: dto.description ?? null,
      agent_type: dto.agent_type,
      mode_profile: dto.mode_profile,
      version: null,
      status: dto.status ?? null,
      yaml: dto.yaml ?? '',
      agent_card: dto.agent_card ?? null,
      context: dto.context ?? null,
      config: dto.config ?? null,
    });

    return { success: true, data: record };
  }

  @Post('validate')
  @AdminOnly()
  async validate(@Body() dto: CreateAgentDto, @Query('dryRun') dryRun?: string) {
    const type = dto.agent_type as any;
    const validation = this.validator.validateByType(type, dto as any);
    const policyIssues = this.policy.check(dto);

    const response: any = { success: validation.ok && policyIssues.length === 0, issues: [...validation.issues, ...policyIssues] };
    const wantsDryRun = (dryRun || '').toString().toLowerCase() === 'true';
    if (validation.ok && wantsDryRun && type === 'function') {
      const code = (dto as any)?.config?.configuration?.function?.code as string | undefined;
      const timeout = Number((dto as any)?.config?.configuration?.function?.timeout_ms) || 2000;
      if (code && code.length < 50000) {
        response.dryRun = await this.dryRun.runFunction(code, {}, timeout);
      } else {
        response.dryRun = { ok: false, error: 'No code provided or code too large for dry-run' };
      }
    }
    if (validation.ok && wantsDryRun && type === 'api') {
      const apiCfg = (dto as any)?.config?.configuration?.api?.api_configuration;
      if (apiCfg) {
        const sampleInput = (dto as any)?.config?.configuration?.api?.sample_input || { sessionId: 'dryrun', userMessage: 'hello' };
        const sampleResp = (dto as any)?.config?.configuration?.api?.sample_response || { output: 'dry-run-ok' };
        response.dryRun = await this.dryRun.runApiTransform(apiCfg, sampleInput, sampleResp);
      } else {
        response.dryRun = { ok: false, error: 'No api_configuration provided for dry-run' };
      }
    }
    return response;
  }

  @Patch(':id')
  @AdminOnly()
  async patch(@Param('id') id: string, @Body() body: UpdateAgentDto) {
    // Load current to determine type for validation
    const { data: current, error } = await this.supabase
      .getServiceClient()
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!current) throw new Error('Agent not found');

    const next = {
      display_name: body.display_name ?? current.display_name,
      mode_profile: body.mode_profile ?? current.mode_profile,
      yaml: body.yaml ?? current.yaml,
      description: body.description ?? current.description,
      agent_card: body.agent_card ?? current.agent_card,
      context: body.context ?? current.context,
      config: body.config ?? current.config,
    };

    // Validate merged payload
    const createLike = {
      organization_slug: current.organization_slug,
      slug: current.slug,
      display_name: next.display_name,
      agent_type: current.agent_type,
      mode_profile: next.mode_profile,
      yaml: next.yaml,
      description: next.description,
      agent_card: next.agent_card,
      context: next.context,
      config: next.config,
    } as CreateAgentDto;

    const validation = this.validator.validateByType(current.agent_type, createLike as any);
    const policyIssues = this.policy.check(createLike);
    if (!validation.ok || policyIssues.length) {
      return { success: false, issues: [...validation.issues, ...policyIssues] };
    }

    const { data: updated, error: uerr } = await this.supabase
      .getServiceClient()
      .from('agents')
      .update(next)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (uerr) throw new Error(uerr.message);
    return { success: true, data: updated };
  }

  @Post('smoke-run')
  @AdminOnly()
  async smokeRun() {
    const root = resolve(__dirname, '../../../../..');
    const files = [
      resolve(root, 'docs/feature/matt/payloads/blog_post_writer.json'),
      resolve(root, 'docs/feature/matt/payloads/hr_assistant.json'),
      resolve(root, 'docs/feature/matt/payloads/agent_builder_orchestrator.json'),
    ];

    const results: any[] = [];
    for (const f of files) {
      try {
        const raw = await readFile(f, 'utf8');
        const dto = JSON.parse(raw);
        const type = dto.agent_type as any;
        const validation = this.validator.validateByType(type, dto as any);
        const policyIssues = this.policy.check(dto);
        const item: any = {
          file: f,
          success: validation.ok && policyIssues.length === 0,
          issues: [...validation.issues, ...policyIssues],
        };
        if (item.success) {
          if (type === 'function') {
            const code = dto?.config?.configuration?.function?.code as string | undefined;
            if (code) {
              item.dryRun = await this.dryRun.runFunction(
                code,
                { title: 'Smoke Test', outline: ['Intro', 'Body', 'Conclusion'] },
                Number(dto?.config?.configuration?.function?.timeout_ms) || 1000,
              );
            }
          } else if (type === 'api') {
            const apiCfg = dto?.config?.configuration?.api?.api_configuration;
            if (apiCfg) {
              item.dryRun = await this.dryRun.runApiTransform(
                apiCfg,
                dto?.config?.configuration?.api?.sample_input || { sessionId: 'dryrun', userMessage: 'hello' },
                dto?.config?.configuration?.api?.sample_response || { output: 'ok' },
              );
            }
          }
        }
        results.push(item);
      } catch (e: any) {
        results.push({ file: f, success: false, issues: [{ message: e?.message || String(e) }] });
      }
    }

    const allOk = results.every((r) => r.success && (!r.dryRun || r.dryRun.ok !== false));
    return { success: allOk, results };
  }

  // === Promotion Endpoints ===

  @Post(':id/promote')
  @AdminOnly()
  async requestPromotion(
    @Param('id') id: string,
    @Body() body: { requireApproval?: boolean; skipValidation?: boolean },
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId || null;
    const result = await this.promotion.requestPromotion(id, {
      requireApproval: body.requireApproval,
      skipValidation: body.skipValidation,
      requestedBy: userId,
    });
    return result;
  }

  @Post(':id/demote')
  @AdminOnly()
  async demote(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const result = await this.promotion.demote(id, body.reason);
    return result;
  }

  @Post(':id/archive')
  @AdminOnly()
  async archive(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const result = await this.promotion.archive(id, body.reason);
    return result;
  }

  @Get(':id/promotion-requirements')
  @AdminOnly()
  async getPromotionRequirements(@Param('id') id: string) {
    const requirements = await this.promotion.getPromotionRequirements(id);
    return { success: true, data: requirements };
  }
}
