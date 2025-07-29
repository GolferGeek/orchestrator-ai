/**
 * Enhanced Generate SQL Tool
 *
 * Intelligent SQL generation with context learning, execution tracking,
 * and comprehensive error handling. Replaces the existing implementation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ContextLearningService } from '../services/context-learning.service';
import { LLMService } from '../../../../llms/llm.service';
import { MCPToolExecutionOptions } from '../base/intelligent-mcp-base.service';

export interface GenerateSQLParameters {
  prompt: string;
  use_context?: boolean;
  llm_provider?: string;
  llm_model?: string;
  max_retries?: number;
  include_explanation?: boolean;
  dry_run?: boolean;
}

export interface GenerateSQLResult {
  sql: string;
  explanation: string;
  confidence: number;
  warnings: string[];
  context_patterns_applied: number;
  execution_time_ms: number;
  model_used: string;
  validation_results: {
    is_valid: boolean;
    security_issues: string[];
    estimated_complexity: 'low' | 'medium' | 'high';
  };
}

export class EnhancedGenerateSQLTool {
  constructor(
    private readonly supabaseClient: SupabaseClient,
    private readonly contextLearning: ContextLearningService,
    private readonly llmService: LLMService,
  ) {}

  async execute(
    parameters: GenerateSQLParameters,
    options: MCPToolExecutionOptions,
  ): Promise<GenerateSQLResult> {
    const startTime = Date.now();

    try {
      // Get enhanced prompt with context learning
      console.log(
        '🔧 DEBUG: About to call enhancePrompt with use_context =',
        parameters.use_context,
      );
      console.log('🔧 DEBUG: Original prompt:', parameters.prompt);

      const enhancedPrompt =
        parameters.use_context !== false
          ? await this.contextLearning.enhancePrompt(
              parameters.prompt,
              'generate-sql',
            )
          : parameters.prompt;

      console.log('🔧 DEBUG: Enhanced prompt length:', enhancedPrompt.length);
      console.log(
        '🔧 DEBUG: Enhanced prompt preview:',
        enhancedPrompt.substring(0, 200),
      );

      // Get database schema for context
      const schema = await this.getRelevantSchema();

      // Generate SQL using LLM
      const sqlResult = await this.generateSQLWithLLM(
        enhancedPrompt,
        schema,
        parameters,
        options,
      );

      // Validate the generated SQL
      const validation = await this.validateSQL(sqlResult.sql);

      // Context learning is handled by the simplified service

      return {
        sql: sqlResult.sql,
        explanation: sqlResult.explanation,
        confidence: sqlResult.confidence,
        warnings: validation.security_issues,
        context_patterns_applied: parameters.use_context !== false ? 1 : 0,
        execution_time_ms: Date.now() - startTime,
        model_used: sqlResult.model_used,
        validation_results: validation,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate SQL using LLM with schema context
   */
  private async generateSQLWithLLM(
    prompt: string,
    schema: any,
    parameters: GenerateSQLParameters,
    options: MCPToolExecutionOptions,
  ): Promise<{
    sql: string;
    explanation: string;
    confidence: number;
    model_used: string;
  }> {
    const systemPrompt = this.buildSystemPrompt(schema);
    const userPrompt = this.buildUserPrompt(prompt, parameters);

    const llmResult = await this.llmService.generateEnhancedResponse(
      options.userId || 'mcp-user',
      systemPrompt,
      userPrompt,
      {
        providerId:
          parameters.llm_provider || options.llmProvider || 'anthropic',
        modelId:
          parameters.llm_model || options.llmModel || 'claude-3-5-sonnet',
        temperature: 0.1,
        maxTokens: 2000,
      },
    );

    // Parse the LLM response
    const parsedResult = this.parseLLMResponse(llmResult.content);

    return {
      sql: parsedResult.sql,
      explanation: parsedResult.explanation,
      confidence: parsedResult.confidence,
      model_used: `${parameters.llm_provider || options.llmProvider || 'anthropic'}:${parameters.llm_model || options.llmModel || 'claude-3-5-sonnet'}`,
    };
  }

  /**
   * Build system prompt with database schema
   */
  private buildSystemPrompt(schema: any): string {
    return `You are an expert SQL query generator for SUPABASE REST API. Generate queries that work with Supabase's PostgREST API limitations.

DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

CRITICAL SUPABASE CONSTRAINTS:
1. NO table aliases in SELECT (d.id, d.name) - Use direct column names only
2. NO AS aliases (name AS dept_name) - These will fail parsing
3. NO calculated columns ((id * 2) AS double_id) - Use simple column references
4. NO multiple ORDER BY columns (ORDER BY name, id) - Single column only
5. NO functions in ORDER BY (ORDER BY LOWER(name)) - Use simple columns
6. NO complex JOINs with aliases - Keep queries simple
7. LIMIT is required for safety - Always add LIMIT clause

SAFE SQL PATTERNS THAT WORK:
✅ SELECT id, name FROM departments ORDER BY name LIMIT 100
✅ SELECT COUNT(*) FROM departments  
✅ SELECT company_id, COUNT(*) FROM departments GROUP BY company_id
✅ SELECT AVG(column_name) FROM table_name WHERE created_at >= NOW() - INTERVAL '30 days' LIMIT 1
✅ SELECT MAX(column_name), MIN(column_name), SUM(column_name) FROM table_name LIMIT 1
✅ Simple WHERE clauses with basic conditions

UNSAFE PATTERNS THAT FAIL:
❌ SELECT d.id, d.name FROM departments d JOIN companies c ON d.company_id = c.id
❌ SELECT name AS dept_name FROM departments ORDER BY dept_name  
❌ SELECT (id * 2) AS double_id FROM departments
❌ ORDER BY name, id (multiple columns)
❌ ORDER BY LOWER(name) (functions)

QUERY GENERATION STRATEGY:
- Use only basic SELECT, FROM, WHERE, ORDER BY, LIMIT
- No table aliases, column aliases, or calculated fields
- Single table queries preferred
- For complex needs, suggest creating database views
- Always include safety LIMIT clauses

RESPONSE FORMAT:
Return your response as JSON with these fields:
{
  "sql": "The generated SQL query (Supabase-compatible)",
  "explanation": "Step-by-step explanation including Supabase constraints",
  "confidence": 0.95 // Float between 0 and 1 
}`;
  }

  /**
   * Build user prompt with specific request
   */
  private buildUserPrompt(
    prompt: string,
    parameters: GenerateSQLParameters,
  ): string {
    let userPrompt = `Generate a PostgreSQL query for: ${prompt}`;

    if (parameters.include_explanation !== false) {
      userPrompt +=
        '\n\nPlease include a detailed explanation of the query logic.';
    }

    if (parameters.dry_run) {
      userPrompt +=
        '\n\nThis is for validation only - focus on query correctness and security.';
    }

    return userPrompt;
  }

  /**
   * Parse LLM response to extract SQL and metadata
   */
  private parseLLMResponse(response: string): {
    sql: string;
    explanation: string;
    confidence: number;
  } {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sql: parsed.sql || '',
          explanation: parsed.explanation || 'No explanation provided',
          confidence: parsed.confidence || 0.8,
        };
      }

      // Fallback: extract SQL from code blocks
      const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
      const sql = sqlMatch ? sqlMatch[1]?.trim() || '' : response.trim();

      return {
        sql,
        explanation: 'Generated SQL query',
        confidence: 0.7,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get relevant database schema
   */
  private async getRelevantSchema(): Promise<any> {
    // Complete schema including KPI business tables
    return {
      tables: [
        // Application tables
        {
          name: 'users',
          columns: ['id', 'email', 'display_name', 'created_at', 'updated_at'],
        },
        {
          name: 'sessions',
          columns: ['id', 'user_id', 'name', 'created_at', 'updated_at'],
        },
        {
          name: 'agent_conversations',
          columns: [
            'id',
            'user_id',
            'agent_name',
            'agent_type',
            'started_at',
            'ended_at',
            'last_active_at',
            'created_at',
            'updated_at',
          ],
        },
        {
          name: 'tasks',
          columns: [
            'id',
            'agent_conversation_id',
            'user_id',
            'method',
            'prompt',
            'status',
            'created_at',
            'updated_at',
          ],
        },
        {
          name: 'mcp_executions',
          columns: [
            'id',
            'mcp_name',
            'tool_name',
            'user_id',
            'agent_conversation_id',
            'session_id',
            'status',
            'execution_time_ms',
            'created_at',
          ],
        },
        // KPI Business tables
        {
          name: 'companies',
          columns: ['id', 'name', 'industry', 'founded_year', 'created_at'],
        },
        {
          name: 'departments',
          columns: [
            'id',
            'company_id',
            'name',
            'head_of_department',
            'budget',
            'created_at',
          ],
        },
        {
          name: 'kpi_metrics',
          columns: [
            'id',
            'name',
            'description',
            'unit',
            'metric_type',
            'created_at',
          ],
        },
        {
          name: 'kpi_data',
          columns: [
            'id',
            'department_id',
            'metric_id',
            'value',
            'date_recorded',
            'created_at',
          ],
        },
        {
          name: 'kpi_goals',
          columns: [
            'id',
            'department_id',
            'metric_id',
            'target_value',
            'period_start',
            'period_end',
            'created_at',
          ],
        },
      ],
      relationships: [
        'companies.id = departments.company_id',
        'departments.id = kpi_data.department_id',
        'kpi_metrics.id = kpi_data.metric_id',
        'departments.id = kpi_goals.department_id',
        'kpi_metrics.id = kpi_goals.metric_id',
      ],
    };
  }

  /**
   * Validate generated SQL for security and correctness
   */
  private async validateSQL(sql: string): Promise<{
    is_valid: boolean;
    security_issues: string[];
    estimated_complexity: 'low' | 'medium' | 'high';
  }> {
    const issues: string[] = [];

    // Basic security checks
    if (sql.match(/;\s*(DROP|DELETE|TRUNCATE|ALTER)/i)) {
      issues.push('Potentially dangerous SQL operations detected');
    }

    if (sql.match(/--|\*\/|\bUNION\b.*\bSELECT\b/i)) {
      issues.push('Potential SQL injection patterns detected');
    }

    // Complexity estimation
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (sql.match(/\bJOIN\b/i)) complexity = 'medium';
    if (sql.match(/\b(WITH|WINDOW|PARTITION)\b/i)) complexity = 'high';

    // Syntax validation (basic)
    const hasBasicStructure =
      sql.trim().toUpperCase().startsWith('SELECT') ||
      sql.trim().toUpperCase().startsWith('WITH');

    return {
      is_valid: hasBasicStructure && issues.length === 0,
      security_issues: issues,
      estimated_complexity: complexity,
    };
  }
}
