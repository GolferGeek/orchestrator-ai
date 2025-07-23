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
  QueryExecutorService,
  QueryExecutionRequest,
} from '../services/query-executor.service';
import {
  SimpleSchemaService,
  SimpleSchema,
  SimpleTableSchema,
} from '../services/simple-schema.service';
import { SupabaseClient } from '@supabase/supabase-js';

export class QueryAndFormatTool {
  static getDefinition(): MCPToolDefinition {
    return {
      name: 'query-and-format',
      description:
        'Complete workflow: Convert natural language to SQL, execute safely, and format results',
      inputSchema: {
        type: 'object',
        properties: {
          user_prompt: {
            type: 'string',
            description: 'Natural language query or request',
          },
          output_format: {
            type: 'string',
            enum: ['table', 'json', 'summary', 'chart-data', 'report'],
            description: 'Desired output format for results',
            default: 'table',
          },
          include_explanation: {
            type: 'boolean',
            description:
              'Include explanation of the generated SQL and analysis',
            default: true,
          },
          model_override: {
            type: 'string',
            description: 'Specific LLM model for SQL generation',
            default: null,
          },
          max_rows: {
            type: 'integer',
            description: 'Maximum rows to return',
            default: 100,
            minimum: 1,
            maximum: 10000,
          },
          include_schema_context: {
            type: 'boolean',
            description: 'Include relevant schema information in output',
            default: false,
          },
          suggested_tables: {
            type: 'array',
            items: { type: 'string' },
            description: 'Hint: specific tables that might be relevant',
          },
        },
        required: ['user_prompt'],
      },
    };
  }

