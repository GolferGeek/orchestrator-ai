import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

export interface SimpleTableSchema {
  table_name: string;
  sample_columns: string[];
  row_count_estimate: number;
  accessible: boolean;
}

export interface SimpleSchema {
  tables: SimpleTableSchema[];
  last_updated: Date;
}

@Injectable()
export class SimpleSchemaService {
  private readonly logger = new Logger(SimpleSchemaService.name);
  private schemaCache = new Map<string, SimpleSchema>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  async getSchema(supabaseClient: SupabaseClient): Promise<SimpleSchema> {
    const cacheKey = 'simple-schema';
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && Date.now() - cached.last_updated.getTime() < this.cacheTTL) {
      return cached;
    }

    // Get actual table names from database schema - NO HARDCODING EVER
    let tableNames: string[] = [];
    
    // Method 1: Try custom RPC function for getting table names
    try {
      const { data: rpcData, error: rpcError } = await supabaseClient.rpc('get_table_names');
      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        tableNames = rpcData.map((row: any) => row.table_name || row.tablename || row);
        this.logger.log(`Found ${tableNames.length} tables via RPC get_table_names`);
      }
    } catch (e) {
      // RPC doesn't exist, try next method
    }

    // Method 2: Try querying information_schema via RPC
    if (tableNames.length === 0) {
      try {
        const { data: schemaData, error: schemaError } = await supabaseClient.rpc('exec_sql', {
          query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
        });
        if (!schemaError && schemaData && Array.isArray(schemaData)) {
          tableNames = schemaData.map((row: any) => row.table_name);
          this.logger.log(`Found ${tableNames.length} tables via information_schema`);
        }
      } catch (e) {
        // RPC exec_sql doesn't exist, try next method  
      }
    }

    // Method 3: Try querying pg_tables via RPC
    if (tableNames.length === 0) {
      try {
        const { data: pgData, error: pgError } = await supabaseClient.rpc('exec_sql', {
          query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        });
        if (!pgError && pgData && Array.isArray(pgData)) {
          tableNames = pgData.map((row: any) => row.tablename);
          this.logger.log(`Found ${tableNames.length} tables via pg_tables`);
        }
      } catch (e) {
        // RPC exec_sql doesn't exist
      }
    }

    // If we still have no tables, we cannot proceed
    if (tableNames.length === 0) {
      this.logger.error('Cannot discover database tables: No RPC functions available for schema discovery');
      throw new Error('Database schema discovery failed: Unable to query system tables. Please ensure RPC functions are available.');
    }

    // Now get detailed info for each discovered table
    const foundTables: SimpleTableSchema[] = [];

    for (const tableName of tableNames) {
      try {
        // Test if table is accessible and get basic info
        const { data, error, count } = await supabaseClient
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1);

        if (!error && data !== null) {
          // Extract column names from the first row if available
          let columns: string[] = [];
          if (data.length > 0) {
            columns = Object.keys(data[0]);
          } else {
            // If no data, try to get column names by querying with head: true
            const { data: headData, error: headError } = await supabaseClient
              .from(tableName)
              .select('*')
              .limit(0);
            
            if (!headError && headData !== null) {
              columns = ['(no data available for column inspection)'];
            }
          }

          foundTables.push({
            table_name: tableName,
            sample_columns: columns.slice(0, 15), // Show more columns
            row_count_estimate: count || 0,
            accessible: true
          });

          this.logger.debug(`Accessible table: ${tableName} (${columns.length} columns, ~${count} rows)`);
        } else {
          this.logger.debug(`Table ${tableName} exists but is not accessible: ${error?.message}`);
        }
      } catch (e) {
        this.logger.debug(`Cannot access table ${tableName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    const schema: SimpleSchema = {
      tables: foundTables,
      last_updated: new Date()
    };

    // Cache the result
    this.schemaCache.set(cacheKey, schema);
    
    this.logger.log(`Schema discovery complete: ${foundTables.length} accessible tables out of ${tableNames.length} total tables`);
    
    return schema;
  }

  async getTableInfo(supabaseClient: SupabaseClient, tableName: string): Promise<SimpleTableSchema | null> {
    try {
      const { data, error, count } = await supabaseClient
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(1);

      if (error || data === null) {
        return null;
      }

      let columns: string[] = [];
      if (data.length > 0) {
        columns = Object.keys(data[0]);
      }

      return {
        table_name: tableName,
        sample_columns: columns,
        row_count_estimate: count || 0,
        accessible: true
      };
    } catch (e) {
      return null;
    }
  }

  clearCache(): void {
    this.schemaCache.clear();
  }
}