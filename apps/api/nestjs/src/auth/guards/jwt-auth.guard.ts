import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    // Add custom logic here if needed
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check for API key authentication as fallback (similar to FastAPI implementation)
    const testApiKey = request.headers['x-test-api-key'] as string;
    const configuredTestKey = process.env.TEST_API_SECRET_KEY;
    
    if (configuredTestKey && testApiKey && testApiKey === configuredTestKey) {
      this.logger.debug('Authenticated via Test API Key');
      return {
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
    }
    
    // If there's an error or no user, throw an exception
    if (err || !user) {
      this.logger.warn(`Authentication failed: ${err?.message || info?.message || 'No user found'}`);
      throw err || new UnauthorizedException('Authentication failed');
    }
    
    return user;
  }
} 