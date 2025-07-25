/**
 * SQL Validation Utilities for Supabase MCP Testing
 * 
 * Provides comprehensive SQL validation, syntax checking, and security analysis
 * for testing generated SQL queries.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../../../types/database.types';

export interface SQLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityIssues: string[];
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'ALTER' | 'UNKNOWN';
  isReadOnly: boolean;
  tablesAccessed: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface SQLExecutionResult {
  success: boolean;
  rowCount?: number;
  executionTime?: number;
  error?: string;
  data?: any[];
}

export class SQLValidator {
  private supabase: SupabaseClient<Database>;
  
  // Common SQL injection patterns to detect
  private readonly INJECTION_PATTERNS = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*){2,}/i,
    /;\s*(drop|delete|update|insert|create|alter|exec)/i,
    /--\s*[^\r\n]*/,
    /\/\*.*?\*\//,
    /'.*?'\s*(;|--|\||&)/,
    /\b(or|and)\s+\d+\s*=\s*\d+/i,
    /\b(or|and)\s+'[^']*'\s*=\s*'[^']*'/i,
    /\bxp_cmdshell\b/i,
    /\bsp_\w+\b/i
  ];

  // Dangerous SQL keywords that should trigger warnings
  private readonly DANGEROUS_KEYWORDS = [
    'DROP', 'TRUNCATE', 'DELETE', 'UPDATE', 'INSERT', 'CREATE', 'ALTER',
    'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'XP_CMDSHELL', 'SP_EXECUTESQL'
  ];

  // Known table names in our schema for validation
  private readonly KNOWN_TABLES = [
    'users', 'sessions', 'messages', 'agent_conversations', 'tasks',
    'mcp_executions', 'mcp_failures', 'mcp_feedback'
  ];

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Validate SQL syntax and security
   */
  async validateSQL(sql: string): Promise<SQLValidationResult> {
    const result: SQLValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityIssues: [],
      queryType: this.detectQueryType(sql),
      isReadOnly: this.isReadOnlyQuery(sql),
      tablesAccessed: this.extractTableNames(sql),
      estimatedComplexity: this.estimateComplexity(sql)
    };

    // Basic syntax validation
    this.validateBasicSyntax(sql, result);

    // Security validation
    this.validateSecurity(sql, result);

    // Table existence validation
    await this.validateTableExistence(result.tablesAccessed, result);

    // Column validation (basic)
    this.validateColumnReferences(sql, result);

    // Overall validity
    result.isValid = result.errors.length === 0 && result.securityIssues.length === 0;

    return result;
  }

  /**
   * Execute SQL with safety checks and return detailed results
   */
  async executeSQL(sql: string, options: {
    dryRun?: boolean;
    timeout?: number;
    maxRows?: number;
  } = {}): Promise<SQLExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate first
      const validation = await this.validateSQL(sql);
      if (!validation.isValid) {
        return {
          success: false,
          error: `SQL validation failed: ${validation.errors.join(', ')}`
        };
      }

      // If it's a write operation and no dry run specified, require explicit confirmation
      if (!validation.isReadOnly && !options.dryRun) {
        return {
          success: false,
          error: 'Write operations require dry_run=false and explicit confirmation'
        };
      }

      // For dry run, use EXPLAIN
      if (options.dryRun) {
        const explainSQL = `EXPLAIN (ANALYZE false, VERBOSE true, BUFFERS false) ${sql}`;
        const { data, error } = await this.supabase.rpc('execute_sql', { sql: explainSQL });
        
        if (error) {
          return {
            success: false,
            error: error.message,
            executionTime: Date.now() - startTime
          };
        }

        return {
          success: true,
          data: data,
          executionTime: Date.now() - startTime
        };
      }

      // Execute the actual query
      const { data, error, count } = await this.supabase.rpc('execute_sql', { sql });
      
      if (error) {
        return {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime
        };
      }

      return {
        success: true,
        data: data,
        rowCount: count || (Array.isArray(data) ? data.length : 0),
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Detect the type of SQL query
   */
  private detectQueryType(sql: string): SQLValidationResult['queryType'] {
    const trimmed = sql.trim().toUpperCase();
    
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('CREATE')) return 'CREATE';
    if (trimmed.startsWith('DROP')) return 'DROP';
    if (trimmed.startsWith('ALTER')) return 'ALTER';
    
    return 'UNKNOWN';
  }

  /**
   * Check if query is read-only
   */
  private isReadOnlyQuery(sql: string): boolean {
    const dangerous = this.DANGEROUS_KEYWORDS.some(keyword => 
      new RegExp(`\\b${keyword}\\b`, 'i').test(sql)
    );
    return !dangerous && this.detectQueryType(sql) === 'SELECT';
  }

  /**
   * Extract table names from SQL
   */
  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    
    // Simple regex to find table names after FROM, JOIN, UPDATE, INSERT INTO, etc.
    const patterns = [
      /FROM\s+(\w+)/gi,
      /JOIN\s+(\w+)/gi,
      /UPDATE\s+(\w+)/gi,
      /INSERT\s+INTO\s+(\w+)/gi,
      /DELETE\s+FROM\s+(\w+)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(sql)) !== null) {
        const tableName = match[1].toLowerCase();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      }
    });

    return tables;
  }

  /**
   * Estimate query complexity
   */
  private estimateComplexity(sql: string): 'low' | 'medium' | 'high' {
    const upperSQL = sql.toUpperCase();
    let complexity = 0;

    // Count complexity indicators
    if (upperSQL.includes('JOIN')) complexity += 1;
    if (upperSQL.includes('SUBQUERY') || upperSQL.includes('SELECT') && upperSQL.indexOf('SELECT') !== upperSQL.lastIndexOf('SELECT')) complexity += 2;
    if (upperSQL.includes('UNION')) complexity += 2;
    if (upperSQL.includes('WITH') || upperSQL.includes('CTE')) complexity += 2;
    if (upperSQL.includes('WINDOW') || upperSQL.includes('OVER')) complexity += 3;
    if (upperSQL.includes('RECURSIVE')) complexity += 3;
    if (upperSQL.includes('GROUP BY')) complexity += 1;
    if (upperSQL.includes('ORDER BY')) complexity += 1;
    if (upperSQL.includes('HAVING')) complexity += 1;

    if (complexity <= 2) return 'low';
    if (complexity <= 5) return 'medium';
    return 'high';
  }

  /**
   * Validate basic SQL syntax
   */
  private validateBasicSyntax(sql: string, result: SQLValidationResult): void {
    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      result.errors.push('Unbalanced parentheses');
    }

    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      result.errors.push('Unbalanced single quotes');
    }

    // Check for empty query
    if (sql.trim().length === 0) {
      result.errors.push('Empty SQL query');
    }

    // Check for multiple statements (potential security issue)
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      result.warnings.push('Multiple SQL statements detected');
    }

    // Check for common syntax errors
    if (/SELECT\s+FROM/i.test(sql)) {
      result.errors.push('Missing column list in SELECT statement');
    }

    if (/FROM\s+WHERE/i.test(sql)) {
      result.errors.push('Missing table name between FROM and WHERE');
    }
  }

  /**
   * Validate security concerns
   */
  private validateSecurity(sql: string, result: SQLValidationResult): void {
    // Check for SQL injection patterns
    this.INJECTION_PATTERNS.forEach(pattern => {
      if (pattern.test(sql)) {
        result.securityIssues.push('Potential SQL injection pattern detected');
      }
    });

    // Check for dangerous operations
    this.DANGEROUS_KEYWORDS.forEach(keyword => {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(sql)) {
        result.securityIssues.push(`Dangerous operation detected: ${keyword}`);
      }
    });

    // Check for information schema queries (can be used for reconnaissance)
    if (/information_schema/i.test(sql)) {
      result.warnings.push('Information schema access detected');
    }

    // Check for system function calls
    if (/\b(version|current_user|session_user|current_database)\(\)/i.test(sql)) {
      result.warnings.push('System function call detected');
    }
  }

  /**
   * Validate that referenced tables exist
   */
  private async validateTableExistence(tables: string[], result: SQLValidationResult): Promise<void> {
    for (const table of tables) {
      if (!this.KNOWN_TABLES.includes(table)) {
        // Try to check if table exists in database
        try {
          const { error } = await this.supabase
            .from(table as any)
            .select('*')
            .limit(0);
          
          if (error) {
            result.errors.push(`Table '${table}' does not exist or is not accessible`);
          }
        } catch (e) {
          result.warnings.push(`Could not verify existence of table '${table}'`);
        }
      }
    }
  }

  /**
   * Basic column reference validation
   */
  private validateColumnReferences(sql: string, result: SQLValidationResult): void {
    // Known column patterns for common tables
    const tableColumns: Record<string, string[]> = {
      users: ['id', 'email', 'display_name', 'created_at', 'updated_at'],
      sessions: ['id', 'user_id', 'name', 'created_at', 'updated_at'],
      messages: ['id', 'session_id', 'user_id', 'role', 'content', 'timestamp', 'order', 'metadata'],
      agent_conversations: ['id', 'user_id', 'agent_name', 'agent_type', 'started_at', 'ended_at', 'last_active_at', 'metadata', 'created_at', 'updated_at'],
      tasks: ['id', 'agent_conversation_id', 'user_id', 'method', 'prompt', 'params', 'response', 'response_metadata', 'status', 'progress', 'created_at', 'updated_at'],
      mcp_executions: ['id', 'mcp_name', 'tool_name', 'user_id', 'agent_conversation_id', 'session_id', 'request_data', 'response_data', 'llm_provider', 'llm_model', 'execution_time_ms', 'status', 'error_message', 'feedback_token', 'retry_count', 'context_used', 'created_at', 'updated_at'],
      mcp_failures: ['id', 'execution_id', 'error_type', 'error_code', 'error_details', 'retry_attempt', 'sql_attempted', 'context_before_failure', 'created_at', 'resolved'],
      mcp_feedback: ['id', 'feedback_token', 'execution_id', 'user_id', 'rating', 'rating_score', 'comment', 'helpful_tags', 'created_at', 'updated_at']
    };

    // Check for common column name mistakes
    if (/created_date|updated_date/i.test(sql)) {
      result.warnings.push('Use "created_at" and "updated_at" instead of "created_date" and "updated_date"');
    }

    // Check for missing table prefixes in JOINs
    if (/JOIN/i.test(sql) && !/\w+\.\w+/.test(sql)) {
      result.warnings.push('Consider using table prefixes in JOIN queries for clarity');
    }
  }

  /**
   * Test SQL query with sample data
   */
  async testSQLQuery(sql: string, expectedColumns?: string[]): Promise<{
    isValid: boolean;
    canExecute: boolean;
    hasExpectedStructure: boolean;
    executionResult?: SQLExecutionResult;
    validationResult: SQLValidationResult;
  }> {
    const validationResult = await this.validateSQL(sql);
    
    if (!validationResult.isValid) {
      return {
        isValid: false,
        canExecute: false,
        hasExpectedStructure: false,
        validationResult
      };
    }

    // Try to execute with dry run first
    const executionResult = await this.executeSQL(sql, { dryRun: true });
    
    let hasExpectedStructure = true;
    if (expectedColumns && executionResult.success && executionResult.data) {
      // Check if result has expected columns (basic check)
      const firstRow = Array.isArray(executionResult.data) ? executionResult.data[0] : executionResult.data;
      if (firstRow && typeof firstRow === 'object') {
        const actualColumns = Object.keys(firstRow);
        hasExpectedStructure = expectedColumns.every(col => actualColumns.includes(col));
      }
    }

    return {
      isValid: validationResult.isValid,
      canExecute: executionResult.success,
      hasExpectedStructure,
      executionResult,
      validationResult
    };
  }
}