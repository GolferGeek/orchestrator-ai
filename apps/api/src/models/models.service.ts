import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateModelDto,
  UpdateModelDto,
  ModelResponseDto,
  CostEstimateDto,
  CostEstimateResponseDto,
} from '../dto/llm-evaluation.dto';
import { ModelStatus, CostCalculation } from '../types/llm-evaluation';
import { mapModelFromDb, mapLLMModelFromDb } from '../utils/case-converter';
import { getTableName } from '../supabase/supabase.config';

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
    const client = this.supabaseService.getServiceClient();

    console.log(`[ModelsService] findAll called with filters:`, filters);

    let query = client
      .from(getTableName('llm_models'))
      .select(filters.includeProvider ? `*, provider:llm_providers(*)` : '*')
      .order('display_name');

    if (filters.providerId) {
      query = query.eq('provider_id', filters.providerId);
    }

    if (filters.status) {
      const isActive = filters.status === 'active';
      query = query.eq('is_active', isActive);
    }

    if (filters.supportsThinking !== undefined) {
      // Filter by capabilities array containing 'reasoning'
      if (filters.supportsThinking) {
        query = query.contains('capabilities', ['reasoning']);
      } else {
        query = query.not('capabilities', 'cs', ['reasoning']);
      }
    }

    console.log(`[ModelsService] About to execute query...`);
    const { data, error } = await query;

    console.log(`[ModelsService] Query result:`, {
      dataLength: data?.length || 0,
      error: error?.message,
      sampleData: data?.[0],
    });

    if (error) {
      console.error(`[ModelsService] Database error:`, error);
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    console.log(
      `[ModelsService] About to map models using mapLLMModelFromDb...`,
    );
    try {
      const mappedModels = (data || []).map((model: any) => {
        console.log(`[ModelsService] Mapping model: ${model.display_name}`);
        return mapLLMModelFromDb(model);
      });
      console.log(
        `[ModelsService] Successfully mapped ${mappedModels.length} models`,
      );
      return mappedModels;
    } catch (mappingError) {
      console.error(`[ModelsService] Mapping error:`, mappingError);
      const errorMessage =
        mappingError instanceof Error
          ? mappingError.message
          : 'Unknown mapping error';
      throw new HttpException(
        `Failed to process models: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(
    id: string,
    includeProvider = false,
  ): Promise<ModelResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from(getTableName('llm_models'))
      .select(includeProvider ? `*, provider:llm_providers(*)` : '*')
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

    return data ? mapLLMModelFromDb(data) : null;
  }

  async findByModelId(
    modelId: string,
    providerId?: string,
  ): Promise<ModelResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    let query = client
      .from(getTableName('llm_models'))
      .select(`*, provider:llm_providers(*)`)
      .eq('model_name', modelId);

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

    return data ? mapLLMModelFromDb(data) : null;
  }

  async create(createModelDto: CreateModelDto): Promise<ModelResponseDto> {
    const client = this.supabaseService.getServiceClient();

    // Check if provider exists
    const { data: provider } = await client
      .from(getTableName('llm_providers'))
      .select('id')
      .eq('id', createModelDto.providerId)
      .single();

    if (!provider) {
      throw new HttpException('Provider not found', HttpStatus.NOT_FOUND);
    }

    // Check if model_id already exists for this provider
    const { data: existingModel } = await client
      .from(getTableName('llm_models'))
      .select('id')
      .eq('provider_id', createModelDto.providerId)
      .eq('model_name', createModelDto.modelId)
      .single();

    if (existingModel) {
      throw new HttpException(
        'Model ID already exists for this provider',
        HttpStatus.CONFLICT,
      );
    }

    const { data, error } = await client
      .from(getTableName('llm_models'))
      .insert({
        provider_id: createModelDto.providerId,
        display_name: createModelDto.name,
        model_name: createModelDto.modelId,
        pricing_info_json: {
          input_cost_per_token: (createModelDto.pricingInputPer1k || 0) / 1000,
          output_cost_per_token:
            (createModelDto.pricingOutputPer1k || 0) / 1000,
        },
        capabilities: createModelDto.supportsThinking ? ['reasoning'] : [],
        max_output_tokens: createModelDto.maxTokens,
        context_window: createModelDto.contextWindow,
        is_active: createModelDto.status !== 'inactive',
      })
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to create model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return mapLLMModelFromDb(data);
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
    if (updateModelDto.modelId && updateModelDto.modelId !== existing.modelId) {
      const { data: existingModel } = await client
        .from(getTableName('llm_models'))
        .select('id')
        .eq('provider_id', existing.providerId)
        .eq('model_name', updateModelDto.modelId)
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
      .from(getTableName('llm_models'))
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

    return mapLLMModelFromDb(data);
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
      .from(getTableName('messages'))
      .select('id')
      .eq('model_id', id)
      .limit(1);

    if (messages && messages.length > 0) {
      throw new HttpException(
        'Cannot delete model with existing usage',
        HttpStatus.CONFLICT,
      );
    }

    const { error } = await client.from(getTableName('llm_models')).delete().eq('id', id);

    if (error) {
      throw new HttpException(
        `Failed to delete model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return true;
  }

  async estimateCost(
    costEstimateDto: CostEstimateDto,
  ): Promise<CostEstimateResponseDto> {
    const model = await this.findOne(costEstimateDto.modelId, true);
    if (!model) {
      throw new HttpException('Model not found', HttpStatus.NOT_FOUND);
    }

    if (!model.pricingInputPer1k || !model.pricingOutputPer1k) {
      throw new HttpException(
        'Model pricing information not available',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Simple token estimation (4 characters ≈ 1 token)
    const estimatedInputTokens = Math.ceil(costEstimateDto.content.length / 4);
    const responseLengthFactor = costEstimateDto.responseLengthFactor || 1.0;
    const estimatedOutputTokens = Math.ceil(
      estimatedInputTokens * responseLengthFactor,
    );

    const estimatedCost = this.calculateCost(
      estimatedInputTokens,
      estimatedOutputTokens,
      model.pricingInputPer1k,
      model.pricingOutputPer1k,
    );

    const result: CostEstimateResponseDto = {
      estimatedInputTokens: estimatedInputTokens,
      estimatedOutputTokens: estimatedOutputTokens,
      estimatedCost: estimatedCost.totalCost,
      currency: 'USD',
      model,
    };

    // Add warning for expensive operations
    if (estimatedCost.totalCost > 0.1) {
      result.maxCostWarning = `This operation may cost more than $0.10. Estimated: $${estimatedCost.totalCost.toFixed(4)}`;
    }

    return result;
  }

  async getRecommendations(
    filters: RecommendationFilters,
  ): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getServiceClient();

    let query = client
      .from(getTableName('llm_models'))
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
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      inputCost: inputCost,
      outputCost: outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  // Helper method to get models by provider name
  async findByProviderName(providerName: string): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from(getTableName('llm_models'))
      .select(`*, provider:llm_providers(*)`)
      .eq('provider.provider_name', providerName)
      .eq('is_active', true)
      .order('display_name');

    if (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return (data || []).map(mapLLMModelFromDb);
  }
}
