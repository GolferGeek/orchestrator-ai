import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export interface TableSchema {
  table_name: string;
  columns: ColumnSchema[];
  primary_keys: string[];
  foreign_keys: ForeignKeySchema[];
  indexes: IndexSchema[];
  constraints: ConstraintSchema[];
}

export interface ColumnSchema {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  referenced_table?: string;
  referenced_column?: string;
}

export interface ForeignKeySchema {
  constraint_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
}

export interface IndexSchema {
  index_name: string;
  column_names: string[];
  is_unique: boolean;
  index_type: string;
}

export interface ConstraintSchema {
  constraint_name: string;
  constraint_type: string;
  column_names: string[];
  check_clause?: string;
}

export interface DatabaseSchema {
  tables: TableSchema[];
  views: string[];
  functions: string[];
  last_updated: Date;
}

/**
 * Service for caching and managing database schema information
 */
@Injectable()
export class SchemaCacheService {
  private readonly logger = new Logger(SchemaCacheService.name);
  private schemaCache: Map<string, DatabaseSchema> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get database schema (from cache or fresh from DB)
   */
  async getSchema(
    supabaseClient: SupabaseClient,
    tableName?: string,
    forceRefresh = false,
  ): Promise<DatabaseSchema | TableSchema> {
    const cacheKey = tableName || 'full_schema';

    // Check cache first (unless force refresh)
    if (!forceRefresh && this.schemaCache.has(cacheKey)) {
      const cached = this.schemaCache.get(cacheKey)!;
      const isExpired =
        Date.now() - cached.last_updated.getTime() > this.cacheTTL;

      if (!isExpired) {
        this.logger.debug(`Schema cache hit for: ${cacheKey}`);
        return tableName ? this.getTableFromSchema(cached, tableName) : cached;
      }
    }

    // Fetch fresh schema
    this.logger.log(`Fetching fresh schema for: ${cacheKey}`);
    const schema = await this.fetchSchemaFromDatabase(
      supabaseClient,
      tableName,
    );

    // Cache the result
    this.schemaCache.set(cacheKey, schema);

    return tableName ? this.getTableFromSchema(schema, tableName) : schema;
  }

