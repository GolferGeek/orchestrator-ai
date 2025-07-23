import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '@/llms/llm.service';
import { SimpleSchema, SimpleTableSchema } from './simple-schema.service';

export interface SQLGenerationRequest {
  naturalLanguageQuery: string;
  schemaContext?: SimpleSchema | SimpleTableSchema[];
  queryType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'auto-detect';
  modelOverride?: string;
  includeExplanation?: boolean;
  maxRows?: number;
}

export interface SQLGenerationResponse {
  sql: string;
  explanation: string;
  safetyScore: number; // 0-1, higher is safer
  estimatedComplexity: 'low' | 'medium' | 'high';
  warnings: string[];
  suggestedTables: string[];
  modelUsed: string;
  generationTime: number;
}

/**
 * Service for generating SQL from natural language using LLM
 */
@Injectable()
export class SQLGeneratorService {
  private readonly logger = new Logger(SQLGeneratorService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Generate SQL from natural language query
   */
  async generateSQL(
    request: SQLGenerationRequest,
  ): Promise<SQLGenerationResponse> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Generating SQL for query: "${request.naturalLanguageQuery}"`,
      );

      // Build the system prompt with schema context
      const systemPrompt = this.buildSystemPrompt(request.schemaContext);

      // Build the user prompt
      const userPrompt = this.buildUserPrompt(request);

      // Generate SQL using LLM
      const llmResponse = await this.llmService.generateResponse(
        systemPrompt,
        userPrompt,
        {
          modelId: request.modelOverride,
          temperature: 0.1, // Low temperature for more consistent SQL generation
          maxTokens: 1000,
        },
      );

      // Parse the LLM response
      const response = await this.parseLLMResponse(llmResponse, request);
      response.generationTime = Date.now() - startTime;

      this.logger.log(
        `SQL generated successfully in ${response.generationTime}ms`,
      );
      return response;
    } catch (error) {
      this.logger.error('Failed to generate SQL:', error);
      throw new Error(
        `SQL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate SQL with multiple models for comparison
   */
  async generateSQLComparison(
    request: SQLGenerationRequest,
    models: string[],
  ): Promise<SQLGenerationResponse[]> {
    const results: SQLGenerationResponse[] = [];

    for (const model of models) {
      try {
        const modelRequest = { ...request, modelOverride: model };
        const result = await this.generateSQL(modelRequest);
        results.push(result);
      } catch (error) {
        this.logger.warn(`Failed to generate SQL with model ${model}:`, error);
        // Add error result to maintain array consistency
        results.push({
          sql: '',
          explanation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          safetyScore: 0,
          estimatedComplexity: 'high',
          warnings: ['Model generation failed'],
          suggestedTables: [],
          modelUsed: model,
          generationTime: 0,
        });
      }
    }

    return results;
  }

  /**
   * Validate and score generated SQL for safety
   */
  async validateSQL(
    sql: string,
    context?: SimpleSchema,
  ): Promise<{
    isValid: boolean;
    safetyScore: number;
    warnings: string[];
    suggestedImprovements: string[];
  }> {
    const warnings: string[] = [];
    const improvements: string[] = [];
    let safetyScore = 1.0;

    // Check for dangerous patterns
    const dangerousPatterns = [
      {
        pattern: /DROP\s+TABLE/i,
        penalty: 0.8,
        warning: 'Contains DROP TABLE - potentially destructive',
      },
      {
        pattern: /DELETE\s+FROM\s+\w+\s*;?\s*$/i,
        penalty: 0.6,
        warning: 'DELETE without WHERE clause - affects all rows',
      },
      {
        pattern: /UPDATE\s+\w+\s+SET\s+.*\s*;?\s*$/i,
        penalty: 0.4,
        warning: 'UPDATE without WHERE clause - affects all rows',
      },
      {
        pattern: /TRUNCATE/i,
        penalty: 0.7,
        warning: 'TRUNCATE statement - removes all data',
      },
      {
        pattern: /ALTER\s+TABLE/i,
        penalty: 0.3,
        warning: 'ALTER TABLE - modifies table structure',
      },
      {
        pattern: /CREATE\s+TABLE/i,
        penalty: 0.2,
        warning: 'CREATE TABLE - modifies database structure',
      },
      {
        pattern: /GRANT|REVOKE/i,
        penalty: 0.5,
        warning: 'Permission modification statements',
      },
    ];

    for (const { pattern, penalty, warning } of dangerousPatterns) {
      if (pattern.test(sql)) {
        safetyScore -= penalty;
        warnings.push(warning);
      }
    }

    // Check for missing LIMIT on SELECT statements
    if (/SELECT\s+.*\s+FROM/i.test(sql) && !/LIMIT\s+\d+/i.test(sql)) {
      safetyScore -= 0.1;
      warnings.push(
        'SELECT query without LIMIT - may return large result sets',
      );
      improvements.push('Consider adding LIMIT clause to control result size');
    }

    // Check for SQL injection vulnerabilities
    const injectionPatterns = [
      /['"];?\s*(DROP|DELETE|UPDATE|INSERT|ALTER)/i,
      /UNION\s+SELECT/i,
      /OR\s+1\s*=\s*1/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(sql)) {
        safetyScore -= 0.5;
        warnings.push('Potential SQL injection pattern detected');
        break;
      }
    }

    // Ensure minimum safety score
    safetyScore = Math.max(0, safetyScore);

    return {
      isValid: safetyScore > 0.3, // Consider invalid if safety score too low
      safetyScore,
      warnings,
      suggestedImprovements: improvements,
    };
  }

  /**
   * Build system prompt with schema context
   */
  private buildSystemPrompt(
    schemaContext?: SimpleSchema | SimpleTableSchema[],
  ): string {
    let prompt = `You are an expert SQL generator. Your task is to convert natural language queries into safe, efficient SQL queries.

IMPORTANT GUIDELINES:
1. Always include LIMIT clauses for SELECT statements (default: LIMIT 100)
2. Use proper WHERE clauses to filter data appropriately
3. Never generate destructive operations (DROP, TRUNCATE) unless explicitly requested
4. Use parameterized queries when possible
5. Follow PostgreSQL syntax (this is a Supabase/PostgreSQL database)
6. Return only valid, executable SQL

OUTPUT FORMAT:
Respond with a JSON object containing:
{
  "sql": "The generated SQL query",
  "explanation": "Clear explanation of what the query does",
  "safety_score": 0.95,
  "complexity": "low|medium|high",
  "warnings": ["any warnings about the query"],
  "suggested_tables": ["tables referenced in the query"]
}`;

    if (schemaContext) {
      prompt += '\n\nAVAILABLE DATABASE SCHEMA:\n';

      if ('tables' in schemaContext) {
        // Full database schema
        prompt += this.formatSchemaForPrompt(schemaContext);
      } else {
        // Array of table schemas
        prompt += this.formatTablesForPrompt(schemaContext);
      }
    }

    return prompt;
  }

  /**
   * Build user prompt with query details
   */
  private buildUserPrompt(request: SQLGenerationRequest): string {
    let prompt = `Generate a SQL query for: "${request.naturalLanguageQuery}"`;

    if (request.queryType && request.queryType !== 'auto-detect') {
      prompt += `\nQuery type: ${request.queryType}`;
    }

    if (request.maxRows) {
      prompt += `\nLimit results to: ${request.maxRows} rows`;
    }

    prompt += '\n\nRemember to respond with valid JSON format as specified.';

    return prompt;
  }

  /**
   * Format database schema for LLM prompt
   */
  private formatSchemaForPrompt(schema: SimpleSchema): string {
    let formatted = 'Tables:\n';

    for (const table of schema.tables) {
      formatted += `\n${table.table_name} (~${table.row_count_estimate} rows):\n`;
      if (table.sample_columns.length > 0) {
        formatted += `  Columns: ${table.sample_columns.join(', ')}\n`;
      } else {
        formatted += `  (No sample data available)\n`;
      }
    }

    return formatted;
  }

  /**
   * Format table schemas for LLM prompt
   */
  private formatTablesForPrompt(tables: SimpleTableSchema[]): string {
    return tables
      .map((table) => {
        let formatted = `${table.table_name} (~${table.row_count_estimate} rows):\n`;
        if (table.sample_columns.length > 0) {
          formatted += `  Columns: ${table.sample_columns.join(', ')}\n`;
        } else {
          formatted += `  (No sample data available)\n`;
        }
        return formatted;
      })
      .join('\n');
  }

  /**
   * Parse LLM response into structured format
   */
  private async parseLLMResponse(
    llmResponse: any,
    request: SQLGenerationRequest,
  ): Promise<SQLGenerationResponse> {
    try {
      // Extract content from LLM response
      const content =
        typeof llmResponse === 'string'
          ? llmResponse
          : llmResponse.content || llmResponse;

      // Try to parse as JSON
      let parsed: any;
      try {
        // Look for JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: extract SQL from code blocks
        const sqlMatch =
          content.match(/```sql\n([\s\S]*?)\n```/) ||
          content.match(/```\n([\s\S]*?)\n```/);
        const sql = sqlMatch ? sqlMatch[1].trim() : content.trim();

        parsed = {
          sql,
          explanation: 'SQL extracted from response',
          safety_score: 0.5,
          complexity: 'medium',
          warnings: ['Could not parse structured response'],
          suggested_tables: [],
        };
      }

      // Validate and sanitize the response
      const response: SQLGenerationResponse = {
        sql: parsed.sql || '',
        explanation: parsed.explanation || 'No explanation provided',
        safetyScore: Math.min(1, Math.max(0, parsed.safety_score || 0.5)),
        estimatedComplexity: ['low', 'medium', 'high'].includes(
          parsed.complexity,
        )
          ? parsed.complexity
          : 'medium',
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        suggestedTables: Array.isArray(parsed.suggested_tables)
          ? parsed.suggested_tables
          : [],
        modelUsed:
          (typeof llmResponse === 'object' && llmResponse.llmMetadata?.model) ||
          request.modelOverride ||
          'default',
        generationTime: 0, // Will be set by caller
      };

      // Additional safety validation
      const validation = await this.validateSQL(response.sql);
      response.warnings.push(...validation.warnings);
      response.safetyScore = Math.min(
        response.safetyScore,
        validation.safetyScore,
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to parse LLM response:', error);
      throw new Error(
        `Failed to parse SQL generation response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
