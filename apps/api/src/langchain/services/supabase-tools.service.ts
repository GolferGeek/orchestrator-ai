import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '@/supabase/supabase.service';
import { LangChainClientService } from './langchain-client.service';
import { SqlDatabase } from 'langchain/sql_db';
import { createSqlQueryChain } from 'langchain/chains/sql_db';
import { QuerySqlTool } from 'langchain/tools/sql';

/**
 * Supabase Tools Service for LangChain
 * 
 * Provides natural language to PostgreSQL/Supabase SQL conversion using LangChain.js
 * Specifically optimized for Supabase/PostgreSQL syntax and capabilities
 * Separate from main SupabaseService which handles app core functionality
 */
@Injectable()
export class SupabaseToolsService {
  private readonly logger = new Logger(SupabaseToolsService.name);
  private sqlDatabase: SqlDatabase | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly langchainClient: LangChainClientService,
  ) {
    this.logger.log('🔥 NEW SupabaseToolsService constructor called - code is updated!');
  }

  /**
   * Initialize the SQL database connection for LangChain using Supabase HTTP API
   */
  async initialize(): Promise<void> {
    this.logger.log('🚀 Initializing LangChain SQL Database with Supabase HTTP API...');
    
    const supabaseClient = this.supabaseService.getServiceClient();
    if (!supabaseClient) {
      throw new Error('Supabase service client not available');
    }

    this.logger.log('✅ Using Supabase HTTP API for SQL execution');

    // Create SQL Database interface using Supabase HTTP API
    this.sqlDatabase = {
      async run(query: string) {
        console.log('🔄 Executing SQL via Supabase RPC:', query);
        
        try {
          // Use Supabase RPC function for SQL execution (exec_sql works, execute_sql has parameter issues)
          const { data, error } = await supabaseClient.rpc('exec_sql', { query: query });
          if (error) {
            throw new Error(`SQL execution failed: ${error.message}`);
          }
          console.log('✅ SQL executed successfully via Supabase RPC');
          return data;
        } catch (rpcError) {
          console.log('❌ SQL execution failed:', rpcError);
          throw new Error(`SQL execution failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`);
        }
      },
      
      async getTableInfo() {
        try {
          // Get detailed table schema using existing get_table_info RPC function
          const { data, error } = await supabaseClient.rpc('get_table_info');
          if (error) {
            console.log('⚠️ Schema info RPC failed:', error);
            return "Available tables: users, tasks, conversations, agents, providers, kpi_data";
          }
          
          // Format schema information for LangChain
          const tables: { [key: string]: any[] } = {};
          data.forEach((row: any) => {
            if (!tables[row.table_name]) {
              tables[row.table_name] = [];
            }
            tables[row.table_name]!.push({
              column: row.column_name,
              type: row.data_type,
              nullable: row.is_nullable === 'YES',
              default: row.column_default
            });
          });
          
          // Convert to LangChain-friendly format with business context
          let schemaText = '';
          Object.entries(tables).forEach(([tableName, columns]) => {
            schemaText += `Table: ${tableName}\n`;
            (columns as any[]).forEach((col: any) => {
              schemaText += `  - ${col.column} (${col.type}${col.nullable ? ', nullable' : ', not null'})\n`;
            });
            schemaText += '\n';
          });
          
          // Add relationship information to help with JOINs
          schemaText += `
CRITICAL - Actual Table Relationships:
- companies.id → departments.company_id (one-to-many)
- departments.id → kpi_data.department_id (one-to-many)  
- kpi_metrics.id → kpi_data.metric_id (one-to-many)

CRITICAL - Actual Column Names (DO NOT use other names):
- kpi_data.department_id (uuid, references departments.id)
- kpi_data.metric_id (uuid, references kpi_metrics.id)  
- kpi_data.value (numeric, the actual metric value)
- kpi_data.date_recorded (date, when metric was recorded)
- companies.name (character varying, company name)
- kpi_metrics.name (character varying, metric name)

CRITICAL - Available Metric Names (exact strings):
- "Monthly Revenue", "Quarterly Revenue", "Monthly Recurring Revenue"
- "Sales Conversion Rate", "Sales Team Productivity", "Average Deal Size" 
- "Customer Acquisition Cost", "Customer Lifetime Value"

CRITICAL - What does NOT exist:
- NO provider_id column in kpi_data
- NO sale_id or sale_date columns anywhere
- providers table is for LLM providers, NOT sales data
- NO direct relationship between kpi_data and providers

Business Logic:
- For company revenue/sales: JOIN companies → departments → kpi_data → kpi_metrics
- Always use kpi_data.date_recorded for date filtering
- Always use LIMIT to prevent timeouts
- All sales/revenue data is in kpi_data.value where kpi_metrics.name matches revenue/sales metrics

SQL Syntax Rules:
- NO semicolons in the middle of queries (semicolon only at the very end)
- LIMIT clause comes after WHERE, GROUP BY, ORDER BY clauses
- Correct format: SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY ... LIMIT N;
- NEVER use semicolon before LIMIT: FROM table; LIMIT N is INVALID
          `;
          
          return schemaText;
        } catch (error) {
          console.log('⚠️ Failed to get schema info:', error);
          return "Available tables: users, tasks, conversations, agents, providers, kpi_data";
        }
      },
      
      get allTables() {
        return [
          { tableName: 'companies' },
          { tableName: 'departments' }, 
          { tableName: 'kpi_data' },
          { tableName: 'kpi_metrics' }
        ];
      }
    } as any;

    this.logger.log('✅ LangChain SQL Database initialized with Supabase HTTP API');
  }

  /**
   * Generate and execute SQL from natural language query
   */
  async generateAndExecuteSQL(
    naturalLanguageQuery: string,
    options?: {
      executeQuery?: boolean;
      maxRows?: number;
      provider?: string;
      model?: string;
    },
  ): Promise<{
    sql: string;
    result?: any[];
    error?: string;
    metadata: {
      executionTime: number;
      rowCount?: number;
      provider: string;
      model: string;
    };
  }> {
    const startTime = Date.now();
    const executeQuery = options?.executeQuery ?? true;
    const maxRows = options?.maxRows ?? 100;
    const provider = options?.provider ?? 'openai';
    const model = options?.model ?? 'gpt-4';

    try {
      if (!this.sqlDatabase) {
        await this.initialize();
      }

      if (!this.sqlDatabase) {
        throw new Error('SQL Database not initialized');
      }

      this.logger.debug(`Generating SQL for query: "${naturalLanguageQuery}"`);

      // Get LLM instance for SQL generation with 60 second timeout
      // Use GPT-3.5-turbo for SQL generation to avoid GPT-4 rate limits
      const sqlModel = model === 'gpt-4' ? 'gpt-3.5-turbo' : model;
      const llm = this.langchainClient.getLLM({ provider, model: sqlModel, temperature: 0, timeout: 60000 });

      // Create SQL query chain
      const sqlQueryChain = await createSqlQueryChain({
        llm,
        db: this.sqlDatabase,
        dialect: 'postgres',
      });

      // Generate SQL query with retry logic for rate limits
      let sqlQuery: string = '';
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount <= maxRetries) {
        try {
          sqlQuery = await sqlQueryChain.invoke({
            question: naturalLanguageQuery,
          });
          break; // Success, exit retry loop
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Check if it's a rate limit error
          if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
            retryCount++;
            if (retryCount <= maxRetries) {
              const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
              this.logger.warn(`Rate limit hit, waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          throw error; // Re-throw if not rate limit or max retries exceeded
        }
      }
      
      if (!sqlQuery) {
        throw new Error('Failed to generate SQL after retries');
      }

      // Clean up common SQL syntax issues
      sqlQuery = sqlQuery
        .replace(/;\s*LIMIT/gi, ' LIMIT') // Fix semicolon before LIMIT
        .replace(/;\s*ORDER\s+BY/gi, ' ORDER BY') // Fix semicolon before ORDER BY
        .replace(/;\s*GROUP\s+BY/gi, ' GROUP BY') // Fix semicolon before GROUP BY
        .replace(/;\s*WHERE/gi, ' WHERE') // Fix semicolon before WHERE
        .trim();

      this.logger.debug(`Generated SQL (cleaned): ${sqlQuery}`);

      let result: any[] | undefined;
      let error: string | undefined;
      let rowCount: number | undefined;

      if (executeQuery) {
        try {
          // Execute the generated SQL query
          this.logger.debug(`Executing SQL query...`);
          const queryResult: any = await this.sqlDatabase.run(sqlQuery);
          
          // Handle different result formats from LangChain SQL execution
          if (typeof queryResult === 'string') {
            try {
              // Try to parse as JSON if it's a string
              const parsed = JSON.parse(queryResult);
              if (Array.isArray(parsed)) {
                result = parsed.slice(0, maxRows);
                rowCount = parsed.length;
              } else {
                result = [parsed];
                rowCount = 1;
              }
            } catch {
              // If not JSON, treat as plain text result
              result = [{ result: queryResult }];
              rowCount = 1;
            }
          } else if (Array.isArray(queryResult)) {
            result = queryResult.slice(0, maxRows);
            rowCount = queryResult.length;
          } else if (queryResult && typeof queryResult === 'object') {
            // Handle object results (like TypeORM results)
            if (queryResult.rows && Array.isArray(queryResult.rows)) {
              result = queryResult.rows.slice(0, maxRows);
              rowCount = queryResult.rows.length;
            } else {
              result = [queryResult];
              rowCount = 1;
            }
          } else {
            result = [{ result: queryResult }];
            rowCount = 1;
          }

          this.logger.debug(`Query executed successfully, returned ${rowCount} rows`);
        } catch (executionError) {
          error = executionError instanceof Error ? executionError.message : 'Query execution failed';
          this.logger.error('Query execution failed:', executionError);
        }
      }

      return {
        sql: sqlQuery,
        result,
        error,
        metadata: {
          executionTime: Date.now() - startTime,
          rowCount,
          provider,
          model,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error('Failed to generate/execute SQL:', error);

      return {
        sql: '',
        error: error instanceof Error ? error.message : 'SQL generation failed',
        metadata: {
          executionTime,
          provider,
          model,
        },
      };
    }
  }

  /**
   * Get database schema information
   */
  async getSchemaInfo(): Promise<{
    tables: string[];
    schema: any;
  }> {
    if (!this.sqlDatabase) {
      await this.initialize();
    }

    try {
      const tableInfo = await this.sqlDatabase!.getTableInfo();
      const tables = this.sqlDatabase!.allTables.map(table => table.tableName);
      
      return {
        tables,
        schema: tableInfo,
      };
    } catch (error) {
      this.logger.error('Failed to get schema info:', error);
      throw error;
    }
  }
}