import { Body, Controller, Get, Patch, Query, Param, Post } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { AdminOnly } from '@/auth/decorators/roles.decorator';
import { CreateAgentDto, UpdateAgentDto } from '../dto/agent-admin.dto';
import { AgentValidationService } from '../services/agent-validation.service';
import { AgentsRepository } from '../repositories/agents.repository';
import { AgentDryRunService } from '../services/agent-dry-run.service';
import { AgentPolicyService } from '../services/agent-policy.service';

@Controller('api/admin/agents')
export class AgentsAdminController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly validator: AgentValidationService,
    private readonly agents: AgentsRepository,
    private readonly dryRun: AgentDryRunService,
    private readonly policy: AgentPolicyService,
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

  @Patch(':id')
  @AdminOnly()
  async update(@Param('id') id: string, @Body() body: any) {
    // Update config.function.code (and timeout) if provided
    const { function: fn } = body?.configuration || body || {};
    const { data: current, error: ferr } = await this.supabase
      .getServiceClient()
      .from('agents')
      .select('config, yaml')
      .eq('id', id)
      .maybeSingle();
    if (ferr) throw new Error(ferr.message);
    const config = current?.config || {};
    const conf = { ...(config.configuration || {}), function: { ...((config.configuration || {}).function || {}), ...(fn || {}) } };
    const nextConfig = { ...config, configuration: conf };
    const { data, error } = await this.supabase
      .getServiceClient()
      .from('agents')
      .update({ config: nextConfig })
      .eq('id', id)
      .select('*')
      .single();
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
      status: null,
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
}
