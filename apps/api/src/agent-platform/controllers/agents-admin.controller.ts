import { Body, Controller, Get, Patch, Query, Param } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

@Controller('api/admin/agents')
export class AgentsAdminController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async list(@Query('type') type?: string) {
    let q = this.supabase.getServiceClient().from('agents').select('*');
    if (type) q = q.eq('agent_type', type);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { success: true, data };
  }

  @Patch(':id')
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
}

