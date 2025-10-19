import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  CreateModelDto,
  UpdateModelDto,
  ModelResponseDto,
  CostEstimateDto,
  CostEstimateResponseDto,
  ModelNameDto,
} from '@/llms/dto/llm-evaluation.dto';
import { ModelStatus, CostCalculation } from '@/llms/types/llm-evaluation';
import { mapLLMModelFromDb } from '@/utils/case-converter';
import { getTableName } from '@/supabase/supabase.config';

interface ModelFilters {
  providerName?: string;
  status?: ModelStatus;
  supportsThinking?: boolean;
  includeProvider?: boolean;
  sovereignMode?: boolean | string;
}

interface RecommendationFilters {
  useCase: string;
  maxCost?: number;
  minContext?: number;
}

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);
  private readonly modelNamesCache = new Map<
    string,
    { data: ModelNameDto[]; timestamp: number }
  >();
  private readonly cacheExpirationMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly supabaseService: SupabaseService) {}

  async findAllNames(filters: ModelFilters = {}): Promise<ModelNameDto[]> {
    const cacheKey = `names:${filters.providerName || 'all'}:${filters.status || 'all'}:${filters.sovereignMode || 'false'}`;
    const cached = this.modelNamesCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpirationMs) {
      return cached.data;
    }

    const client = this.supabaseService.getServiceClient();

    let query = client
      .from(getTableName('llm_models'))
      .select('provider_name, model_name, display_name')
      .eq('is_active', true)
      .order('provider_name')
      .order('display_name');

    if (filters.providerName) {
      query = query.eq('provider_name', filters.providerName);
    }

    if (filters.sovereignMode) {
      // In sovereign mode, only show local models (ollama)
      query = query.eq('provider_name', 'ollama');
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch model names: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const rows = data as Array<{
      provider_name: string;
      model_name: string;
      display_name: string;
    }> | null;
    const result = (rows || []).map((row) => ({
      providerName: row.provider_name,
      modelName: row.model_name,
      displayName: row.display_name,
    }));

    // Cache the result
    this.modelNamesCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  }

  async findAll(filters: ModelFilters = {}): Promise<ModelResponseDto[]> {
    const client = this.supabaseService.getServiceClient();

    // If sovereign mode is enabled, we need to get the Ollama provider ID first
    let ollamaProviderId: string | null = null;
    const isSovereignMode =
      filters.sovereignMode === true || filters.sovereignMode === 'true';
    if (isSovereignMode) {
      // Try to find Ollama provider (case-insensitive)
      const { data: providerData, error: providerError } = await client
        .from(getTableName('llm_providers'))
        .select('id, name')
        .ilike('name', 'ollama')
        .single();

      if (providerError) {
        this.logger.warn(
          'Could not find Ollama provider for sovereign mode filtering',
          providerError,
        );
        // Return empty array if Ollama provider not found
        return [];
      }
      ollamaProviderId = providerData?.id as string;
      this.logger.debug(
        `Found Ollama provider with ID: ${ollamaProviderId} and name: ${providerData?.name}`,
      );
    }

    // Determine if we need provider data for user request
    const selectClause = filters.includeProvider
      ? `*, provider:llm_providers(*)`
      : '*';

    let query = client
      .from(getTableName('llm_models'))
      .select(selectClause)
      .order('display_name');

    if (filters.providerName) {
      query = query.eq('provider_name', filters.providerName);
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

    if (isSovereignMode && ollamaProviderId) {
      // In sovereign mode, only show local models (Ollama provider)
      query = query.eq('provider_id', ollamaProviderId);
    }

    const { data, error } = await query;

    if (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.log('About to map models using mapLLMModelFromDb...');
    try {
      const mappedModels = (data || []).map((model: unknown) => {
        return mapLLMModelFromDb(model as Record<string, unknown>);
      });
      this.logger.log(`Successfully mapped ${mappedModels.length} models`);
      return mappedModels;
    } catch (_mappingError) {
      const errorMessage =
        _mappingError instanceof Error
          ? _mappingError.message
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

    return data && typeof data === 'object' && !('error' in data)
      ? mapLLMModelFromDb(data)
      : null;
  }

  async findByModelId(
    modelId: string,
    providerName?: string,
  ): Promise<ModelResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    let query = client
      .from(getTableName('llm_models'))
      .select(`*, provider:llm_providers(*)`)
      .eq('model_name', modelId);

    if (providerName) {
      query = query.eq('provider_name', providerName);
    }

    const { data, error } = (await query.single()) as {
      data: Record<string, unknown> | null;
      error: { code: string; message: string } | null;
    };

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new HttpException(
        `Failed to fetch model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return data && typeof data === 'object' && !('error' in data)
      ? mapLLMModelFromDb(data)
      : null;
  }

  async create(createModelDto: CreateModelDto): Promise<ModelResponseDto> {
    const client = this.supabaseService.getServiceClient();

    // Check if provider exists
    const { data: provider } = await client
      .from(getTableName('llm_providers'))
      .select('name')
      .eq('name', createModelDto.providerName)
      .single();

    if (!provider) {
      throw new HttpException('Provider not found', HttpStatus.NOT_FOUND);
    }

    // Check if model_name already exists for this provider
    const { data: existingModel } = await client
      .from(getTableName('llm_models'))
      .select('model_name')
      .eq('provider_name', createModelDto.providerName)
      .eq('model_name', createModelDto.modelName)
      .single();

    if (existingModel) {
      throw new HttpException(
        'Model ID already exists for this provider',
        HttpStatus.CONFLICT,
      );
    }

    const { data, error } = (await client
      .from(getTableName('llm_models'))
      .insert({
        provider_name: createModelDto.providerName,
        display_name: createModelDto.name,
        model_name: createModelDto.modelName,
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
      .single()) as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new HttpException(
        `Failed to create model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return mapLLMModelFromDb(data as Record<string, unknown>);
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

    // If updating model_name, check for conflicts
    if (
      updateModelDto.modelName &&
      updateModelDto.modelName !== existing.modelName
    ) {
      const { data: existingModel } = await client
        .from(getTableName('llm_models'))
        .select('model_name')
        .eq('provider_name', existing.providerName)
        .eq('model_name', updateModelDto.modelName)
        .neq('model_name', existing.modelName)
        .single();

      if (existingModel) {
        throw new HttpException(
          'Model ID already exists for this provider',
          HttpStatus.CONFLICT,
        );
      }
    }

    const { data, error } = (await client
      .from(getTableName('llm_models'))
      .update({
        ...updateModelDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()) as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new HttpException(
        `Failed to update model: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return mapLLMModelFromDb(data as Record<string, unknown>);
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

    const { error } = await client
      .from(getTableName('llm_models'))
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

  async estimateCost(
    costEstimateDto: CostEstimateDto,
  ): Promise<CostEstimateResponseDto> {
    const model = await this.findOne(costEstimateDto.modelName, true);
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

    return (data as ModelResponseDto[]) || [];
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
