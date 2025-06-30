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

@Injectable()
export class ProvidersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(status?: ProviderStatus): Promise<ProviderResponseDto[]> {
    const client = this.supabaseService.getClient();
    
    let query = client
      .from('providers')
      .select('*')
      .order('name');

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

    return data || [];
  }

  async findOne(id: string): Promise<ProviderResponseDto | null> {
    const client = this.supabaseService.getClient();
    
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

    return data;
  }

  async findModelsByProvider(
    providerId: string,
    status?: ModelStatus,
  ): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getClient();
    
    let query = client
      .from('models')
      .select(`
        *,
        provider:providers(*)
      `)
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

    return data || [];
  }

  async create(createProviderDto: CreateProviderDto): Promise<ProviderResponseDto> {
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

    const { data, error } = await client
      .from('providers')
      .insert({
        name: createProviderDto.name,
        api_base_url: createProviderDto.api_base_url,
        auth_type: createProviderDto.auth_type,
        status: createProviderDto.status || 'active',
      })
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to create provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
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

    const { data, error } = await client
      .from('providers')
      .update({
        ...updateProviderDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to update provider: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
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

    const { error } = await client
      .from('providers')
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
    const client = this.supabaseService.getClient();
    
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

    return data;
  }

  // Helper method to get all active providers with their models
  async findAllWithModels(): Promise<(ProviderResponseDto & { models: ModelResponseDto[] })[]> {
    const client = this.supabaseService.getClient();
    
    const { data, error } = await client
      .from('providers')
      .select(`
        *,
        models:models(*)
      `)
      .eq('status', 'active')
      .eq('models.status', 'active')
      .order('name');

    if (error) {
      throw new HttpException(
        `Failed to fetch providers with models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data || [];
  }
}