import { createClient } from '@supabase/supabase-js';
import {
  initializeDatabaseSchema,
  getSchemaContext,
  getTablesByDomain,
  getAllTableNames,
} from './database-schema';
import { getLLM, initializeLangChain } from './langchain-client';
import { SqlDatabase } from 'langchain/sql_db';
import { createSqlQueryChain } from 'langchain/chains/sql_db';

// Global state for Supabase tools
let supabaseClient: any = null;
let sqlDatabase: SqlDatabase | null = null;
let initialized = false;

// Configuration interface
export interface SupabaseToolsConfig {
  tableNames?: string[];
  includeDomains?: string[];
  agentName?: string;
}

// Result interface
export interface SQLExecutionResult {
  sql: string;
  result?: any[];
  error?: string;
  metadata: {
    executionTime: number;
    rowCount?: number;
    provider: string;
    model: string;
  };
}

/**
 * Initialize Supabase client if not already done
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl =
      process.env.SUPABASE_URL || 'https://jcmkjecmdugfzvdijodg.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY environment variable is required',
      );
    }

    supabaseClient = createClient(supabaseUrl, serviceKey);
    console.log('✅ Supabase client initialized for tools');
  }
  return supabaseClient;
}

/**
 * Create SQL Database interface for LangChain
 */
async function createSqlDatabase(
  config?: SupabaseToolsConfig,
): Promise<SqlDatabase> {
  if (!sqlDatabase) {
    const client = getSupabaseClient();

    // Create SQL Database interface using Supabase HTTP API
    sqlDatabase = {
      async run(query: string) {
        console.log('🔄 Executing SQL via Supabase RPC:', query);

        try {
          // Use Supabase RPC function for SQL execution
          const { data, error } = await client.rpc('exec_sql', {
            query: query,
          });
          if (error) {
            throw new Error(`SQL execution failed: ${error.message}`);
          }
          console.log('✅ SQL executed successfully via Supabase RPC');
          return data;
        } catch (rpcError) {
          console.log('❌ SQL execution failed:', rpcError);
          throw new Error(
            `SQL execution failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`,
          );
        }
      },

      async getTableInfo() {
        // Get schema context from database schema utilities
        const schemaContext = await getDatabaseSchemaInfo(config);
        return schemaContext;
      },

      get allTables() {
        // This needs to be synchronous for LangChain, so we'll implement a cached version
        // For now, return a promise that resolves to table info
        return getTableNames(config).then((names) =>
          names.map((name) => ({ tableName: name })),
        );
      },
    } as any;

    console.log('✅ SQL Database interface created for LangChain');
  }

  // TypeScript assertion since we know sqlDatabase is not null after the if check
  return sqlDatabase!;
}

/**
 * Initialize the SQL database connection for LangChain using Supabase HTTP API
 */
export async function initializeSupabaseTools(
  config?: SupabaseToolsConfig,
): Promise<void> {
  if (initialized) {
    console.log('🔄 Supabase tools already initialized');
    return;
  }

  console.log('🚀 Initializing Supabase tools with LangChain SQL support...');

  // Initialize database schema first
  await initializeDatabaseSchema();

  // Initialize LangChain client
  initializeLangChain();

  // Create SQL database interface
  await createSqlDatabase(config);

  const client = getSupabaseClient();
  console.log('✅ Supabase client and LangChain ready for SQL execution');

  if (config?.agentName) {
    console.log(`🤖 Initialized for agent: ${config.agentName}`);
  }

  if (config?.includeDomains) {
    console.log(`📊 Including domains: ${config.includeDomains.join(', ')}`);
  }

  if (config?.tableNames) {
    console.log(`📋 Including tables: ${config.tableNames.join(', ')}`);
  }

  initialized = true;
  console.log('✅ Supabase tools initialization complete');
}

/**
 * Execute SQL query directly via Supabase RPC
 */
