import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { SupabaseAuthUserDto } from '../dto/auth.dto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Check for API key authentication as fallback FIRST
    const testApiKey = request.headers['x-test-api-key'] as string;
    const configuredTestKey = process.env.TEST_API_SECRET_KEY;

    if (configuredTestKey && testApiKey && testApiKey === configuredTestKey) {
      // Prefer configured test user from environment to satisfy DB FKs in development
      const devUserId =
        process.env.SUPABASE_TEST_USERID ||
        '00000000-0000-0000-0000-000000000001';
      const devEmail =
        process.env.SUPABASE_TEST_USER || 'test_api_key_user@example.com';

      (request as any).user = {
        id: devUserId,
        email: devEmail,
        aud: 'authenticated',
        role: 'authenticated',
        appMetadata: { provider: 'api_key', providers: ['api_key'] },
        userMetadata: { name: 'Test API Key User' },
        identities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return true;
    }

    // Only proceed with JWT validation if no valid test API key was provided
    // Extract JWT token from Authorization header
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Verify the token with Supabase
      const supabaseClient = this.supabaseService.getAnonClient();
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user to request object
      const validatedUser: SupabaseAuthUserDto = {
        id: user.id,
        email: user.email,
        aud: user.aud,
        role: user.role,
        appMetadata: user.app_metadata || {},
        userMetadata: user.user_metadata || {},
        phone: user.phone,
        emailConfirmedAt: user.email_confirmed_at
          ? new Date(user.email_confirmed_at)
          : undefined,
        confirmedAt: user.confirmed_at
          ? new Date(user.confirmed_at)
          : undefined,
        lastSignInAt: user.last_sign_in_at
          ? new Date(user.last_sign_in_at)
          : undefined,
        createdAt: user.created_at ? new Date(user.created_at) : undefined,
        updatedAt: user.updated_at ? new Date(user.updated_at) : undefined,
        identities: user.identities || [],
      };

      (request as any).user = validatedUser;
      return true;
    } catch (_error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
