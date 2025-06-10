import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { SupabaseAuthUserDto } from '../dto/auth.dto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check for API key authentication as fallback
    const testApiKey = request.headers['x-test-api-key'] as string;
    const configuredTestKey = process.env.TEST_API_SECRET_KEY;
    
    if (configuredTestKey && testApiKey && testApiKey === configuredTestKey) {
      this.logger.debug('Authenticated via Test API Key');
      (request as any).user = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test_api_key_user@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: { provider: 'api_key', providers: ['api_key'] },
        user_metadata: { name: 'Test API Key User' },
        identities: [],
        created_at: new Date(),
        updated_at: new Date(),
      };
      return true;
    }

    // Extract JWT token from Authorization header
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      this.logger.warn('No token provided in Authorization header');
      throw new UnauthorizedException('No token provided');
    }

    try {
      this.logger.debug(`Validating token: ${token.substring(0, 20)}...`);
      
      // Verify the token with Supabase
      const supabaseClient = this.supabaseService.getAnonClient();
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        this.logger.warn(`Supabase token validation failed: ${error?.message}`);
        throw new UnauthorizedException('Invalid token');
      }

      this.logger.debug(`Token validated successfully for user: ${user.id}`);

      // Attach user to request object
      const validatedUser: SupabaseAuthUserDto = {
        id: user.id,
        email: user.email,
        aud: user.aud,
        role: user.role,
        app_metadata: user.app_metadata || {},
        user_metadata: user.user_metadata || {},
        phone: user.phone,
        email_confirmed_at: user.email_confirmed_at ? new Date(user.email_confirmed_at) : undefined,
        confirmed_at: user.confirmed_at ? new Date(user.confirmed_at) : undefined,
        last_sign_in_at: user.last_sign_in_at ? new Date(user.last_sign_in_at) : undefined,
        created_at: user.created_at ? new Date(user.created_at) : undefined,
        updated_at: user.updated_at ? new Date(user.updated_at) : undefined,
        identities: user.identities || [],
      };

      (request as any).user = validatedUser;
      return true;

    } catch (error) {
      this.logger.error(`JWT validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
} 