  /**
   * Fetch schema information from the database
   */
  private async fetchSchemaFromDatabase(
    supabaseClient: SupabaseClient,
    tableName?: string,
  ): Promise<DatabaseSchema> {
    try {
      const tables = await this.fetchTableSchemas(supabaseClient, tableName);
      const views = await this.fetchViews(supabaseClient);
      const functions = await this.fetchFunctions(supabaseClient);

      return {
        tables,
        views,
        functions,
        last_updated: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch schema from database:', error);
      throw new Error(
        `Failed to fetch database schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetch table schemas with detailed column information
   */
  private async fetchTableSchemas(
    supabaseClient: SupabaseClient,
    tableName?: string,
  ): Promise<TableSchema[]> {
    // Use raw SQL query for information_schema since Supabase client doesn't support it directly
    // Note: For security, we should validate tableName is safe or use parameterized queries
    let sqlQuery: string;
    if (tableName) {
      // Sanitize table name to prevent SQL injection
      const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      if (sanitizedTableName !== tableName) {
        throw new Error(`Invalid table name: ${tableName}`);
      }
      sqlQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name = '${sanitizedTableName}'
        ORDER BY table_name
      `;
    } else {
      sqlQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
    }

    // Try using RPC first, then fallback to pg_tables
    let tables: any[] = [];

    try {
      const { data, error } = await supabaseClient.rpc('exec_sql', {
        query: sqlQuery,
      });
      if (error && error.code === 'PGRST202') {
        // RPC function doesn't exist, use pg_tables as fallback
        let pgQuery = supabaseClient
          .from('pg_tables')
          .select('tablename')
          .eq('schemaname', 'public');

        if (tableName) {
          pgQuery = pgQuery.eq('tablename', tableName);
        }

        const { data: pgData, error: pgError } = await pgQuery;
        if (pgError) {
          throw new Error(`Failed to fetch tables: ${pgError.message}`);
        }
        tables =
          pgData?.map((row: any) => ({ table_name: row.tablename })) || [];
      } else if (error) {
        throw new Error(`Failed to fetch tables: ${error.message}`);
      } else {
        tables = data || [];
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch tables: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const tableSchemas: TableSchema[] = [];

    for (const table of tables) {
      const tableSchema = await this.fetchSingleTableSchema(
        supabaseClient,
        table.table_name,
      );
      tableSchemas.push(tableSchema);
    }

    return tableSchemas;
  }

  /**
   * Fetch detailed schema for a single table
   */
  private async fetchSingleTableSchema(
    supabaseClient: SupabaseClient,
    tableName: string,
  ): Promise<TableSchema> {
    // Sanitize table name to prevent SQL injection
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitizedTableName !== tableName) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    // Use raw SQL to fetch column information from information_schema
    const columnQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = '${sanitizedTableName}'
      ORDER BY ordinal_position
    `;

    let columns: any[] = [];
    try {
      const { data, error } = await supabaseClient.rpc('exec_sql', {
        query: columnQuery,
      });
      if (error && error.code === 'PGRST202') {
        // RPC doesn't exist - try alternative approach using pg_attribute
        const altQuery = `
          SELECT 
            a.attname as column_name,
            t.typname as data_type,
            CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END as is_nullable,
            pg_get_expr(d.adbin, d.adrelid) as column_default,
            CASE WHEN t.typname = 'varchar' THEN a.atttypmod - 4 ELSE NULL END as character_maximum_length,
            CASE WHEN t.typname IN ('numeric', 'decimal') THEN (a.atttypmod - 4) >> 16 ELSE NULL END as numeric_precision,
            CASE WHEN t.typname IN ('numeric', 'decimal') THEN (a.atttypmod - 4) & 65535 ELSE NULL END as numeric_scale,
            a.attnum as ordinal_position
          FROM pg_attribute a
          JOIN pg_class c ON a.attrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          JOIN pg_type t ON a.atttypid = t.oid
          LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
          WHERE n.nspname = 'public' 
            AND c.relname = '${sanitizedTableName}'
            AND a.attnum > 0 
            AND NOT a.attisdropped
          ORDER BY a.attnum
        `;

        const { data: altData, error: altError } = await supabaseClient.rpc(
          'exec_sql',
          { query: altQuery },
        );
        if (altError) {
          throw new Error(
            `Failed to fetch columns for ${tableName}: ${altError.message}`,
          );
        }
        columns = altData || [];
      } else if (error) {
        throw new Error(
          `Failed to fetch columns for ${tableName}: ${error.message}`,
        );
      } else {
        columns = data || [];
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch columns for ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Fetch primary key information
    const primaryKeys = await this.fetchPrimaryKeys(supabaseClient, tableName);

    // Fetch foreign key information
    const foreignKeys = await this.fetchForeignKeys(supabaseClient, tableName);

    // Fetch index information
    const indexes = await this.fetchIndexes(supabaseClient, tableName);

    // Fetch constraint information
    const constraints = await this.fetchConstraints(supabaseClient, tableName);

    // Process columns with relationship information
    const processedColumns: ColumnSchema[] = (columns || []).map((col) => ({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable === 'YES',
      column_default: col.column_default,
      character_maximum_length: col.character_maximum_length,
      numeric_precision: col.numeric_precision,
      numeric_scale: col.numeric_scale,
      is_primary_key: primaryKeys.includes(col.column_name),
      is_foreign_key: foreignKeys.some(
        (fk) => fk.column_name === col.column_name,
      ),
      referenced_table: foreignKeys.find(
        (fk) => fk.column_name === col.column_name,
      )?.referenced_table,
      referenced_column: foreignKeys.find(
        (fk) => fk.column_name === col.column_name,
      )?.referenced_column,
    }));

    return {
      table_name: tableName,
      columns: processedColumns,
      primary_keys: primaryKeys,
      foreign_keys: foreignKeys,
      indexes,
      constraints,
    };
  }

  /**
   * Fetch primary key columns for a table
   */
  private async fetchPrimaryKeys(
    supabaseClient: SupabaseClient,
    tableName: string,
  ): Promise<string[]> {
    // Sanitize table name to prevent SQL injection
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitizedTableName !== tableName) {
      this.logger.warn(
        `Invalid table name for primary key fetch: ${tableName}`,
      );
      return [];
    }

    const pkQuery = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = '${sanitizedTableName}'
      ORDER BY kcu.ordinal_position
    `;

    try {
      const { data, error } = await supabaseClient.rpc('exec_sql', {
        query: pkQuery,
      });
      if (error && error.code === 'PGRST202') {
        // RPC doesn't exist - use alternative query with pg_constraint
        const altQuery = `
          SELECT a.attname as column_name
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          JOIN pg_namespace n ON t.relnamespace = n.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
          WHERE c.contype = 'p'
            AND n.nspname = 'public'
            AND t.relname = '${sanitizedTableName}'
          ORDER BY array_position(c.conkey, a.attnum)
        `;

        const { data: altData, error: altError } = await supabaseClient.rpc(
          'exec_sql',
          { query: altQuery },
        );
        if (altError) {
          this.logger.warn(
            `Failed to fetch primary keys for ${tableName}:`,
            altError,
          );
          return [];
        }
        return altData?.map((row: any) => row.column_name) || [];
      } else if (error) {
        this.logger.warn(
          `Failed to fetch primary keys for ${tableName}:`,
          error,
        );
        return [];
      }

      return data?.map((row: any) => row.column_name) || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch primary keys for ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Fetch foreign key relationships for a table
   */
  private async fetchForeignKeys(
    supabaseClient: SupabaseClient,
    tableName: string,
  ): Promise<ForeignKeySchema[]> {
    // This would require more complex queries to information_schema
    // For now, return empty array - can be enhanced later
    return [];
  }

  /**
   * Fetch index information for a table
   */
  private async fetchIndexes(
    supabaseClient: SupabaseClient,
    tableName: string,
  ): Promise<IndexSchema[]> {
    // This would require querying pg_indexes or similar
    // For now, return empty array - can be enhanced later
    return [];
  }

  /**
   * Fetch constraint information for a table
   */
  private async fetchConstraints(
    supabaseClient: SupabaseClient,
    tableName: string,
  ): Promise<ConstraintSchema[]> {
    // This would require querying information_schema.table_constraints
    // For now, return empty array - can be enhanced later
    return [];
  }

  /**
   * Fetch database views
   */
  private async fetchViews(supabaseClient: SupabaseClient): Promise<string[]> {
    const viewQuery = `
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    try {
      const { data, error } = await supabaseClient.rpc('exec_sql', {
        query: viewQuery,
      });
      if (error && error.code === 'PGRST202') {
        // RPC doesn't exist - use pg_views as fallback
        const { data: pgData, error: pgError } = await supabaseClient
          .from('pg_views')
          .select('viewname')
          .eq('schemaname', 'public');

        if (pgError) {
          this.logger.warn('Failed to fetch views:', pgError);
          return [];
        }
        return pgData?.map((row: any) => row.viewname) || [];
      } else if (error) {
        this.logger.warn('Failed to fetch views:', error);
        return [];
      }

      return data?.map((row: any) => row.table_name) || [];
    } catch (error) {
      this.logger.warn('Failed to fetch views:', error);
      return [];
    }
  }

  /**
   * Fetch database functions
   */
  private async fetchFunctions(
    supabaseClient: SupabaseClient,
  ): Promise<string[]> {
    const functionQuery = `
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `;

    try {
      const { data, error } = await supabaseClient.rpc('exec_sql', {
        query: functionQuery,
      });
      if (error && error.code === 'PGRST202') {
        // RPC doesn't exist - use pg_proc as fallback
        const altQuery = `
          SELECT p.proname as routine_name
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND p.prokind = 'f'
          ORDER BY p.proname
        `;

        const { data: altData, error: altError } = await supabaseClient.rpc(
          'exec_sql',
          { query: altQuery },
        );
        if (altError) {
          this.logger.warn('Failed to fetch functions:', altError);
          return [];
        }
        return altData?.map((row: any) => row.routine_name) || [];
      } else if (error) {
        this.logger.warn('Failed to fetch functions:', error);
        return [];
      }

      return data?.map((row: any) => row.routine_name) || [];
    } catch (error) {
      this.logger.warn('Failed to fetch functions:', error);
      return [];
    }
  }

  /**
   * Get a specific table from the full schema
   */
  private getTableFromSchema(
    schema: DatabaseSchema,
    tableName: string,
  ): TableSchema {
    const table = schema.tables.find((t) => t.table_name === tableName);
    if (!table) {
      throw new Error(`Table not found: ${tableName}`);
    }
    return table;
  }

  /**
   * Clear cache for a specific table or all tables
   */
  clearCache(tableName?: string): void {
    if (tableName) {
      this.schemaCache.delete(tableName);
      this.logger.log(`Schema cache cleared for table: ${tableName}`);
    } else {
      this.schemaCache.clear();
      this.logger.log('All schema cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; size: string } {
    const entries = this.schemaCache.size;
    const sizeEstimate = JSON.stringify([...this.schemaCache.entries()]).length;
    return {
      entries,
      size: `${Math.round(sizeEstimate / 1024)}KB`,
    };
  }
}
