import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderResponseDto,
  ModelResponseDto,
} from '../dto/llm-evaluation.dto';
import {
  Provider,
  Model,
  ProviderStatus,
  ModelStatus,
} from '../types/llm-evaluation';
import {
  mapProviderFromDb,
  mapProviderToDb,
  mapModelFromDb,
} from '../utils/case-converter';

@Injectable()
export class ProvidersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(status?: ProviderStatus): Promise<ProviderResponseDto[]> {
    // Try service client first to bypass RLS
    const client = this.supabaseService.getServiceClient();

    let query = client.from('providers').select('*').order('name');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch providers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []).map(mapProviderFromDb);
  }

  async findOne(id: string): Promise<ProviderResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data ? mapProviderFromDb(data) : null;
  }

  async findModelsByProvider(
    providerId: string,
    status?: ModelStatus,
  ): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getAnonClient();

    let query = client
      .from('models')
      .select(
        `
        *,
        provider:providers(*)
      `,
      )
      .eq('provider_id', providerId)
      .order('name');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []).map(mapModelFromDb);
  }

  async create(
    createProviderDto: CreateProviderDto,
  ): Promise<ProviderResponseDto> {
    const client = this.supabaseService.getServiceClient();

    // Check if provider name already exists
    const { data: existingProvider } = await client
      .from('providers')
      .select('id')
      .eq('name', createProviderDto.name)
      .single();

    if (existingProvider) {
      throw new HttpException(
        'Provider name already exists',
        HttpStatus.CONFLICT,
      );
    }

    const dbPayload = {
      name: createProviderDto.name,
      api_base_url: createProviderDto.apiBaseUrl,
      auth_type: createProviderDto.authType,
      status: createProviderDto.status || 'active',
    };

    const { data, error } = await client
      .from('providers')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to create provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return mapProviderFromDb(data);
  }

  async update(
    id: string,
    updateProviderDto: UpdateProviderDto,
  ): Promise<ProviderResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    // Check if provider exists
    const existing = await this.findOne(id);
    if (!existing) {
      return null;
    }

    // If updating name, check for conflicts
    if (updateProviderDto.name && updateProviderDto.name !== existing.name) {
      const { data: existingProvider } = await client
        .from('providers')
        .select('id')
        .eq('name', updateProviderDto.name)
        .neq('id', id)
        .single();

      if (existingProvider) {
        throw new HttpException(
          'Provider name already exists',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Convert camelCase DTO to snake_case for database
    const dbPayload: any = {};
    if (updateProviderDto.name !== undefined) dbPayload.name = updateProviderDto.name;
    if (updateProviderDto.apiBaseUrl !== undefined) dbPayload.api_base_url = updateProviderDto.apiBaseUrl;
    if (updateProviderDto.authType !== undefined) dbPayload.auth_type = updateProviderDto.authType;
    if (updateProviderDto.status !== undefined) dbPayload.status = updateProviderDto.status;
    dbPayload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('providers')
      .update(dbPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to update provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return mapProviderFromDb(data);
  }

  async delete(id: string): Promise<boolean> {
    const client = this.supabaseService.getServiceClient();

    // Check if provider exists
    const existing = await this.findOne(id);
    if (!existing) {
      return false;
    }

    // Check if provider has any models
    const { data: models } = await client
      .from('models')
      .select('id')
      .eq('provider_id', id)
      .limit(1);

    if (models && models.length > 0) {
      throw new HttpException(
        'Cannot delete provider with existing models',
        HttpStatus.CONFLICT,
      );
    }

    const { error } = await client.from('providers').delete().eq('id', id);

    if (error) {
      throw new HttpException(
        `Failed to delete provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return true;
  }

  // Helper method to get provider by name
  async findByName(name: string): Promise<ProviderResponseDto | null> {
    const client = this.supabaseService.getAnonClient();

    const { data, error } = await client
      .from('providers')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data ? mapProviderFromDb(data) : null;
  }

  // Helper method to get all active providers with their models
  async findAllWithModels(): Promise<
    (ProviderResponseDto & { models: ModelResponseDto[] })[]
  > {
    const client = this.supabaseService.getAnonClient();

    const { data, error } = await client
      .from('providers')
      .select(
        `
        *,
        models:models(*)
      `,
      )
      .eq('status', 'active')
      .eq('models.status', 'active')
      .order('name');

    if (error) {
      throw new HttpException(
        `Failed to fetch providers with models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []).map((provider: any) => ({
      ...mapProviderFromDb(provider),
      models: (provider.models || []).map(mapModelFromDb),
    }));
  }
}