export async function executeSQL(query: string): Promise<any> {
  await initializeSupabaseTools();

  const client = getSupabaseClient();
  console.log('🔄 Executing SQL via Supabase RPC:', query);

  try {
    const { data, error } = await client.rpc('exec_sql', { query });
    if (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
    console.log('✅ SQL executed successfully via Supabase RPC');
    return data;
  } catch (rpcError) {
    console.log('❌ SQL execution failed:', rpcError);
    throw new Error(
      `SQL execution failed: ${rpcError instanceof Error ? rpcError.message : 'Unknown error'}`,
    );
  }
}

/**
 * Get database schema information with agent-specific filtering
 */
export async function getDatabaseSchemaInfo(
  config?: SupabaseToolsConfig,
): Promise<string> {
  await initializeDatabaseSchema();

  const schemaContext = await getSchemaContext({
    tableNames: config?.tableNames,
    includeDomains: config?.includeDomains,
    includeRelationships: true,
    includeBusinessContext: true,
  });

  const sqlRules = `
SQL Syntax Rules:
- NO semicolons in the middle of queries (semicolon only at the very end)
- LIMIT clause comes after WHERE, GROUP BY, ORDER BY clauses
- Correct format: SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY ... LIMIT N;
- NEVER use semicolon before LIMIT: FROM table; LIMIT N is INVALID

Query Optimization:
- Always use LIMIT to prevent timeouts
- Use indexes when available (most tables have id, created_at indexes)
- For date filtering, use appropriate date columns
  `;

  return schemaContext + sqlRules;
}

/**
 * Get table names based on configuration
 */
export async function getTableNames(
  config?: SupabaseToolsConfig,
): Promise<string[]> {
  await initializeDatabaseSchema();

  if (config?.tableNames) {
    return config.tableNames;
  }

  if (config?.includeDomains) {
    const tables: string[] = [];
    for (const domain of config.includeDomains) {
      const domainTables = await getTablesByDomain(domain);
      tables.push(...domainTables.map((t) => t.name));
    }
    return [...new Set(tables)]; // Remove duplicates
  }

  return await getAllTableNames();
}

/**
 * Clean up common SQL syntax issues
 */
function cleanSQL(sqlQuery: string): string {
  return sqlQuery
    .replace(/;\s*LIMIT/gi, ' LIMIT') // Fix semicolon before LIMIT
    .replace(/;\s*ORDER\s+BY/gi, ' ORDER BY') // Fix semicolon before ORDER BY
    .replace(/;\s*GROUP\s+BY/gi, ' GROUP BY') // Fix semicolon before GROUP BY
    .replace(/;\s*WHERE/gi, ' WHERE') // Fix semicolon before WHERE
    .trim();
}

/**
 * Generate and execute SQL from natural language query
 */
export async function generateAndExecuteSQL(
  naturalLanguageQuery: string,
  options?: {
    executeQuery?: boolean;
    maxRows?: number;
    provider?: string;
    model?: string;
    agentContext?: string;
    config?: SupabaseToolsConfig;
  },
): Promise<SQLExecutionResult> {
  const startTime = Date.now();
  const executeQuery = options?.executeQuery ?? true;
  const maxRows = options?.maxRows ?? 100;
  const provider = options?.provider ?? 'openai';
  const model = options?.model ?? 'gpt-4';

  try {
    await initializeSupabaseTools(options?.config);

    console.log(`Generating SQL for query: "${naturalLanguageQuery}"`);

    // Get SQL database interface
    const sqlDb = await createSqlDatabase(options?.config);
    if (!sqlDb) {
      throw new Error('SQL Database not initialized');
    }

    // Get LLM instance for SQL generation with 60 second timeout
    // Use GPT-3.5-turbo for SQL generation to avoid GPT-4 rate limits
    const sqlModel = model === 'gpt-4' ? 'gpt-3.5-turbo' : model;
    const llm = getLLM({
      provider,
      model: sqlModel,
      temperature: 0,
      timeout: 60000,
    });

    // Create SQL query chain
    const sqlQueryChain = await createSqlQueryChain({
      llm,
      db: sqlDb,
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
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Check if it's a rate limit error
        if (
          errorMessage.includes('Rate limit') ||
          errorMessage.includes('429')
        ) {
          retryCount++;
          if (retryCount <= maxRetries) {
            const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(
              `Rate limit hit, waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
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
    sqlQuery = cleanSQL(sqlQuery);
    console.log(`Generated SQL (cleaned): ${sqlQuery}`);

    let result: any[] | undefined;
    let error: string | undefined;
    let rowCount: number | undefined;

    if (executeQuery) {
      try {
        // Execute the generated SQL query
        console.log(`Executing SQL query...`);
        const queryResult: any = await sqlDb.run(sqlQuery);

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

        console.log(`Query executed successfully, returned ${rowCount} rows`);
      } catch (executionError) {
        error =
          executionError instanceof Error
            ? executionError.message
            : 'Query execution failed';
        console.error('Query execution failed:', executionError);
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
    console.error('Failed to generate/execute SQL:', error);

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
 * Get schema information for agents
 */
export async function getSchemaInfo(config?: SupabaseToolsConfig): Promise<{
  tables: string[];
  schema: string;
}> {
  await initializeSupabaseTools(config);

  try {
    // Get SQL database interface and extract table info
    const sqlDb = await createSqlDatabase(config);
    const tables = await getTableNames(config);
    const schema = await sqlDb.getTableInfo();

    return {
      tables,
      schema,
    };
  } catch (error) {
    console.error('Failed to get schema info:', error);
    throw error;
  }
}

/**
 * Check if Supabase tools are initialized
 */
export function isSupabaseToolsInitialized(): boolean {
  return initialized;
}

/**
 * Initialize for a specific agent with domain/table scope
 */
export async function initializeForAgent(agentOptions: {
  tableNames?: string[];
  includeDomains?: string[];
  agentName?: string;
}): Promise<void> {
  console.log(
    `🤖 Initializing Supabase tools for agent: ${agentOptions.agentName || 'unnamed'}`,
  );
  await initializeSupabaseTools(agentOptions);
}
