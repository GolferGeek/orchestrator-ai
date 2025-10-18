import {
  Injectable,
  OnModuleInit,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getTableName, getSchemaForTable } from './supabase.config';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private anonClient: SupabaseClient | null = null;
  private serviceClient: SupabaseClient | null = null;
  private coreSchema!: string;
  private companySchema!: string;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeClients();
  }

  private initializeClients() {
    // Get configuration
    const url =
      this.configService.get<string>('supabase.url') ||
      this.configService.get<string>('SUPABASE_URL');
    const anonKey =
      this.configService.get<string>('supabase.anonKey') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');
    const serviceKey =
      this.configService.get<string>('supabase.serviceKey') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const coreSchema =
      this.configService.get<string>('supabase.coreSchema') ||
      this.configService.get<string>('SUPABASE_CORE_SCHEMA') ||
      'public';
    const companySchema =
      this.configService.get<string>('supabase.companySchema') ||
      this.configService.get<string>('SUPABASE_COMPANY_SCHEMA') ||
      'public';

    // Both schemas are now 'public' after consolidation, but keep variables for compatibility

    // Log the configuration

    // Store schema configuration for easy access
    this.coreSchema = coreSchema;
    this.companySchema = companySchema;

    if (!url) {
      return;
    }

    // Initialize anonymous client (for RLS-compliant operations)
    if (anonKey) {
      this.anonClient = createClient(url, anonKey, {
        global: {
          fetch: (requestUrl, options = {}) =>
            fetch(requestUrl, {
              ...options,
              signal: AbortSignal.timeout(60000), // 60 second timeout
            }),
        },
      });
    }

    // Initialize service client (bypasses RLS - use with caution)
    if (serviceKey) {
      this.serviceClient = createClient(url, serviceKey, {
        global: {
          fetch: (requestUrl, options = {}) =>
            fetch(requestUrl, {
              ...options,
              signal: AbortSignal.timeout(60000), // 60 second timeout
            }),
        },
      });
    }
  }

  /**
   * Get the anonymous Supabase client (respects RLS policies)
   * Equivalent to FastAPI's get_supabase_client()
   */
  getAnonClient(): SupabaseClient {
    if (!this.anonClient) {
      throw new HttpException(
        'Supabase client is not available. Check server configuration.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.anonClient;
  }

  /**
   * Get the service role client (bypasses RLS - use with extreme caution)
   * Equivalent to FastAPI's get_supabase_service_client()
   */
  getServiceClient(): SupabaseClient {
    if (!this.serviceClient) {
      throw new HttpException(
        'Supabase service client is not available. Check server configuration.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.serviceClient;
  }

  /**
   * Create a new client instance with a specific auth token
   * Equivalent to FastAPI's get_supabase_client_as_current_user()
   */
  createAuthenticatedClient(token: string): SupabaseClient {
    const url =
      this.configService.get<string>('supabase.url') ||
      this.configService.get<string>('SUPABASE_URL');
    const anonKey =
      this.configService.get<string>('supabase.anonKey') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!url || !anonKey) {
      throw new HttpException(
        'Authentication service configuration error.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const authenticatedClient = createClient(url, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      return authenticatedClient;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not create authenticated client.';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        'Could not create authenticated client.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  /**
   * Execute a query with proper error handling and connection management
   * Ports the error handling patterns from FastAPI
   */
  async executeQuery<T>(
    callback: (client: SupabaseClient) => Promise<T>,
    useServiceClient = false,
  ): Promise<T> {
    const client = useServiceClient
      ? this.getServiceClient()
      : this.getAnonClient();

    try {
      return await callback(client);
    } catch (error) {
      this.logger.error(
        'Supabase query execution failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get current Supabase configuration information
   */
  getConfig(): {
    url: string;
    coreSchema: string;
    companySchema: string;
    clientsAvailable: {
      anon: boolean;
      service: boolean;
    };
  } {
    const url =
      this.configService.get<string>('supabase.url') ||
      this.configService.get<string>('SUPABASE_URL') ||
      '';

    return {
      url: url.substring(0, 30) + '...', // Truncate for security
      coreSchema: this.coreSchema,
      companySchema: this.companySchema,
      clientsAvailable: {
        anon: this.anonClient !== null,
        service: this.serviceClient !== null,
      },
    };
  }

  /**
   * Get schema-aware table name
   */
  getTableName(tableName: string, explicitSchema?: string): string {
    return getTableName(tableName, explicitSchema);
  }

  /**
   * Get core schema name
   */
  getCoreSchema(): string {
    return this.coreSchema;
  }

  /**
   * Get company schema name
   */
  getCompanySchema(): string {
    return this.companySchema;
  }

  /**
   * Health check for database connectivity
   * Can be used to verify Supabase connection status
   */
  async checkConnection(): Promise<{ status: string; message: string }> {
    if (!this.anonClient) {
      return {
        status: 'disabled',
        message: 'Supabase not configured - service disabled',
      };
    }

    try {
      // Attempt a simple query to test connectivity
      const schema = getSchemaForTable('users');
      const { error } = await this.anonClient
        .schema(schema)
        .from(getTableName('users'))
        .select('id')
        .limit(1);

      if (error) {
        return { status: 'error', message: error.message };
      }

      return { status: 'ok', message: 'Database connection successful' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Supabase health check failed',
        error instanceof Error ? error.stack : undefined,
      );
      return { status: 'error', message };
    }
  }
}
