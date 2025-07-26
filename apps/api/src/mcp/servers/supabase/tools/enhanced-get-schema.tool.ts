/**
 * Enhanced Get Schema Tool
 * 
 * Database schema retrieval with multiple output formats and caching.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { MCPToolExecutionOptions } from '../base/intelligent-mcp-base.service';

export interface GetSchemaParameters {
  table_names?: string[];
  format?: 'json' | 'markdown' | 'sql';
  refresh_cache?: boolean;
}

export interface GetSchemaResult {
  schema: any;
  format: string;
  cached: boolean;
  total_tables: number;
  execution_time_ms: number;
}

export class EnhancedGetSchemaTool {
  private schemaCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private _fullSchema: any = null;
  private _schemaBuilding = false;

  constructor(
    private readonly supabaseClient: SupabaseClient,
    private readonly serviceRoleKey?: string
  ) {}

  async execute(
    parameters: GetSchemaParameters,
    options: MCPToolExecutionOptions
  ): Promise<GetSchemaResult> {
    const startTime = Date.now();
    const format = parameters.format || 'json';
    const cacheKey = `schema-${JSON.stringify(parameters.table_names || 'all')}`;

    // Check cache unless refresh is requested
    if (!parameters.refresh_cache) {
      const cached = this.schemaCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return {
          schema: this.formatSchema(cached.data, format),
          format,
          cached: true,
          total_tables: cached.data.tables?.length || 0,
          execution_time_ms: Date.now() - startTime
        };
      }
    }

    try {
      // Get schema information
      const schemaData = await this.getSchemaData(parameters.table_names);
      
      // Cache the result
      this.schemaCache.set(cacheKey, {
        data: schemaData,
        timestamp: Date.now()
      });

      return {
        schema: this.formatSchema(schemaData, format),
        format,
        cached: false,
        total_tables: schemaData.tables?.length || 0,
        execution_time_ms: Date.now() - startTime
      };

    } catch (error) {
      throw new Error(`Failed to get schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get full schema with caching
   */
  private async getFullSchema(): Promise<any> {
    // If schema already exists, return it immediately
    if (this._fullSchema !== null) {
      console.log('Returning cached schema');
      return this._fullSchema;
    }

    // If schema is currently being built, wait for it
    if (this._schemaBuilding) {
      console.log('Schema build in progress, waiting...');
      while (this._schemaBuilding) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this._fullSchema;
    }

    // Build the schema for the first time
    console.log('Building schema for the first time...');
    this._schemaBuilding = true;

    try {
      this._fullSchema = await this.buildSchemaFromDatabase();
      console.log(`Schema built successfully with ${this._fullSchema.tables.length} tables`);
      return this._fullSchema;
    } finally {
      this._schemaBuilding = false;
    }
  }

  /**
   * Build complete schema by querying the actual database using Supabase OpenAPI
   */
  private async buildSchemaFromDatabase(): Promise<any> {
    console.log('Discovering database schema using Supabase OpenAPI...');
    
    try {
      // Get the Supabase project URL and use service role key for full access
      const supabaseUrl = (this.supabaseClient as any).supabaseUrl;
      // Use service role key to bypass RLS and access all tables
      const serviceRoleKey = this.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || (this.supabaseClient as any).supabaseKey;
      
      console.log(`Using key ending in: ${serviceRoleKey.slice(-10)} (length: ${serviceRoleKey.length})`);
      
      // Debug: Check if this is the service role key vs anon key
      const isServiceRole = serviceRoleKey.includes('service_role');
      const isAnon = serviceRoleKey.includes('anon');
      console.log(`Key type: ${isServiceRole ? 'SERVICE_ROLE' : isAnon ? 'ANON' : 'UNKNOWN'}`);
      
      // Fetch the OpenAPI schema from Supabase
      console.log('Fetching OpenAPI schema from Supabase...');
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI schema: ${response.status} ${response.statusText}`);
      }

      const openApiSchema = await response.json();
      
      // Extract table names from the OpenAPI paths
      const tableNames: string[] = [];
      const paths = openApiSchema.paths || {};
      
      for (const path in paths) {
        // Extract table name from path (e.g., "/users" -> "users", "/agent_health_status" -> "agent_health_status")
        const match = path.match(/^\/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (match && match[1] && match[1] !== '' && !match[1].startsWith('rpc_')) {
          const tableName = match[1];
          // Skip the root path and any non-table paths
          if (tableName !== '' && !tableNames.includes(tableName)) {
            tableNames.push(tableName);
          }
        }
      }

      tableNames.sort(); // Sort alphabetically for consistency
      
      console.log(`✓ Found ${tableNames.length} tables from OpenAPI schema: ${tableNames.join(', ')}`);
      console.log(`DEBUG: Total paths in OpenAPI: ${Object.keys(paths).length}`);

      if (tableNames.length === 0) {
        throw new Error('No tables found in OpenAPI schema');
      }

      console.log(`Discovered ${tableNames.length} tables, now getting column information...`);

      // Now get detailed column information for each table using OpenAPI definitions
      const discoveredTables = [];
      const definitions = openApiSchema.definitions || {};
      
      for (const tableName of tableNames) {
        try {
          console.log(`Getting column info for table: ${tableName}`);
          
          let columns = [];
          
          // First try to get column info from OpenAPI definitions
          const tableDefinition = definitions[tableName];
          if (tableDefinition && tableDefinition.properties) {
            console.log(`✓ Found OpenAPI definition for ${tableName}`);
            
            columns = Object.keys(tableDefinition.properties).map((columnName) => {
              const columnDef = tableDefinition.properties[columnName];
              return {
                name: columnName,
                type: this.mapOpenAPIType(columnDef.type, columnDef.format),
                nullable: !tableDefinition.required || !tableDefinition.required.includes(columnName),
                primary_key: columnName === 'id', // Best guess
                default_value: columnDef.default || null
              };
            });
            
            console.log(`✓ Found ${columns.length} columns for ${tableName} from OpenAPI definition`);
          } else {
            console.log(`No OpenAPI definition for ${tableName}, trying sample data approach...`);
            
            // Fallback: try to get column info from sample data
            try {
              const { data: sampleData, error: sampleError } = await this.supabaseClient
                .from(tableName)
                .select('*')
                .limit(1);

              if (!sampleError && sampleData && sampleData.length > 0) {
                const sampleRow = sampleData[0];
                columns = Object.keys(sampleRow).map((columnName) => {
                  const value = sampleRow[columnName];
                  return {
                    name: columnName,
                    type: this.inferTypeFromValue(value),
                    nullable: value === null,
                    primary_key: columnName === 'id',
                    default_value: null
                  };
                });
                console.log(`✓ Inferred ${columns.length} columns for ${tableName} from sample data`);
              } else {
                // Table exists but no accessible data - assume basic structure
                columns = [{
                  name: 'id',
                  type: 'uuid',
                  nullable: false,
                  primary_key: true,
                  default_value: null
                }];
                console.log(`⚠️ Using minimal schema for ${tableName} - table exists but no accessible data`);
              }
            } catch (accessError) {
              // Table exists but access denied - still include it
              columns = [{
                name: 'id',
                type: 'uuid',
                nullable: false,
                primary_key: true,
                default_value: null
              }];
              console.log(`⚠️ Table ${tableName} exists but access restricted - including with minimal schema`);
            }
          }

          // Analyze table purpose from name, columns, and sample data
          const tablePurpose = this.analyzeTablePurpose(tableName, columns);
          
          discoveredTables.push({
            name: tableName,
            columns: columns,
            purpose: tablePurpose.purpose,
            businessContext: tablePurpose.businessContext,
            recordCount: 0, // Will be enhanced later if needed
            hasData: columns.length > 1 // Assume has data if has more than just ID
          });

        } catch (tableError) {
          console.error(`Error getting schema for table ${tableName}:`, tableError);
          // Skip this table and continue
          continue;
        }
      }

      const schema = { tables: discoveredTables };
      console.log(`Successfully built complete schema with ${discoveredTables.length} tables`);
      console.log(`Final table list: ${discoveredTables.map(t => t.name).join(', ')}`);
      
      return schema;

    } catch (error) {
      console.error('Error building schema from database:', error);
      throw new Error(`Failed to build schema from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map OpenAPI types to simplified types
   */
  private mapOpenAPIType(type: string, format?: string): string {
    if (!type) return 'text';
    
    const lowerType = type.toLowerCase();
    const lowerFormat = format ? format.toLowerCase() : '';
    
    if (lowerFormat === 'uuid') return 'uuid';
    if (lowerType === 'integer' || lowerType === 'number') {
      if (lowerFormat === 'int64' || lowerFormat === 'int32') return 'integer';
      return 'numeric';
    }
    if (lowerType === 'boolean') return 'boolean';
    if (lowerFormat === 'date-time' || lowerFormat === 'date') return 'timestamp';
    if (lowerType === 'object') return 'json';
    if (lowerType === 'array') return 'array';
    
    return 'text'; // Default fallback
  }

  /**
   * Map PostgreSQL data types to simplified types
   */
  private mapPostgreSQLType(pgType: string): string {
    const type = pgType.toLowerCase();
    
    if (type.includes('uuid')) return 'uuid';
    if (type.includes('int') || type.includes('serial')) return 'integer';
    if (type.includes('numeric') || type.includes('decimal') || type.includes('float') || type.includes('double')) return 'numeric';
    if (type.includes('bool')) return 'boolean';
    if (type.includes('timestamp') || type.includes('date') || type.includes('time')) return 'timestamp';
    if (type.includes('json')) return 'json';
    if (type.includes('array')) return 'array';
    
    return 'text'; // Default fallback
  }

  /**
   * Infer data type from a sample value
   */
  private inferTypeFromValue(value: any): string {
    if (value === null || value === undefined) return 'text';
    
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'numeric';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'timestamp';
    if (typeof value === 'string') {
      if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return 'uuid';
      }
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return 'timestamp';
      }
    }
    if (typeof value === 'object') return 'json';
    
    return 'text';
  }

  /**
   * Get schema data (filtered version of full schema)
   */
  private async getSchemaData(tableNames?: string[]): Promise<any> {
    const fullSchema = await this.getFullSchema();
    
    // If specific tables requested, filter the full schema
    if (tableNames && tableNames.length > 0) {
      const filteredTables = fullSchema.tables.filter((table: any) => 
        tableNames.includes(table.name)
      );
      return { tables: filteredTables };
    }
    
    // Return full schema
    return fullSchema;
  }


  /**
   * Format schema data according to requested format
   */
  private formatSchema(schemaData: any, format: string): any {
    switch (format) {
      case 'markdown':
        return this.formatAsMarkdown(schemaData);
      case 'sql':
        return this.formatAsSQL(schemaData);
      case 'json':
      default:
        return schemaData;
    }
  }

  /**
   * Format schema as markdown
   */
  private formatAsMarkdown(schemaData: any): string {
    let markdown = '# Database Schema\n\n';
    
    for (const table of schemaData.tables) {
      markdown += `## ${table.name}\n\n`;
      markdown += '| Column | Type | Nullable | Key |\n';
      markdown += '|--------|------|----------|-----|\n';
      
      for (const column of table.columns) {
        const nullable = column.nullable ? 'Yes' : 'No';
        const key = column.primary_key ? 'PK' : column.foreign_key ? 'FK' : '';
        markdown += `| ${column.name} | ${column.type} | ${nullable} | ${key} |\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  /**
   * Format schema as SQL CREATE statements
   */
  private formatAsSQL(schemaData: any): string {
    let sql = '';
    
    for (const table of schemaData.tables) {
      sql += `CREATE TABLE ${table.name} (\n`;
      
      const columnDefs = table.columns.map((column: any) => {
        let def = `  ${column.name} ${column.type}`;
        if (!column.nullable) def += ' NOT NULL';
        if (column.primary_key) def += ' PRIMARY KEY';
        return def;
      });
      
      sql += columnDefs.join(',\n');
      sql += '\n);\n\n';
    }
    
    return sql;
  }

  /**
   * Analyze table purpose based on name, columns, and patterns
   */
  private analyzeTablePurpose(tableName: string, columns: any[]): { purpose: string; businessContext: string } {
    const name = tableName.toLowerCase();
    const columnNames = columns?.map(col => col.name.toLowerCase()) || [];
    
    // Analyze based on table name patterns
    if (name.includes('user')) {
      return {
        purpose: 'User management, authentication, and user-related data storage',
        businessContext: 'User Management'
      };
    }
    
    if (name.includes('agent')) {
      return {
        purpose: 'AI agent system management, tracking, and orchestration',
        businessContext: 'AI/Agent System'
      };
    }
    
    if (name.includes('task')) {
      return {
        purpose: 'Task and workflow management, execution tracking',
        businessContext: 'Task Management'
      };
    }
    
    if (name.includes('mcp')) {
      return {
        purpose: 'Model Context Protocol execution, monitoring, and analytics',
        businessContext: 'MCP System'
      };
    }
    
    if (name.includes('kpi')) {
      return {
        purpose: 'Key Performance Indicator tracking, metrics, and business analytics',
        businessContext: 'Business Intelligence'
      };
    }
    
    if (name.includes('llm') || name.includes('model')) {
      return {
        purpose: 'Large Language Model configuration, usage tracking, and management',
        businessContext: 'AI/LLM System'
      };
    }
    
    if (name.includes('session')) {
      return {
        purpose: 'User session management and interaction tracking',
        businessContext: 'Session Management'
      };
    }
    
    if (name.includes('company') || name.includes('department')) {
      return {
        purpose: 'Organizational structure, company data, and department management',
        businessContext: 'Organization'
      };
    }
    
    if (name.includes('message')) {
      return {
        purpose: 'Communication, messaging, and conversation management',
        businessContext: 'Communication'
      };
    }
    
    if (name.includes('human')) {
      return {
        purpose: 'Human-in-the-loop workflow management and human interaction',
        businessContext: 'Human Interaction'
      };
    }
    
    if (name.includes('provider')) {
      return {
        purpose: 'Service provider configuration and external system management',
        businessContext: 'System Integration'
      };
    }
    
    if (name.includes('cidafm') || name.includes('command')) {
      return {
        purpose: 'Command management and automated instruction processing',
        businessContext: 'Command System'
      };
    }
    
    // Analyze based on column patterns
    if (columnNames.includes('email') || columnNames.includes('password')) {
      return {
        purpose: 'Authentication and user credential management',
        businessContext: 'Authentication'
      };
    }
    
    if (columnNames.includes('metric_id') || columnNames.includes('value') || columnNames.includes('target_value')) {
      return {
        purpose: 'Metrics and performance data tracking for business analytics',
        businessContext: 'Analytics'
      };
    }
    
    if (columnNames.includes('execution_time') || columnNames.includes('status')) {
      return {
        purpose: 'System execution monitoring, status tracking, and performance measurement',
        businessContext: 'System Monitoring'
      };
    }
    
    if (columnNames.includes('api_key') || columnNames.includes('configuration')) {
      return {
        purpose: 'External service configuration and API management',
        businessContext: 'Configuration'
      };
    }
    
    // Default based on common patterns
    if (name.includes('_') && name.split('_').length > 1) {
      const parts = name.split('_');
      const mainEntity = parts[0];
      const qualifier = parts.slice(1).join(' ');
      return {
        purpose: `${mainEntity} ${qualifier} management and specialized data storage`,
        businessContext: 'Specialized Data'
      };
    }
    
    return {
      purpose: 'General data storage and application management',
      businessContext: 'General'
    };
  }
}