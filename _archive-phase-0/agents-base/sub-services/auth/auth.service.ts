import { Injectable, Logger } from '@nestjs/common';

export interface AuthContext {
  currentUser?: any;
  authToken?: string;
  sessionId?: string;
  requestId?: string;
  timestamp?: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Extract authentication context from request parameters
   */
  extractAuthContext(params: any): AuthContext {
    return {
      currentUser: params.currentUser || null,
      authToken: params.authToken || null,
      sessionId: params.sessionId || params.session_id || null,
      requestId: params.requestId || null,
      timestamp: new Date(),
    };
  }

  /**
   * Validate authentication context
   */
  validateAuthContext(authContext: AuthContext): boolean {
    // Basic validation - can be extended with more sophisticated checks
    if (!authContext.currentUser || !authContext.authToken) {
      return false;
    }

    return true;
  }

  /**
   * Log authentication events
   */
  logAuthEvent(event: string, authContext: AuthContext, details?: any): void {}

  /**
   * Get user information from auth context
   */
  getUserInfo(authContext: AuthContext): {
    id?: string;
    email?: string;
    name?: string;
  } {
    if (!authContext.currentUser) {
      return {};
    }

    return {
      id: authContext.currentUser.id,
      email: authContext.currentUser.email,
      name:
        authContext.currentUser.user_metadata?.full_name ||
        authContext.currentUser.user_metadata?.name ||
        authContext.currentUser.email?.split('@')[0] ||
        'Unknown User',
    };
  }

  /**
   * Check if authentication is required for a method
   */
  isAuthRequired(method: string): boolean {
    // Define methods that require authentication
    const authRequiredMethods = [
      'saveMessage',
      'getUserData',
      'updateProfile',
      'deleteData',
    ];

    return authRequiredMethods.includes(method);
  }

  /**
   * Create auth metadata for responses
   */
  createAuthMetadata(authContext: AuthContext): Record<string, any> {
    const userInfo = this.getUserInfo(authContext);

    return {
      userId: userInfo.id,
      userEmail: userInfo.email,
      userName: userInfo.name,
      sessionId: authContext.sessionId,
      authenticatedAt: authContext.timestamp?.toISOString(),
      hasValidAuth: this.validateAuthContext(authContext),
    };
  }
}
