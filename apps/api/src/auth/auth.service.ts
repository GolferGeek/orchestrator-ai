import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  UserCreateDto,
  UserLoginDto,
  TokenResponseDto,
  AuthenticatedUserResponseDto,
  SupabaseAuthUserDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async signup(userCreateDto: UserCreateDto): Promise<TokenResponseDto> {
    this.logger.log(`Signup attempt for email: ${userCreateDto.email}`);

    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      // Create user in Supabase Auth
      const { data: authResponse, error } = await supabaseClient.auth.signUp({
        email: userCreateDto.email,
        password: userCreateDto.password,
        options: {
          data: {
            display_name:
              userCreateDto.displayName || userCreateDto.email.split('@')[0],
          },
        },
      });

      if (error) {
        this.logger.error(`Signup error: ${error.message}`);
        throw new BadRequestException(
          error.message ||
            'Error during signup. User might already exist or invalid input.',
        );
      }

      // Handle successful signup with session
      if (authResponse.user && authResponse.session?.access_token) {
        this.logger.log(
          `User created successfully with session: ${authResponse.user.id}`,
        );
        return {
          accessToken: authResponse.session.access_token,
          refreshToken: authResponse.session.refresh_token || undefined,
          tokenType: 'bearer',
          expiresIn: authResponse.session.expires_in || undefined,
        };
      }

      // User created but no session (email confirmation required)
      if (authResponse.user && !authResponse.session) {
        this.logger.log(
          `User created but email confirmation required: ${authResponse.user.id}`,
        );
        throw new HttpException(
          'User created successfully. Please check your email to confirm your account before logging in.',
          HttpStatus.ACCEPTED, // 202 Accepted
        );
      }

      // Unexpected response
      throw new BadRequestException(
        'Could not create user or establish session.',
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Unexpected error during signup: ${error}`);
      throw new HttpException(
        'An unexpected error occurred during signup.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async login(userLoginDto: UserLoginDto): Promise<TokenResponseDto> {
    this.logger.log(`Login attempt for email: ${userLoginDto.email}`);

    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      const { data: authResponse, error } =
        await supabaseClient.auth.signInWithPassword({
          email: userLoginDto.email,
          password: userLoginDto.password,
        });

      if (error) {
        this.logger.error(`Login error: ${error.message}`);
        throw new UnauthorizedException(
          error.message || 'Invalid login credentials.',
        );
      }

      if (!authResponse.session?.access_token) {
        this.logger.error(
          `Login succeeded but no session or token received for: ${userLoginDto.email}`,
        );
        throw new BadRequestException(
          'Login succeeded but no session or token received.',
        );
      }

      this.logger.log(`Login successful for: ${userLoginDto.email}`);
      return {
        accessToken: authResponse.session.access_token,
        refreshToken: authResponse.session.refresh_token || undefined,
        tokenType: 'bearer',
        expiresIn: authResponse.session.expires_in || undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Unexpected error during login: ${error}`);
      throw new HttpException(
        'An unexpected error occurred during login.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async logout(token: string): Promise<void> {
    this.logger.log('Logout attempt');

    try {
      // Create an authenticated client with the user's token
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const { error } = await authenticatedClient.auth.signOut();

      if (error) {
        this.logger.error(`Logout error: ${error.message}`);
        throw new BadRequestException(error.message || 'Error during logout.');
      }

      this.logger.log('Logout successful');
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Unexpected error during logout: ${error}`);
      throw new HttpException(
        'An unexpected error occurred during logout.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    this.logger.log('Token refresh attempt');

    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      // Use Supabase's session refresh functionality
      const { data: authResponse, error } = await supabaseClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        this.logger.error(`Token refresh error: ${error.message}`);
        throw new UnauthorizedException(
          error.message || 'Invalid or expired refresh token',
        );
      }

      if (!authResponse.session) {
        this.logger.error('Token refresh failed: No session returned');
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      this.logger.log('Token refresh successful');
      return {
        accessToken: authResponse.session.access_token,
        refreshToken: authResponse.session.refresh_token || undefined,
        tokenType: 'bearer',
        expiresIn: authResponse.session.expires_in || undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Unexpected error during token refresh: ${error}`);
      throw new HttpException(
        'An unexpected error occurred during token refresh.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCurrentUser(
    currentAuthUser: SupabaseAuthUserDto,
    token: string,
  ): Promise<AuthenticatedUserResponseDto> {
    this.logger.log(`Fetching current user profile for: ${currentAuthUser.id}`);

    try {
      // Create an authenticated client to fetch additional profile data
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const { data: userData } = await authenticatedClient
        .from('profiles')
        .select('id, email, display_name, created_at')
        .eq('id', currentAuthUser.id)
        .single();

      if (userData) {
        // Combine auth user data with public profile data
        return {
          id: currentAuthUser.id,
          email: currentAuthUser.email, // Email from auth is authoritative
          displayName: userData.display_name,
        };
      } else {
        // Fallback to auth user data if no public profile found
        this.logger.warn(
          `No public user profile found for auth user: ${currentAuthUser.id}`,
        );
        return {
          id: currentAuthUser.id,
          email: currentAuthUser.email,
          displayName: currentAuthUser.userMetadata?.display_name,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error fetching user profile for ${currentAuthUser.id}: ${error}`,
      );
      throw new HttpException(
        'Could not fetch user profile.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateUser(token: string): Promise<SupabaseAuthUserDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        id: user.id,
        email: user.email,
        aud: user.aud,
        role: user.role,
        appMetadata: user.app_metadata,
        userMetadata: user.user_metadata,
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
        identities: user.identities,
      };
    } catch (error) {
      this.logger.error(`Token validation failed: ${error}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
