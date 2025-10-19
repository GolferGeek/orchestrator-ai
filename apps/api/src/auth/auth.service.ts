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
  UserProfileDto,
} from './dto/auth.dto';
import {
  CreateUserDto,
  CreateUserResponseDto,
} from './dto/admin-user-management.dto';
import { UserRole } from './decorators/roles.decorator';
import { getTableName } from '../supabase/supabase.config';

/**
 * Database record type for users table
 */
interface UserDbRecord {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
  created_at: string;
  updated_at: string;
  namespace_access?: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async signup(userCreateDto: UserCreateDto): Promise<TokenResponseDto> {
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
        throw new BadRequestException(
          error.message ||
            'Error during signup. User might already exist or invalid input.',
        );
      }

      // Handle successful signup with session
      if (authResponse.user && authResponse.session?.access_token) {
        return {
          accessToken: authResponse.session.access_token,
          refreshToken: authResponse.session.refresh_token || undefined,
          tokenType: 'bearer',
          expiresIn: authResponse.session.expires_in || undefined,
        };
      }

      // User created but no session (email confirmation required)
      if (authResponse.user && !authResponse.session) {
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

      throw new HttpException(
        'An unexpected error occurred during signup.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async login(userLoginDto: UserLoginDto): Promise<TokenResponseDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      const { data: authResponse, error } =
        await supabaseClient.auth.signInWithPassword({
          email: userLoginDto.email,
          password: userLoginDto.password,
        });

      if (error) {
        throw new UnauthorizedException(
          error.message || 'Invalid login credentials.',
        );
      }

      if (!authResponse.session?.access_token) {
        throw new BadRequestException(
          'Login succeeded but no session or token received.',
        );
      }

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

      throw new HttpException(
        'An unexpected error occurred during login.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async logout(token: string): Promise<void> {
    try {
      // Create an authenticated client with the user's token
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const { error } = await authenticatedClient.auth.signOut();

      if (error) {
        throw new BadRequestException(error.message || 'Error during logout.');
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'An unexpected error occurred during logout.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      // Use Supabase's session refresh functionality
      const { data: authResponse, error } =
        await supabaseClient.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (error) {
        throw new UnauthorizedException(
          error.message || 'Invalid or expired refresh token',
        );
      }

      if (!authResponse.session) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

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

      throw new HttpException(
        'An unexpected error occurred during token refresh.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCurrentUser(
    currentAuthUser: SupabaseAuthUserDto,
    _token: string,
  ): Promise<AuthenticatedUserResponseDto> {
    try {
      // Use service role client to bypass RLS issues temporarily
      const serviceClient = this.supabaseService.getServiceClient();

      const { data: userData } = await serviceClient
        .from(getTableName('users'))
        .select('id, email, display_name, roles, created_at, namespace_access')
        .eq('id', currentAuthUser.id)
        .single();

      if (userData) {
        const namespaceAccess = Array.isArray(userData.namespace_access)
          ? (userData.namespace_access as string[])
          : [];

        if (!namespaceAccess.length) {
          throw new HttpException(
            'User has no namespace access configured. Please contact an administrator.',
            HttpStatus.FORBIDDEN,
          );
        }

        return {
          id: currentAuthUser.id,
          email: currentAuthUser.email,
          displayName: userData.display_name as string,
          roles: (userData.roles as UserRole[]) || [UserRole.USER],
          namespaceAccess,
        };
      }

      throw new HttpException(
        'User profile not found in namespace directory.',
        HttpStatus.FORBIDDEN,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

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
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get user profile with roles
   */
  async getUserProfile(userId: string): Promise<UserProfileDto | null> {
    try {
      const { data: result, error } = await this.supabaseService
        .getAnonClient()
        .from(getTableName('users'))
        .select(
          'id, email, display_name, roles, created_at, updated_at, namespace_access',
        )
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Database error: ${error.message}`);
      }

      const data = result as UserDbRecord | null;
      if (!data) {
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        roles: (data.roles as UserRole[]) || [UserRole.USER],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        namespaceAccess: Array.isArray(data.namespace_access)
          ? data.namespace_access
          : [],
      };
    } catch {
      throw new HttpException(
        'Could not fetch user profile.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getNamespaceAccessForUser(userId: string): Promise<string[]> {
    const profile = await this.getUserProfile(userId);
    if (!profile || !profile.namespaceAccess?.length) {
      throw new HttpException(
        'Namespace access is not configured for this user.',
        HttpStatus.FORBIDDEN,
      );
    }

    return profile.namespaceAccess;
  }

  /**
   * Check if user has a specific role
   */
  async userHasRole(userId: string, role: UserRole): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return false;
    }
    return profile.roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   */
  async userHasAnyRole(userId: string, roles: UserRole[]): Promise<boolean> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return false;
    }
    return roles.some((role) => profile.roles.includes(role));
  }

  /**
   * Add role to user (for admin use)
   */
  async addUserRole(
    targetUserId: string,
    role: UserRole,
    adminUserId: string,
    reason?: string,
  ): Promise<UserProfileDto> {
    const profile = await this.getUserProfile(targetUserId);
    if (!profile) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (profile.roles.includes(role)) {
      return profile; // Already has role
    }

    const newRoles = [...profile.roles, role];
    const { error } = await this.supabaseService
      .getAnonClient()
      .from('users')
      .update({ roles: newRoles })
      .eq('id', targetUserId);

    if (error) {
      throw new HttpException(
        `Failed to add role: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Log the change
    await this.logRoleChange(
      targetUserId,
      adminUserId,
      'add_role',
      profile.roles,
      newRoles,
      role,
      reason,
    );

    return {
      ...profile,
      roles: newRoles,
      updatedAt: new Date(),
    };
  }

  /**
   * Remove role from user (for admin use)
   */
  async removeUserRole(
    targetUserId: string,
    role: UserRole,
    adminUserId: string,
    reason?: string,
  ): Promise<UserProfileDto> {
    const profile = await this.getUserProfile(targetUserId);
    if (!profile) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (!profile.roles.includes(role)) {
      return profile; // Doesn't have role
    }

    let newRoles = profile.roles.filter((r) => r !== role);

    // Ensure user always has at least 'user' role
    if (newRoles.length === 0 || !newRoles.includes(UserRole.USER)) {
      newRoles = [UserRole.USER];
    }

    const { error } = await this.supabaseService
      .getAnonClient()
      .from('users')
      .update({ roles: newRoles })
      .eq('id', targetUserId);

    if (error) {
      throw new HttpException(
        `Failed to remove role: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Log the change
    await this.logRoleChange(
      targetUserId,
      adminUserId,
      'remove_role',
      profile.roles,
      newRoles,
      role,
      reason,
    );

    return {
      ...profile,
      roles: newRoles,
      updatedAt: new Date(),
    };
  }

  /**
   * Set exact roles for user (for admin use)
   */
  async setUserRoles(
    targetUserId: string,
    roles: UserRole[],
    adminUserId: string,
    reason?: string,
  ): Promise<UserProfileDto> {
    const profile = await this.getUserProfile(targetUserId);
    if (!profile) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Ensure 'user' role is always included
    const newRoles = roles.includes(UserRole.USER)
      ? roles
      : [UserRole.USER, ...roles];

    const { error } = await this.supabaseService
      .getAnonClient()
      .from('users')
      .update({ roles: newRoles })
      .eq('id', targetUserId);

    if (error) {
      throw new HttpException(
        `Failed to set roles: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Log the change
    await this.logRoleChange(
      targetUserId,
      adminUserId,
      'set_roles',
      profile.roles,
      newRoles,
      undefined,
      reason,
    );

    return {
      ...profile,
      roles: newRoles,
      updatedAt: new Date(),
    };
  }

  /**
   * Log role changes for audit purposes
   */
  private async logRoleChange(
    targetUserId: string,
    adminUserId: string,
    action: string,
    oldRoles: UserRole[],
    newRoles: UserRole[],
    changedRole?: UserRole,
    reason?: string,
  ): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getAnonClient()
        .from(getTableName('role_audit_log'))
        .insert({
          user_id: targetUserId,
          admin_user_id: adminUserId,
          action,
          old_roles: oldRoles,
          new_roles: newRoles,
          role_changed: changedRole,
          reason,
        });

      if (error) {
        // Audit log insertion failed - log but don't throw
        this.logger.warn('Failed to insert role change audit log', error);
      }
    } catch {
      // Silent failure for audit log
    }
  }

  /**
   * Create new user (admin only)
   * Creates both auth user and profile record
   */
  async createUser(
    createUserDto: CreateUserDto,
    _adminUserId: string,
  ): Promise<CreateUserResponseDto> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      // Create user in Supabase Auth using Admin API
      const { data: authUser, error: authError } =
        await serviceClient.auth.admin.createUser({
          email: createUserDto.email,
          password: createUserDto.password,
          email_confirm: createUserDto.emailConfirm !== false, // Default to true
          user_metadata: {
            display_name: createUserDto.displayName || '',
          },
        });

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authUser.user) {
        throw new Error('Auth user creation returned no user data');
      }

      // Set default roles if none provided
      const roles = createUserDto.roles || [UserRole.USER];

      // Create user profile record
      const { error: profileError } = await serviceClient
        .from(getTableName('users'))
        .insert({
          id: authUser.user.id,
          email: createUserDto.email,
          display_name: createUserDto.displayName || null,
          roles: roles,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          namespace_access: createUserDto.namespaceAccess?.length
            ? createUserDto.namespaceAccess
            : ['my-org'],
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, we should clean up the auth user
        await serviceClient.auth.admin.deleteUser(authUser.user.id);
        throw new Error(
          `Failed to create user profile: ${profileError.message}`,
        );
      }

      return {
        id: authUser.user.id,
        email: createUserDto.email,
        displayName: createUserDto.displayName,
        roles: roles,
        emailConfirmationRequired: !authUser.user.email_confirmed_at,
        message: 'User created successfully',
        namespaceAccess: createUserDto.namespaceAccess?.length
          ? createUserDto.namespaceAccess
          : ['my-org'],
      };
    } catch (error) {
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(_adminUserId: string): Promise<unknown[]> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      const { data: users, error } = await serviceClient
        .from(getTableName('users'))
        .select(
          'id, email, display_name, roles, created_at, status, namespace_access',
        )
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      return users || [];
    } catch (error) {
      throw new Error(
        `Failed to get all users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get user by ID (admin only)
   */
  async getUserById(userId: string, _adminUserId: string): Promise<unknown> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      const { data: user, error } = await serviceClient
        .from(getTableName('users'))
        .select(
          'id, email, display_name, roles, created_at, status, namespace_access',
        )
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch user: ${error.message}`);
      }

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error(
        `Failed to get user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
