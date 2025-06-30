import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateModelDto,
  UpdateModelDto,
  ModelResponseDto,
  CostEstimateDto,
  CostEstimateResponseDto,
} from '../dto/llm-evaluation.dto';
import {
  Model,
  ModelStatus,
  CostCalculation,
} from '../types/llm-evaluation';

interface ModelFilters {
  providerId?: string;
  status?: ModelStatus;
  supportsThinking?: boolean;
  includeProvider?: boolean;
}

interface RecommendationFilters {
  useCase: string;
  maxCost?: number;
  minContext?: number;
}

@Injectable()
export class ModelsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(filters: ModelFilters = {}): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getClient();
    
    let query = client
      .from('models')
      .select(
        filters.includeProvider
          ? `*, provider:providers(*)`
          : '*'
      )
      .order('name');

    if (filters.providerId) {
      query = query.eq('provider_id', filters.providerId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.supportsThinking !== undefined) {
      query = query.eq('supports_thinking', filters.supportsThinking);
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

  async findOne(id: string, includeProvider = false): Promise<ModelResponseDto | null> {
    const client = this.supabaseService.getClient();
    
    const { data, error } = await client
      .from('models')
      .select(
        includeProvider
          ? `*, provider:providers(*)`
          : '*'
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
  }

  async findByModelId(
    modelId: string,
    providerId?: string,
  ): Promise<ModelResponseDto | null> {
    const client = this.supabaseService.getClient();
    
    let query = client
      .from('models')
      .select(`*, provider:providers(*)`)
      .eq('model_id', modelId);

    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
  }

  async create(createModelDto: CreateModelDto): Promise<ModelResponseDto> {
    const client = this.supabaseService.getServiceClient();
    
    // Check if provider exists
    const { data: provider } = await client
      .from('providers')
      .select('id')
      .eq('id', createModelDto.provider_id)
      .single();

    if (!provider) {
      throw new HttpException('Provider not found', HttpStatus.NOT_FOUND);
    }

    // Check if model_id already exists for this provider
    const { data: existingModel } = await client
      .from('models')
      .select('id')
      .eq('provider_id', createModelDto.provider_id)
      .eq('model_id', createModelDto.model_id)
      .single();

    if (existingModel) {
      throw new HttpException(
        'Model ID already exists for this provider',
        HttpStatus.CONFLICT,
      );
    }

    const { data, error } = await client
      .from('models')
      .insert({
        provider_id: createModelDto.provider_id,
        name: createModelDto.name,
        model_id: createModelDto.model_id,
        pricing_input_per_1k: createModelDto.pricing_input_per_1k,
        pricing_output_per_1k: createModelDto.pricing_output_per_1k,
        supports_thinking: createModelDto.supports_thinking || false,
        max_tokens: createModelDto.max_tokens,
        context_window: createModelDto.context_window,
        strengths: createModelDto.strengths,
        weaknesses: createModelDto.weaknesses,
        use_cases: createModelDto.use_cases,
        status: createModelDto.status || 'active',
      })
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to create model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
  }

  async update(
    id: string,
    updateModelDto: UpdateModelDto,
  ): Promise<ModelResponseDto | null> {
    const client = this.supabaseService.getServiceClient();
    
    // Check if model exists
    const existing = await this.findOne(id);
    if (!existing) {
      return null;
    }

    // If updating model_id, check for conflicts
    if (updateModelDto.model_id && updateModelDto.model_id !== existing.model_id) {
      const { data: existingModel } = await client
        .from('models')
        .select('id')
        .eq('provider_id', existing.provider_id)
        .eq('model_id', updateModelDto.model_id)
        .neq('id', id)
        .single();

      if (existingModel) {
        throw new HttpException(
          'Model ID already exists for this provider',
          HttpStatus.CONFLICT,
        );
      }
    }

    const { data, error } = await client
      .from('models')
      .update({
        ...updateModelDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to update model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data;
  }

  async delete(id: string): Promise<boolean> {
    const client = this.supabaseService.getServiceClient();
    
    // Check if model exists
    const existing = await this.findOne(id);
    if (!existing) {
      return false;
    }

    // Check if model has any usage in messages
    const { data: messages } = await client
      .from('messages')
      .select('id')
      .eq('model_id', id)
      .limit(1);

    if (messages && messages.length > 0) {
      throw new HttpException(
        'Cannot delete model with existing usage',
        HttpStatus.CONFLICT,
      );
    }

    const { error } = await client
      .from('models')
      .delete()
      .eq('id', id);

    if (error) {
      throw new HttpException(
        `Failed to delete model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return true;
  }

  async estimateCost(costEstimateDto: CostEstimateDto): Promise<CostEstimateResponseDto> {
    const model = await this.findOne(costEstimateDto.model_id, true);
    if (!model) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }

    if (!model.pricing_input_per_1k || !model.pricing_output_per_1k) {
      throw new HttpException(
        'Model pricing information not available',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Simple token estimation (4 characters ≈ 1 token)
    const estimatedInputTokens = Math.ceil(costEstimateDto.content.length / 4);
    const responseLengthFactor = costEstimateDto.response_length_factor || 1.0;
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * responseLengthFactor);

    const estimatedCost = this.calculateCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      model.pricing_input_per_1k,
      model.pricing_output_per_1k,
    );

    const result: CostEstimateResponseDto = {
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: estimatedOutputTokens,
      estimated_cost: estimatedCost.total_cost,
      currency: 'USD',
      model,
    };

    // Add warning for expensive operations
    if (estimatedCost.total_cost > 0.10) {
      result.max_cost_warning = `This operation may cost more than $0.10. Estimated: $${estimatedCost.total_cost.toFixed(4)}`;
    }

    return result;
  }

  async getRecommendations(filters: RecommendationFilters): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getClient();
    
    let query = client
      .from('models')
      .select(`*, provider:providers(*)`)
      .eq('status', 'active')
      .contains('use_cases', [filters.useCase])
      .order('pricing_output_per_1k');

    if (filters.maxCost) {
      query = query.lte('pricing_output_per_1k', filters.maxCost);
    }

    if (filters.minContext) {
      query = query.gte('context_window', filters.minContext);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      throw new HttpException(
        `Failed to get recommendations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data || [];
  }

  // Helper method to calculate costs
  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    inputPricePer1k: number,
    outputPricePer1k: number,
  ): CostCalculation {
    const inputCost = (inputTokens / 1000) * inputPricePer1k;
    const outputCost = (outputTokens / 1000) * outputPricePer1k;
    
    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      input_cost: inputCost,
      output_cost: outputCost,
      total_cost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  // Helper method to get models by provider name
  async findByProviderName(providerName: string): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getClient();
    
    const { data, error } = await client
      .from('models')
      .select(`*, provider:providers(*)`)
      .eq('provider.name', providerName)
      .eq('status', 'active')
      .order('name');

    if (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data || [];
  }
}