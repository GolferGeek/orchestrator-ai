import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';

export interface AssetRecord {
  id: string;
  storage: 'local' | 'supabase';
  path?: string | null;
  bucket?: string | null;
  object_key?: string | null;
  source_url?: string | null;
  mime: string;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  hash?: string | null;
  user_id?: string | null;
  conversation_id?: string | null;
  deliverable_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class AssetsRepository {
  private readonly logger = new Logger(AssetsRepository.name);
  private readonly table = 'assets';

  constructor(private readonly supabase: SupabaseService) {}

  private client() {
    return this.supabase.getServiceClient();
  }

  async get(id: string): Promise<AssetRecord | null> {
    const { data, error } = (await this.client()
      .from(this.table)
      .select('*')
      .eq('id', id)
      .maybeSingle()) as {
      data: AssetRecord | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(`Failed to fetch asset: ${error.message}`);
    return (data as AssetRecord) || null;
  }

  async create(
    input: Omit<AssetRecord, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<AssetRecord> {
    const { data, error } = (await this.client()
      .from(this.table)
      .insert(input)
      .select('*')
      .single()) as {
      data: AssetRecord | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(`Failed to create asset: ${error.message}`);
    return data as AssetRecord;
  }
}
