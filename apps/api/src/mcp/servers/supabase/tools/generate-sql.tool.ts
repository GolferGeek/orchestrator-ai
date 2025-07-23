import {
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
} from '../../base/interfaces/mcp-server.interface';
import {
  SQLGeneratorService,
  SQLGenerationRequest,
} from '../services/sql-generator.service';
import {
  SimpleSchemaService,
  SimpleSchema,
  SimpleTableSchema,
} from '../services/simple-schema.service';
import { SupabaseClient } from '@supabase/supabase-js';

export class GenerateSQLTool {
  static getDefinition(): MCPToolDefinition {
    return {
      name: 'generate-sql',
      description:
        'Convert natural language queries into SQL using AI, with safety validation and explanation',
      inputSchema: {
        type: 'object',
        properties: {
          natural_language_query: {
            type: 'string',
            description: 'The natural language query to convert to SQL',
          },
          query_type: {
            type: 'string',
            enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'auto-detect'],
            description: 'Expected type of SQL query (auto-detect if unsure)',
            default: 'auto-detect',
          },
          model_override: {
            type: 'string',
            description:
              'Specific LLM model to use for generation (e.g., claude-3-5-sonnet, gpt-4o)',
            default: null,
          },
          include_explanation: {
            type: 'boolean',
            description: 'Include detailed explanation of the generated SQL',
            default: true,
          },
          max_rows: {
            type: 'integer',
            description: 'Maximum number of rows to return (adds LIMIT clause)',
            default: 100,
            minimum: 1,
            maximum: 10000,
          },
          schema_tables: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Specific tables to include in schema context (optional)',
          },
        },
        required: ['natural_language_query'],
      },
    };
  }

  static async execute(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
    simpleSchemaService: SimpleSchemaService,
    sqlGeneratorService: SQLGeneratorService,
  ): Promise<MCPToolResponse> {
    try {
      const {
        natural_language_query,
        query_type = 'auto-detect',
        model_override,
        include_explanation = true,
        max_rows = 100,
        schema_tables,
      } = request.arguments || {};

      if (!natural_language_query?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: natural_language_query is required and cannot be empty',
            },
          ],
          isError: true,
          _meta: {
            tool: 'generate-sql',
            error: 'Missing required parameter: natural_language_query',
          },
        };
      }

      // Get relevant schema context
      let schemaContext: SimpleSchema | SimpleTableSchema[];
      if (schema_tables && schema_tables.length > 0) {
        // Get specific tables
        const tableSchemas: SimpleTableSchema[] = [];
        for (const tableName of schema_tables) {
          try {
            const tableSchema = await simpleSchemaService.getTableInfo(
              supabaseClient,
              tableName,
            );
            if (tableSchema) {
              tableSchemas.push(tableSchema);
            }
          } catch (error) {
            // Continue with other tables if one fails
            console.warn(`Failed to get schema for table ${tableName}:`, error);
          }
        }
        schemaContext = tableSchemas;
      } else {
        // Get full database schema
        schemaContext = await simpleSchemaService.getSchema(supabaseClient);
      }

      // Prepare SQL generation request
      const generationRequest: SQLGenerationRequest = {
        naturalLanguageQuery: natural_language_query,
        schemaContext,
        queryType: query_type,
        modelOverride: model_override,
        includeExplanation: include_explanation,
        maxRows: max_rows,
      };

      // Generate SQL
      const generationResult =
        await sqlGeneratorService.generateSQL(generationRequest);

      // Format the response
      const response = {
        sql_generation: {
          query: {
            natural_language: natural_language_query,
            generated_sql: generationResult.sql,
            explanation: generationResult.explanation,
          },
          analysis: {
            safety_score: generationResult.safetyScore,
            estimated_complexity: generationResult.estimatedComplexity,
            warnings: generationResult.warnings,
            suggested_tables: generationResult.suggestedTables,
          },
          metadata: {
            model_used: generationResult.modelUsed,
            generation_time_ms: generationResult.generationTime,
            schema_tables_used: schema_tables || 'all',
            max_rows_limit: max_rows,
          },
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
        isError: false,
        _meta: {
          tool: 'generate-sql',
          model_used: generationResult.modelUsed,
          safety_score: generationResult.safetyScore,
          generation_time: generationResult.generationTime,
          complexity: generationResult.estimatedComplexity,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating SQL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'generate-sql',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate SQL with multiple models for comparison
   */
  static async executeComparison(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
    simpleSchemaService: SimpleSchemaService,
    sqlGeneratorService: SQLGeneratorService,
    models: string[],
  ): Promise<MCPToolResponse> {
    try {
      const {
        natural_language_query,
        query_type = 'auto-detect',
        include_explanation = true,
        max_rows = 100,
        schema_tables,
      } = request.arguments || {};

      if (!natural_language_query?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: natural_language_query is required and cannot be empty',
            },
          ],
          isError: true,
          _meta: {
            tool: 'generate-sql-comparison',
            error: 'Missing required parameter: natural_language_query',
          },
        };
      }

      // Get schema context
      let schemaContext: SimpleSchema | SimpleTableSchema[];
      if (schema_tables && schema_tables.length > 0) {
        const tableSchemas: SimpleTableSchema[] = [];
        for (const tableName of schema_tables) {
          try {
            const tableSchema = await simpleSchemaService.getTableInfo(
              supabaseClient,
              tableName,
            );
            if (tableSchema) {
              tableSchemas.push(tableSchema);
            }
          } catch (error) {
            console.warn(`Failed to get schema for table ${tableName}:`, error);
          }
        }
        schemaContext = tableSchemas;
      } else {
        schemaContext = await simpleSchemaService.getSchema(supabaseClient);
      }

      // Prepare generation request
      const generationRequest: SQLGenerationRequest = {
        naturalLanguageQuery: natural_language_query,
        schemaContext,
        queryType: query_type,
        includeExplanation: include_explanation,
        maxRows: max_rows,
      };

      // Generate SQL with multiple models
      const results = await sqlGeneratorService.generateSQLComparison(
        generationRequest,
        models,
      );

      // Format comparison response
      const response = {
        sql_comparison: {
          query: {
            natural_language: natural_language_query,
            query_type: query_type,
            max_rows: max_rows,
          },
          models_compared: models.length,
          results: results.map((result) => ({
            model: result.modelUsed,
            generated_sql: result.sql,
            explanation: result.explanation,
            safety_score: result.safetyScore,
            complexity: result.estimatedComplexity,
            warnings: result.warnings,
            generation_time_ms: result.generationTime,
          })),
          recommendation: this.getRecommendation(results),
          metadata: {
            total_generation_time_ms: results.reduce(
              (sum, r) => sum + r.generationTime,
              0,
            ),
            schema_tables_used: schema_tables || 'all',
          },
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
        isError: false,
        _meta: {
          tool: 'generate-sql-comparison',
          models_compared: models.length,
          best_model: response.sql_comparison.recommendation.recommended_model,
          avg_safety_score:
            results.reduce((sum, r) => sum + r.safetyScore, 0) / results.length,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating SQL comparison: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'generate-sql-comparison',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Analyze results and provide recommendation
   */
  private static getRecommendation(results: any[]): any {
    if (results.length === 0) {
      return { recommended_model: 'none', reason: 'No valid results' };
    }

    // Score each result based on safety, complexity, and generation time
    const scoredResults = results.map((result) => {
      let score = 0;

      // Safety score (40% weight)
      score += result.safetyScore * 0.4;

      // Complexity score (30% weight) - lower complexity is better
      const complexityScore =
        result.estimatedComplexity === 'low'
          ? 1
          : result.estimatedComplexity === 'medium'
            ? 0.7
            : 0.4;
      score += complexityScore * 0.3;

      // Speed score (20% weight) - faster is better, normalized to 0-1
      const maxTime = Math.max(...results.map((r) => r.generationTime));
      const speedScore =
        maxTime > 0 ? (maxTime - result.generationTime) / maxTime : 1;
      score += speedScore * 0.2;

      // Warning penalty (10% weight)
      const warningPenalty = result.warnings.length * 0.02; // 2% per warning
      score -= warningPenalty;

      return {
        ...result,
        recommendation_score: Math.max(0, score),
      };
    });

    // Find the best result
    const bestResult = scoredResults.reduce((best, current) =>
      current.recommendation_score > best.recommendation_score ? current : best,
    );

    return {
      recommended_model: bestResult.modelUsed,
      recommendation_score: bestResult.recommendation_score,
      reason: this.getRecommendationReason(bestResult, scoredResults),
      alternatives: scoredResults
        .filter((r) => r.modelUsed !== bestResult.modelUsed)
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, 2)
        .map((r) => ({
          model: r.modelUsed,
          score: r.recommendation_score,
          note: this.getAlternativeNote(r),
        })),
    };
  }

  private static getRecommendationReason(
    bestResult: any,
    allResults: any[],
  ): string {
    const reasons = [];

    if (bestResult.safetyScore >= 0.9) {
      reasons.push('highest safety score');
    }

    if (bestResult.estimatedComplexity === 'low') {
      reasons.push('low complexity');
    }

    if (
      bestResult.generationTime <=
      Math.min(...allResults.map((r) => r.generationTime)) * 1.1
    ) {
      reasons.push('fast generation');
    }

    if (bestResult.warnings.length === 0) {
      reasons.push('no warnings');
    }

    return reasons.length > 0
      ? reasons.join(', ')
      : 'balanced performance across metrics';
  }

  private static getAlternativeNote(result: any): string {
    if (result.safetyScore < 0.7) return 'Lower safety score';
    if (result.estimatedComplexity === 'high') return 'Higher complexity';
    if (result.warnings.length > 2) return 'Multiple warnings';
    if (result.generationTime > 5000) return 'Slower generation';
    return 'Good alternative option';
  }
}
