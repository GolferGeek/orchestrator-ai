import {
  Injectable,
  OnModuleInit,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private anonClient: SupabaseClient | null = null;
  private serviceClient: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeClients();
  }

  private initializeClients() {
    const url = this.configService.get<string>('supabase.url');
    const anonKey = this.configService.get<string>('supabase.anonKey');
    const serviceKey = this.configService.get<string>('supabase.serviceKey');

    if (!url) {
      this.logger.warn(
        'SUPABASE_URL is not configured - Supabase features will be disabled',
      );
      return;
    }

    // Initialize anonymous client (for RLS-compliant operations)
    if (anonKey) {
      try {
        this.logger.log(
          `Attempting to create Supabase anon client for URL: ${url.substring(0, 20)}...`,
        );
        this.anonClient = createClient(url, anonKey);
        this.logger.log('Supabase anon client created successfully');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error creating Supabase anon client: ${errorMessage}`,
          errorStack,
        );
        throw error;
      }
    } else {
      this.logger.warn(
        'SUPABASE_ANON_KEY not configured. Anonymous client not available.',
      );
    }

    // Initialize service client (bypasses RLS - use with caution)
    if (serviceKey) {
      try {
        this.logger.log(
          `Attempting to create Supabase service client for URL: ${url.substring(0, 20)}...`,
        );
        this.serviceClient = createClient(url, serviceKey);
        this.logger.log('Supabase service client created successfully');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error creating Supabase service client: ${errorMessage}`,
          errorStack,
        );
        throw error;
      }
    } else {
      this.logger.warn(
        'SUPABASE_SERVICE_ROLE_KEY not configured. Service client not available.',
      );
    }
  }

  /**
   * Get the anonymous Supabase client (respects RLS policies)
   * Equivalent to FastAPI's get_supabase_client()
   */
  getAnonClient(): SupabaseClient {
    if (!this.anonClient) {
      this.logger.error(
        'Supabase anonymous client is not available. Check configuration.',
      );
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
      this.logger.error(
        'Supabase service client is not available. Check configuration.',
      );
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
    const url = this.configService.get<string>('supabase.url');
    const anonKey = this.configService.get<string>('supabase.anonKey');

    if (!url || !anonKey) {
      this.logger.error(
        'Supabase URL or Anon Key not configured for authenticated client creation',
      );
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

      this.logger.log(
        `Created authenticated client instance for token: ${token.substring(0, 20)}...`,
      );

      return authenticatedClient;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error creating authenticated Supabase client: ${errorMessage}`,
        errorStack,
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Database operation failed: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
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
      const { error } = await this.anonClient
        .from('users') // Assuming users table exists from FastAPI schema
        .select('id')
        .limit(1);

      if (error) {
        this.logger.warn(`Health check query failed: ${error.message}`);
        return { status: 'error', message: error.message };
      }

      return { status: 'ok', message: 'Database connection successful' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Health check failed: ${errorMessage}`, errorStack);
      return { status: 'error', message: errorMessage };
    }
  }
}
