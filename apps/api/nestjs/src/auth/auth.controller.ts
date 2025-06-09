import { Controller, Post, Get, Body, UseGuards, Request, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { 
  UserCreateDto, 
  UserLoginDto, 
  TokenResponseDto, 
  AuthenticatedUserResponseDto,
  SupabaseAuthUserDto 
} from './dto/auth.dto';

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
    type: TokenResponseDto 
  })
  @ApiResponse({ 
    status: 202, 
    description: 'User created successfully. Email confirmation required.' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - User might already exist or invalid input' 
  })
  @ApiBody({ type: UserCreateDto })
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() userCreateDto: UserCreateDto): Promise<TokenResponseDto> {
    return this.authService.signup(userCreateDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: TokenResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid credentials' 
  })
  @ApiBody({ type: UserLoginDto })
  async login(@Body() userLoginDto: UserLoginDto): Promise<TokenResponseDto> {
    return this.authService.login(userLoginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ 
    status: 204, 
    description: 'Logout successful' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or expired token' 
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: any): Promise<void> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      this.logger.error('No token found in logout request');
      throw new Error('No token provided');
    }

    return this.authService.logout(token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user details' })
  @ApiResponse({ 
    status: 200, 
    description: 'Current user profile',
    type: AuthenticatedUserResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or expired token' 
  })
  async getCurrentUser(
    @CurrentUser() currentAuthUser: SupabaseAuthUserDto,
    @Request() req: any
  ): Promise<AuthenticatedUserResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      this.logger.error('No token found in getCurrentUser request');
      throw new Error('No token provided');
    }

    return this.authService.getCurrentUser(currentAuthUser, token);
  }
} 