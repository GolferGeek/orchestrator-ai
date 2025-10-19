import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderResponseDto,
  ModelResponseDto,
  ProviderNameDto,
  ProviderWithModelsDto,
} from '@/llms/dto/llm-evaluation.dto';
import { ProviderStatus, ModelStatus } from '@/llms/types/llm-evaluation';
import {
  mapLLMProviderFromDb,
  mapLLMModelFromDb,
} from '@/utils/case-converter';
import { getTableName } from '@/supabase/supabase.config';

@Injectable()
export class ProvidersService {
  private readonly providerNamesCache = new Map<
    string,
    { data: ProviderNameDto[]; timestamp: number }
  >();
  private readonly providersWithModelsCache = new Map<
    string,
    { data: ProviderWithModelsDto[]; timestamp: number }
  >();
  private readonly cacheExpirationMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAllNames(status?: ProviderStatus): Promise<ProviderNameDto[]> {
    const cacheKey = `names:${status || 'all'}`;
    const cached = this.providerNamesCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpirationMs) {
      return cached.data;
    }

    const client = this.supabaseService.getServiceClient();

    let query = client
      .from(getTableName('llm_providers'))
      .select('name')
      .order('name');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch provider names: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const rows = data as Array<{ name: string }> | null;
    const result = (rows || []).map((row) => ({ name: row.name }));

    // Cache the result
    this.providerNamesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  async findAllWithModels(
    status?: ProviderStatus,
    sovereignMode?: boolean,
  ): Promise<ProviderWithModelsDto[]> {
    const cacheKey = `with-models:${status || 'all'}:${sovereignMode || 'false'}`;
    const cached = this.providersWithModelsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpirationMs) {
      return cached.data;
    }

    const client = this.supabaseService.getServiceClient();

    // First get providers
    let providerQuery = client
      .from(getTableName('llm_providers'))
      .select('name')
      .order('name');

    if (status) {
      providerQuery = providerQuery.eq('status', status);
    }

    const { data: providers, error: providerError } = await providerQuery;

    if (providerError) {
      throw new HttpException(
        `Failed to fetch providers: ${providerError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Then get models for each provider
    const result: ProviderWithModelsDto[] = [];

    for (const provider of providers || []) {
      let modelQuery = client
        .from(getTableName('llm_models'))
        .select('provider_name, model_name, display_name')
        .eq('provider_name', provider.name)
        .eq('is_active', true)
        .order('display_name');

      if (sovereignMode) {
        // In sovereign mode, only show local models (ollama - case insensitive)
        modelQuery = modelQuery.ilike('provider_name', 'ollama');
      }

      const { data: models, error: modelError } = await modelQuery;

      if (modelError) {
        throw new HttpException(
          `Failed to fetch models for provider ${provider.name}: ${modelError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      result.push({
        providerName: provider.name,
        models: (models || []).map((model) => ({
          providerName: model.provider_name,
          modelName: model.model_name,
          displayName: model.display_name,
        })),
      });
    }

    // Cache the result
    this.providersWithModelsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  async findAll(
    status?: ProviderStatus,
    sovereignMode?: boolean,
  ): Promise<ProviderResponseDto[]> {
    // Try service client first to bypass RLS
    const client = this.supabaseService.getServiceClient();

    let query = client
      .from(getTableName('llm_providers'))
      .select('*')
      .order('name');

    if (status) {
      query = query.eq('status', status);
    }

    if (sovereignMode) {
      // In sovereign mode, only show local providers (Ollama - case insensitive)
      query = query.ilike('name', 'ollama');
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch providers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []).map(mapLLMProviderFromDb);
  }

  async findOne(id: string): Promise<ProviderResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from(getTableName('llm_providers'))
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

    return data ? mapLLMProviderFromDb(data) : null;
  }

  async findModelsByProvider(
    providerId: string,
    status?: ModelStatus,
  ): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getAnonClient();

    let query = client
      .from(getTableName('llm_models'))
      .select(
        `
        *,
        provider:llm_providers(*)
      `,
      )
      .eq('provider_id', providerId)
      .order('display_name');

    if (status) {
      const isActive = status === 'active';
      query = query.eq('is_active', isActive);
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []).map(mapLLMModelFromDb);
  }

  async create(
    createProviderDto: CreateProviderDto,
  ): Promise<ProviderResponseDto> {
    const client = this.supabaseService.getServiceClient();

    // Check if provider name already exists
    const { data: existingProvider } = await client
      .from(getTableName('llm_providers'))
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
      .from(getTableName('llm_providers'))
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to create provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return mapLLMProviderFromDb(data);
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
        .from(getTableName('llm_providers'))
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
    if (updateProviderDto.name !== undefined)
      dbPayload.name = updateProviderDto.name;
    if (updateProviderDto.apiBaseUrl !== undefined)
      dbPayload.api_base_url = updateProviderDto.apiBaseUrl;
    if (updateProviderDto.authType !== undefined)
      dbPayload.auth_type = updateProviderDto.authType;
    if (updateProviderDto.status !== undefined)
      dbPayload.status = updateProviderDto.status;
    dbPayload.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from(getTableName('llm_providers'))
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

    return mapLLMProviderFromDb(data);
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
      .from(getTableName('llm_models'))
      .select('id')
      .eq('provider_id', id)
      .limit(1);

    if (models && models.length > 0) {
      throw new HttpException(
        'Cannot delete provider with existing models',
        HttpStatus.CONFLICT,
      );
    }

    const { error } = await client
      .from(getTableName('llm_providers'))
      .delete()
      .eq('id', id);

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
      .from(getTableName('llm_providers'))
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

    return data ? mapLLMProviderFromDb(data) : null;
  }
}
