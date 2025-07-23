import {
  MCPToolDefinition,
  MCPToolRequest,
  MCPToolResponse,
} from '../../base/interfaces/mcp-server.interface';
import { SimpleSchemaService } from '../services/simple-schema.service';
import { SupabaseClient } from '@supabase/supabase-js';

export class GetSchemaTool {
  static getDefinition(): MCPToolDefinition {
    return {
      name: 'get-schema',
      description:
        'Retrieve database schema information including tables, columns, and relationships',
      inputSchema: {
        type: 'object',
        properties: {
          table_name: {
            type: 'string',
            description:
              'Optional: Get schema for a specific table. If omitted, returns full database schema',
          },
          refresh_cache: {
            type: 'boolean',
            description: 'Force refresh of cached schema data',
            default: false,
          },
          include_relationships: {
            type: 'boolean',
            description: 'Include foreign key relationships in the response',
            default: true,
          },
          format: {
            type: 'string',
            enum: ['detailed', 'summary', 'sql'],
            description: 'Output format for the schema information',
            default: 'detailed',
          },
        },
      },
    };
  }

  static async execute(
    request: MCPToolRequest,
    supabaseClient: SupabaseClient,
    simpleSchemaService: SimpleSchemaService,
  ): Promise<MCPToolResponse> {
    try {
      const {
        table_name,
        refresh_cache = false,
        include_relationships = true,
        format = 'detailed',
      } = request.arguments || {};

      if (refresh_cache) {
        simpleSchemaService.clearCache();
      }

      let schema: any;
      if (table_name) {
        // Get specific table info
        const tableInfo = await simpleSchemaService.getTableInfo(
          supabaseClient,
          table_name,
        );
        if (!tableInfo) {
          return {
            content: [
              {
                type: 'text',
                text: `Table '${table_name}' not found or not accessible`,
              },
            ],
            isError: true,
            _meta: {
              tool: 'get-schema',
              error: `Table not found: ${table_name}`,
            },
          };
        }
        schema = tableInfo;
      } else {
        // Get all accessible tables
        schema = await simpleSchemaService.getSchema(supabaseClient);
      }

      // Format the response based on requested format
      let formattedSchema: any;

      switch (format) {
        case 'summary':
          formattedSchema = this.formatSimpleSchemaSummary(schema);
          break;
        case 'sql':
          formattedSchema = this.formatSimpleSchemaAsSQL(schema);
          break;
        case 'detailed':
        default:
          formattedSchema = this.formatSimpleSchemaDetailed(schema);
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedSchema, null, 2),
          },
        ],
        isError: false,
        _meta: {
          tool: 'get-schema',
          table_requested: table_name || 'all',
          format,
          cache_refreshed: refresh_cache,
          execution_time: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
        _meta: {
          tool: 'get-schema',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Format simple schema as summary
   */
  private static formatSimpleSchemaSummary(schema: any): any {
    if ('tables' in schema) {
      // Full database schema
      return {
        database_summary: {
          total_tables: schema.tables.length,
          accessible_tables: schema.tables.filter((t: any) => t.accessible)
            .length,
          tables: schema.tables.map((table: any) => ({
            name: table.table_name,
            column_count: table.sample_columns.length,
            estimated_rows: table.row_count_estimate,
            accessible: table.accessible,
            sample_columns: table.sample_columns.slice(0, 5), // First 5 columns
          })),
          last_updated: schema.last_updated,
        },
      };
    } else {
      // Single table schema
      return {
        table_summary: {
          name: schema.table_name,
          column_count: schema.sample_columns.length,
          estimated_rows: schema.row_count_estimate,
          accessible: schema.accessible,
          columns: schema.sample_columns,
        },
      };
    }
  }

  /**
   * Format simple schema as detailed view
   */
  private static formatSimpleSchemaDetailed(schema: any): any {
    return schema; // Return as-is for detailed view
  }

  /**
   * Format simple schema as SQL-like description
   */
  private static formatSimpleSchemaAsSQL(schema: any): any {
    if ('tables' in schema) {
      const sqlDescriptions = schema.tables.map((table: any) => {
        const columns = table.sample_columns.join(', ');
        return `-- Table: ${table.table_name} (${table.row_count_estimate} rows)\n-- Accessible columns: ${columns}`;
      });
      return {
        sql_description: sqlDescriptions.join('\n\n'),
        note: 'This is a simplified view. Full schema details require proper information_schema access.',
      };
    } else {
      return {
        sql_description: `-- Table: ${schema.table_name} (${schema.row_count_estimate} rows)\n-- Columns: ${schema.sample_columns.join(', ')}`,
        note: 'This is a simplified view. Full schema details require proper information_schema access.',
      };
    }
  }

  /**
   * Format schema as SQL CREATE TABLE statements
   */
  private static formatSchemaAsSQL(schema: any): any {
    const sqlStatements: string[] = [];

    const tables = 'tables' in schema ? schema.tables : [schema];

    for (const table of tables) {
      let sql = `CREATE TABLE ${table.table_name} (\n`;

      const columnDefinitions = table.columns.map((col: any) => {
        let definition = `  ${col.column_name} ${col.data_type.toUpperCase()}`;

        if (col.character_maximum_length) {
          definition += `(${col.character_maximum_length})`;
        }

        if (!col.is_nullable) {
          definition += ' NOT NULL';
        }

        if (col.column_default) {
          definition += ` DEFAULT ${col.column_default}`;
        }

        return definition;
      });

      sql += columnDefinitions.join(',\n');

      // Add primary key constraint
      if (table.primary_keys.length > 0) {
        sql += `,\n  PRIMARY KEY (${table.primary_keys.join(', ')})`;
      }

      // Add foreign key constraints
      for (const fk of table.foreign_keys) {
        sql += `,\n  FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.referenced_table}(${fk.referenced_column})`;
      }

      sql += '\n);';
      sqlStatements.push(sql);
    }

    return {
      sql_statements: sqlStatements,
      statement_count: sqlStatements.length,
    };
  }

  /**
   * Format schema with full details
   */
  private static formatSchemaDetailed(
    schema: any,
    includeRelationships: boolean,
  ): any {
    if ('tables' in schema) {
      // Full database schema
      const result = {
        database_schema: {
          tables: schema.tables.map((table: any) =>
            this.formatTableDetailed(table, includeRelationships),
          ),
          views: schema.views,
          functions: schema.functions,
          metadata: {
            total_tables: schema.tables.length,
            total_columns: schema.tables.reduce(
              (sum: number, table: any) => sum + table.columns.length,
              0,
            ),
            last_updated: schema.last_updated,
          },
        },
      };
      return result;
    } else {
      // Single table schema
      return {
        table_schema: this.formatTableDetailed(schema, includeRelationships),
      };
    }
  }

  /**
   * Format a single table with full details
   */
  private static formatTableDetailed(
    table: any,
    includeRelationships: boolean,
  ): any {
    const formatted: any = {
      name: table.table_name,
      columns: table.columns.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable,
        default: col.column_default,
        max_length: col.character_maximum_length,
        precision: col.numeric_precision,
        scale: col.numeric_scale,
        is_primary_key: col.is_primary_key,
        is_foreign_key: col.is_foreign_key,
        ...(includeRelationships &&
          col.is_foreign_key && {
            references: {
              table: col.referenced_table,
              column: col.referenced_column,
            },
          }),
      })),
      primary_keys: table.primary_keys,
      indexes: table.indexes.map((idx: any) => ({
        name: idx.index_name,
        columns: idx.column_names,
        unique: idx.is_unique,
        type: idx.index_type,
      })),
      constraints: table.constraints.map((constraint: any) => ({
        name: constraint.constraint_name,
        type: constraint.constraint_type,
        columns: constraint.column_names,
        check_clause: constraint.check_clause,
      })),
    };

    if (includeRelationships) {
      formatted.foreign_keys = table.foreign_keys.map((fk: any) => ({
        constraint_name: fk.constraint_name,
        column: fk.column_name,
        references: {
          table: fk.referenced_table,
          column: fk.referenced_column,
        },
      }));
    }

    return formatted;
  }
}
