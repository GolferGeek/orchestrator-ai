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
import {
  StreamTokenClaims,
  StreamTokenService,
} from '../services/stream-token.service';

interface AuthenticatedRequest extends Request {
  user?: SupabaseAuthUserDto;
  streamTokenClaims?: StreamTokenClaims;
  sanitizedUrl?: string;
  originalUrl: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly streamTokenService: StreamTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

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

      request.user = {
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

    const bearerToken = this.extractBearerToken(request);
    const queryToken = this.extractQueryToken(request);
    
    // Try bearer token first, then query token
    const token = bearerToken || queryToken;
    
    if (token) {
      try {
        const supabaseClient = this.supabaseService.getAnonClient();
        const {
          data: { user },
          error,
        } = await supabaseClient.auth.getUser(token);

        if (error || !user) {
          throw new UnauthorizedException('Invalid token');
        }

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

        request.user = validatedUser;
        
        // If token came from query params, try to parse as stream token (for backward compatibility)
        if (queryToken && !bearerToken) {
          try {
            const claims = this.streamTokenService.verifyToken(queryToken);
            request.streamTokenClaims = claims;
            request.sanitizedUrl = this.streamTokenService.stripTokenFromUrl(
              request.originalUrl ?? request.url,
            );
          } catch {
            // Not a stream token, that's fine - it's a regular JWT
          }
        }
        
        return true;
      } catch (error) {
        this.logger.warn('Token validation failed', {
          reason: (error as Error)?.message,
          source: bearerToken ? 'header' : 'query',
        });
        // If query token failed as JWT, try as stream token (for backward compatibility)
        if (queryToken && !bearerToken) {
          try {
            const claims = this.streamTokenService.verifyToken(queryToken);
            const validatedUser = this.buildUserFromClaims(claims);
            request.user = validatedUser;
            request.streamTokenClaims = claims;
            request.sanitizedUrl = this.streamTokenService.stripTokenFromUrl(
              request.originalUrl ?? request.url,
            );
            return true;
          } catch {
            // Not a stream token either
          }
        }
        throw new UnauthorizedException('Invalid token');
      }
    }

    throw new UnauthorizedException('No token provided');
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    return token || null;
  }

  private extractQueryToken(request: AuthenticatedRequest): string | null {
    const query: Record<string, unknown> | undefined = request.query as
      | Record<string, unknown>
      | undefined;
    if (!query) {
      return null;
    }
    const raw = query.token ?? query.streamToken;
    if (!raw) {
      return null;
    }
    if (Array.isArray(raw)) {
      return raw.length ? String(raw[0]) : null;
    }
    if (typeof raw === 'string') {
      return raw.trim() ? raw : null;
    }
    return null;
  }

  private buildUserFromClaims(claims: StreamTokenClaims): SupabaseAuthUserDto {
    return {
      id: claims.sub,
      email: claims.email,
      aud: claims.aud ?? 'authenticated',
      role: claims.role ?? 'authenticated',
      appMetadata: {
        provider: 'stream_token',
        providers: ['stream_token'],
      },
      userMetadata: {},
      identities: [],
    };
  }
}
