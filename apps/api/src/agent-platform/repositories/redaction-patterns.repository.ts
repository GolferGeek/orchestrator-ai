import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

export interface RedactionPatternRecord {
  id?: string;
  organization_slug: string | null;
  agent_slug?: string | null;
  pattern: string;
  flags?: string | null;
  replacement?: string | null;
  updated_at?: string;
}

@Injectable()
export class RedactionPatternsRepository {
  private readonly logger = new Logger(RedactionPatternsRepository.name);
  private readonly table = 'redaction_patterns';

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async listByOrganization(
    orgSlug: string | null,
  ): Promise<RedactionPatternRecord[]> {
    const client = this.client();
    let q = client.from(this.table).select('*');
    q = orgSlug
      ? q.eq('organization_slug', orgSlug)
      : q.is('organization_slug', null);
    const { data, error } = await q.order('updated_at', {
      ascending: false,
      nullsFirst: false,
    });
    if (error) {
      this.logger.warn(
        `Failed to load redaction patterns for ${orgSlug ?? 'global'}: ${error.message}`,
      );
      return [];
    }
    return (data as RedactionPatternRecord[]) || [];
  }
}