  static async execute(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
    simpleSchemaService: SimpleSchemaService,
    sqlGeneratorService: SQLGeneratorService,
    queryExecutorService: QueryExecutorService,
    progressCallback?: (progress: any) => Promise<void>,
  ): Promise<MCPToolResponse> {
    const startTime = Date.now();

    try {
      const {
        user_prompt,
        output_format = 'table',
        include_explanation = true,
        model_override,
        max_rows = 100,
        include_schema_context = false,
        suggested_tables,
      } = request.arguments || {};

      if (!user_prompt?.trim()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: user_prompt is required and cannot be empty',
            },
          ],
          isError: true,
          _meta: {
            tool: 'query-and-format',
            error: 'Missing required parameter: user_prompt',
          },
        };
      }

      // Step 1: Analyze query and get schema context
      await progressCallback?.({
        step: 'fetch_schema',
        stepIndex: 1,
        totalSteps: 4,
        message: 'Retrieving relevant database schema...',
        status: 'in_progress',
      });

      let schemaContext: SimpleSchema | SimpleTableSchema[];
      if (suggested_tables && suggested_tables.length > 0) {
        const tableSchemas: SimpleTableSchema[] = [];
        for (const tableName of suggested_tables) {
          try {
            const tableSchema = await simpleSchemaService.getTableInfo(
              supabaseClient,
              tableName,
            );
            if (tableSchema) {
              tableSchemas.push(tableSchema);
            }
          } catch (error) {
            console.warn(
              `Failed to get schema for suggested table ${tableName}:`,
              error,
            );
          }
        }
        schemaContext = tableSchemas;
      } else {
        schemaContext = await simpleSchemaService.getSchema(supabaseClient);
      }

      // Step 2: Generate SQL
      await progressCallback?.({
        step: 'generate_sql',
        stepIndex: 2,
        totalSteps: 4,
        message: `Generating SQL query using ${model_override || 'default model'}...`,
        status: 'in_progress',
      });

      const generationRequest: SQLGenerationRequest = {
        naturalLanguageQuery: user_prompt,
        schemaContext,
        queryType: 'auto-detect',
        modelOverride: model_override,
        includeExplanation: include_explanation,
        maxRows: max_rows,
      };

      const sqlResult =
        await sqlGeneratorService.generateSQL(generationRequest);

      // Check if SQL generation was successful
      if (!sqlResult.sql || sqlResult.safetyScore < 0.3) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Failed to generate safe SQL',
                  explanation: sqlResult.explanation,
                  warnings: sqlResult.warnings,
                  safety_score: sqlResult.safetyScore,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
          _meta: {
            tool: 'query-and-format',
            error: 'SQL generation failed safety checks',
            safety_score: sqlResult.safetyScore,
          },
        };
      }

      // Step 3: Execute SQL
      await progressCallback?.({
        step: 'execute_sql',
        stepIndex: 3,
        totalSteps: 4,
        message: 'Executing query against database...',
        status: 'in_progress',
      });

      const executionRequest: QueryExecutionRequest = {
        sql: sqlResult.sql,
        maxRows: max_rows,
        timeout: 30000,
      };

      const executionResult = await queryExecutorService.executeQuery(
        supabaseClient,
        executionRequest,
      );

      // Step 4: Format results
      await progressCallback?.({
        step: 'format_results',
        stepIndex: 4,
        totalSteps: 4,
        message: 'Formatting results and generating insights...',
        status: 'in_progress',
      });

      const formattedResult = await this.formatResults(
        executionResult,
        sqlResult,
        output_format,
        include_explanation,
        include_schema_context,
        schemaContext,
      );

      const totalTime = Date.now() - startTime;

      await progressCallback?.({
        step: 'completed',
        stepIndex: 4,
        totalSteps: 4,
        message: 'Analysis complete!',
        status: 'completed',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedResult, null, 2),
          },
        ],
        isError: !executionResult.success,
        _meta: {
          tool: 'query-and-format',
          success: executionResult.success,
          total_time_ms: totalTime,
          sql_generation_time: sqlResult.generationTime,
          sql_execution_time: executionResult.metadata.executionTime,
          record_count: executionResult.metadata.recordCount,
          output_format,
          model_used: sqlResult.modelUsed,
          safety_score: sqlResult.safetyScore,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in query workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'query-and-format',
          error: error instanceof Error ? error.message : 'Unknown error',
          total_time_ms: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Format results based on requested output format
   */
  private static async formatResults(
    executionResult: any,
    sqlResult: any,
    outputFormat: string,
    includeExplanation: boolean,
    includeSchemaContext: boolean,
    schemaContext: any,
  ): Promise<any> {
    const baseResult = {
      query_analysis: {
        user_request: sqlResult.explanation || 'Query executed successfully',
        generated_sql: sqlResult.sql,
        safety_score: sqlResult.safetyScore,
        warnings: [
          ...(sqlResult.warnings || []),
          ...(executionResult.warnings || []),
        ],
      },
      execution_info: {
        success: executionResult.success,
        execution_time_ms: executionResult.metadata.executionTime,
        record_count: executionResult.metadata.recordCount,
        was_cached: executionResult.metadata.wasCached,
      },
    };

    if (!executionResult.success) {
      return {
        ...baseResult,
        error: executionResult.error,
        data: null,
      };
    }

    const data = executionResult.data || [];

    switch (outputFormat) {
      case 'table':
        return {
          ...baseResult,
          results: {
            format: 'table',
            columns: executionResult.metadata.columnsReturned,
            rows: data,
            summary: this.generateTableSummary(
              data,
              executionResult.metadata.columnsReturned,
            ),
          },
          ...(includeExplanation && {
            explanation: this.generateExplanation(sqlResult, executionResult),
          }),
          ...(includeSchemaContext && {
            schema_context: this.formatSchemaContext(schemaContext),
          }),
        };

      case 'json':
        return {
          ...baseResult,
          results: {
            format: 'json',
            data: data,
          },
          ...(includeExplanation && {
            explanation: this.generateExplanation(sqlResult, executionResult),
          }),
        };

      case 'summary':
        return {
          ...baseResult,
          results: {
            format: 'summary',
            summary: this.generateDataSummary(
              data,
              executionResult.metadata.columnsReturned,
            ),
            key_insights: this.generateKeyInsights(
              data,
              executionResult.metadata.columnsReturned,
            ),
          },
          ...(includeExplanation && {
            explanation: this.generateExplanation(sqlResult, executionResult),
          }),
        };

      case 'chart-data':
        return {
          ...baseResult,
          results: {
            format: 'chart-data',
            chart_recommendations: this.generateChartRecommendations(
              data,
              executionResult.metadata.columnsReturned,
            ),
            data: this.formatForCharting(
              data,
              executionResult.metadata.columnsReturned,
            ),
          },
          ...(includeExplanation && {
            explanation: this.generateExplanation(sqlResult, executionResult),
          }),
        };

      case 'report':
        return {
          ...baseResult,
          results: {
            format: 'report',
            executive_summary: this.generateExecutiveSummary(
              data,
              executionResult.metadata.columnsReturned,
            ),
            detailed_analysis: this.generateDetailedAnalysis(
              data,
              executionResult.metadata.columnsReturned,
            ),
            recommendations: this.generateRecommendations(data),
          },
          ...(includeExplanation && {
            explanation: this.generateExplanation(sqlResult, executionResult),
          }),
        };

      default:
        return {
          ...baseResult,
          results: {
            format: 'raw',
            data: data,
          },
        };
    }
  }

  private static generateTableSummary(data: any[], columns: string[]): any {
    if (data.length === 0) return { message: 'No data returned' };

    return {
      total_rows: data.length,
      columns_count: columns.length,
      column_types: this.inferColumnTypes(data, columns),
      sample_row: data[0],
    };
  }

  private static generateDataSummary(data: any[], columns: string[]): any {
    if (data.length === 0) return { message: 'No data to summarize' };

    const summary: any = {
      total_records: data.length,
      columns: columns.length,
    };

    // Generate basic statistics for numeric columns
    for (const column of columns) {
      const values = data
        .map((row) => row[column])
        .filter((val) => val !== null && val !== undefined);
      if (values.length === 0) continue;

      const numericValues = values.filter(
        (val) => typeof val === 'number' || !isNaN(Number(val)),
      );
      if (numericValues.length > 0) {
        const numbers = numericValues.map((val) => Number(val));
        summary[`${column}_stats`] = {
          count: numbers.length,
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          avg: numbers.reduce((sum, val) => sum + val, 0) / numbers.length,
        };
      }
    }

    return summary;
  }

  private static generateKeyInsights(data: any[], columns: string[]): string[] {
    const insights: string[] = [];

    if (data.length === 0) {
      insights.push('No data returned from the query');
      return insights;
    }

    insights.push(
      `Query returned ${data.length} record${data.length === 1 ? '' : 's'}`,
    );

    // Find columns with interesting patterns
    for (const column of columns) {
      const values = data
        .map((row) => row[column])
        .filter((val) => val !== null && val !== undefined);
      const uniqueValues = new Set(values);

      if (uniqueValues.size === 1 && values.length > 1) {
        insights.push(`All records have the same ${column}: ${values[0]}`);
      } else if (uniqueValues.size === values.length && values.length > 1) {
        insights.push(`All ${column} values are unique`);
      }

      // Check for numeric trends
      const numericValues = values.filter(
        (val) => typeof val === 'number' || !isNaN(Number(val)),
      );
      if (numericValues.length > 1) {
        const numbers = numericValues.map((val) => Number(val));
        const total = numbers.reduce((sum, val) => sum + val, 0);
        if (total > 0) {
          insights.push(`Total ${column}: ${total.toLocaleString()}`);
        }
      }
    }

    return insights.slice(0, 5); // Limit to top 5 insights
  }

  private static generateChartRecommendations(
    data: any[],
    columns: string[],
  ): any {
    if (data.length === 0) return { message: 'No data available for charting' };

    const recommendations = [];

    // Check for time series data
    const dateColumns = columns.filter((col) => {
      const sampleValue = data[0]?.[col];
      return (
        sampleValue &&
        (sampleValue instanceof Date ||
          (typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue))))
      );
    });

    if (dateColumns.length > 0) {
      recommendations.push({
        type: 'line_chart',
        x_axis: dateColumns[0],
        y_axis: columns.find(
          (col) =>
            !dateColumns.includes(col) && typeof data[0]?.[col] === 'number',
        ),
        description: 'Time series line chart showing trends over time',
      });
    }

    // Check for categorical data
    const categoricalColumns = columns.filter((col) => {
      const values = data.map((row) => row[col]);
      const uniqueValues = new Set(values);
      return uniqueValues.size < data.length * 0.5 && uniqueValues.size < 20;
    });

    if (categoricalColumns.length > 0) {
      const numericColumns = columns.filter(
        (col) => typeof data[0]?.[col] === 'number',
      );
      if (numericColumns.length > 0) {
        recommendations.push({
          type: 'bar_chart',
          x_axis: categoricalColumns[0],
          y_axis: numericColumns[0],
          description: 'Bar chart showing distribution across categories',
        });
      }
    }

    return recommendations;
  }

  private static formatForCharting(data: any[], columns: string[]): any {
    return {
      datasets: data.map((row, index) => ({
        id: index,
        ...row,
      })),
      columns: columns.map((col) => ({
        name: col,
        type: this.inferColumnType(data, col),
      })),
    };
  }

  private static generateExecutiveSummary(
    data: any[],
    columns: string[],
  ): string {
    if (data.length === 0) return 'No data returned from the analysis.';

    const recordCount = data.length;
    const columnCount = columns.length;

    let summary = `Analysis returned ${recordCount} record${recordCount === 1 ? '' : 's'} across ${columnCount} column${columnCount === 1 ? '' : 's'}. `;

    // Add key metrics if numeric columns exist
    const numericColumns = columns.filter(
      (col) => typeof data[0]?.[col] === 'number',
    );
    if (numericColumns.length > 0) {
      const firstNumericCol = numericColumns[0];
      if (firstNumericCol) {
        const values = data
          .map((row) => row[firstNumericCol])
          .filter((val) => val !== null);
        const total = values.reduce((sum, val) => sum + val, 0);
        summary += `Total ${firstNumericCol}: ${total.toLocaleString()}. `;
      }
    }

    return summary.trim();
  }

  private static generateDetailedAnalysis(data: any[], columns: string[]): any {
    const analysis: any = {
      data_overview: {
        total_records: data.length,
        columns: columns.length,
        column_details: {},
      },
    };

    for (const column of columns) {
      const values = data.map((row) => row[column]);
      const nonNullValues = values.filter(
        (val) => val !== null && val !== undefined,
      );

      analysis.data_overview.column_details[column] = {
        type: this.inferColumnType(data, column),
        null_count: values.length - nonNullValues.length,
        unique_values: new Set(nonNullValues).size,
        sample_values: [...new Set(nonNullValues)].slice(0, 3),
      };
    }

    return analysis;
  }

  private static generateRecommendations(data: any[]): string[] {
    const recommendations = [];

    if (data.length === 0) {
      recommendations.push(
        'Consider refining your query to return relevant data',
      );
      return recommendations;
    }

    if (data.length > 1000) {
      recommendations.push(
        'Large result set - consider adding filters to narrow down results',
      );
    }

    if (data.length < 10) {
      recommendations.push(
        'Small result set - verify if this represents the complete data',
      );
    }

    return recommendations;
  }

  private static generateExplanation(
    sqlResult: any,
    executionResult: any,
  ): any {
    return {
      sql_explanation: sqlResult.explanation,
      query_complexity: sqlResult.estimatedComplexity,
      execution_details: {
        success: executionResult.success,
        time_taken: `${executionResult.metadata.executionTime}ms`,
        records_processed: executionResult.metadata.recordCount,
        cached_result: executionResult.metadata.wasCached,
      },
      warnings: [
        ...(sqlResult.warnings || []),
        ...(executionResult.warnings || []),
      ],
    };
  }

  private static formatSchemaContext(schemaContext: any): any {
    if (!schemaContext) return null;

    if ('tables' in schemaContext) {
      return {
        schema_type: 'database',
        tables: schemaContext.tables.map((table: any) => ({
          name: table.table_name,
          columns: table.columns.length,
          primary_keys: table.primary_keys,
        })),
      };
    } else if (Array.isArray(schemaContext)) {
      return {
        schema_type: 'tables',
        tables: schemaContext.map((table: any) => ({
          name: table.table_name,
          columns: table.columns.length,
        })),
      };
    }

    return null;
  }

  private static inferColumnTypes(
    data: any[],
    columns: string[],
  ): Record<string, string> {
    const types: Record<string, string> = {};

    for (const column of columns) {
      types[column] = this.inferColumnType(data, column);
    }

    return types;
  }

  private static inferColumnType(data: any[], column: string): string {
    if (data.length === 0) return 'unknown';

    const sampleValue = data.find((row) => row[column] != null)?.[column];
    if (sampleValue === undefined) return 'null';

    if (typeof sampleValue === 'number') return 'number';
    if (typeof sampleValue === 'boolean') return 'boolean';
    if (sampleValue instanceof Date) return 'date';
    if (typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue)))
      return 'date_string';

    return 'string';
  }
}
