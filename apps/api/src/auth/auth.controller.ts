import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AdminOnly, UserRole } from './decorators/roles.decorator';
import {
  UserCreateDto,
  UserLoginDto,
  TokenResponseDto,
  AuthenticatedUserResponseDto,
  SupabaseAuthUserDto,
} from './dto/auth.dto';
import {
  UserListResponseDto,
  UpdateUserRolesDto,
  AddUserRoleDto,
  RemoveUserRoleDto,
  CreateUserDto,
  CreateUserResponseDto,
} from './dto/admin-user-management.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create new user and return session token' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully with session token',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 202,
    description: 'User created successfully. Email confirmation required.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User might already exist or invalid input',
  })
  @ApiBody({ type: UserCreateDto })
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() userCreateDto: UserCreateDto,
  ): Promise<TokenResponseDto> {
    return this.authService.signup(userCreateDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
  })
  @ApiBody({ type: UserLoginDto })
  @HttpCode(HttpStatus.OK)
  async login(@Body() userLoginDto: UserLoginDto): Promise<TokenResponseDto> {
    return this.authService.login(userLoginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: Record<string, unknown>): Promise<void> {
    // Extract token from Authorization header
    const authHeader = (req.headers as Record<string, unknown> | undefined)
      ?.authorization as string | undefined;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new Error('No token provided');
    }

    return this.authService.logout(token);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired refresh token',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'Refresh token to exchange for new access token',
        },
      },
      required: ['refreshToken'],
    },
  })
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenResponseDto> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    return this.authService.refreshToken(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user details' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: AuthenticatedUserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  async getCurrentUser(
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
    @Request() req: Record<string, unknown>,
  ): Promise<AuthenticatedUserResponseDto> {
    // Extract token from Authorization header
    const authHeader = (req.headers as Record<string, unknown> | undefined)
      ?.authorization as string | undefined;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new Error('No token provided');
    }

    return this.authService.getCurrentUser(currentAuthUser, token);
  }

  // Admin User Management Endpoints

  @Post('admin/users')
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new user (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: CreateUserResponseDto,
  })
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
  ): Promise<CreateUserResponseDto> {
    return this.authService.createUser(createUserDto, currentAuthUser.id);
  }

  @Get('admin/users')
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of all users with their roles',
    type: [UserListResponseDto],
  })
  async getAllUsers(
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
  ): Promise<UserListResponseDto[]> {
    return this.authService.getAllUsers(currentAuthUser.id) as Promise<
      UserListResponseDto[]
    >;
  }

  @Get('admin/users/:userId')
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User details with roles',
    type: UserListResponseDto,
  })
  async getUserById(
    @Param('userId') userId: string,
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
  ): Promise<UserListResponseDto> {
    return this.authService.getUserById(
      userId,
      currentAuthUser.id,
    ) as Promise<UserListResponseDto>;
  }

  @Put('admin/users/:userId/roles')
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set user roles (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User roles updated successfully',
  })
  async setUserRoles(
    @Param('userId') userId: string,
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.setUserRoles(
      userId,
      updateUserRolesDto.roles,
      currentAuthUser.id,
      updateUserRolesDto.reason,
    );
    return {
      success: true,
      message: `User roles updated to: ${updateUserRolesDto.roles.join(', ')}`,
    };
  }

  @Post('admin/users/:userId/roles')
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add role to user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Role added successfully',
  })
  async addUserRole(
    @Param('userId') userId: string,
    @Body() addUserRoleDto: AddUserRoleDto,
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.addUserRole(
      userId,
      addUserRoleDto.role,
      currentAuthUser.id,
      addUserRoleDto.reason,
    );
    return {
      success: true,
      message: `Role '${addUserRoleDto.role}' added to user`,
    };
  }

  @Delete('admin/users/:userId/roles/:role')
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove role from user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Role removed successfully',
  })
  async removeUserRole(
    @Param('userId') userId: string,
    @Param('role') role: string,
    @Body() removeUserRoleDto: RemoveUserRoleDto,
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.removeUserRole(
      userId,
      role as unknown as UserRole,
      currentAuthUser.id,
      removeUserRoleDto.reason,
    );
    return {
      success: true,
      message: `Role '${role}' removed from user`,
    };
  }
}
