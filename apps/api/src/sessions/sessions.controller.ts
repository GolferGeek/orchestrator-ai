import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import {
  SessionCreateDto,
  SessionResponseDto,
  SessionListResponseDto,
  MessageListResponseDto,
} from './dto/session.dto';
import {
  EnhancedMessageCreateDto,
  EnhancedMessageResponseDto,
} from '../dto/llm-evaluation.dto';

@ApiTags('Chat Sessions')
@Controller('sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiResponse({
    status: 201,
    description: 'Session created successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBody({ type: SessionCreateDto })
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body() sessionCreateDto: SessionCreateDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ): Promise<SessionResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in createSession request');
      throw new Error('No token provided');
    }

    return this.sessionsService.createSession(
      sessionCreateDto,
      currentUser,
      token,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List chat sessions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
    type: SessionListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Number of sessions to skip for pagination',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of sessions to return',
    example: 100,
  })
  async listSessions(
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
    @Query('skip') skip: number = 0,
    @Query('limit') limit: number = 100,
  ): Promise<SessionListResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in listSessions request');
      throw new Error('No token provided');
    }

    return this.sessionsService.listSessions(
      currentUser,
      token,
      Number(skip),
      Number(limit),
    );
  }

  @Get(':sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific chat session' })
  @ApiResponse({
    status: 200,
    description: 'Session retrieved successfully',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID', format: 'uuid' })
  async getSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ): Promise<SessionResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in getSession request');
      throw new Error('No token provided');
    }

    return this.sessionsService.getSession(sessionId, currentUser, token);
  }

  @Get(':sessionId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List messages for a specific chat session' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: MessageListResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID', format: 'uuid' })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Number of messages to skip for pagination',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of messages to return',
    example: 50,
  })
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
    @Query('skip') skip: number = 0,
    @Query('limit') limit: number = 50,
  ): Promise<MessageListResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in getSessionMessages request');
      throw new Error('No token provided');
    }

    return this.sessionsService.getSessionMessages(
      sessionId,
      currentUser,
      token,
      Number(skip),
      Number(limit),
    );
  }

  @Delete(':sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific chat session' })
  @ApiResponse({
    status: 204,
    description: 'Session deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID', format: 'uuid' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ): Promise<void> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in deleteSession request');
      throw new Error('No token provided');
    }

    return this.sessionsService.deleteSession(sessionId, currentUser, token);
  }

  @Post(':sessionId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send a message to a chat session with LLM selection',
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    type: EnhancedMessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid message data or LLM selection',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID', format: 'uuid' })
  @ApiBody({ type: EnhancedMessageCreateDto })
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() messageCreateDto: EnhancedMessageCreateDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
  ): Promise<EnhancedMessageResponseDto> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in sendMessage request');
      throw new Error('No token provided');
    }

    return this.sessionsService.sendMessage(
      sessionId,
      messageCreateDto,
      currentUser,
      token,
    );
  }

  @Get(':sessionId/messages/enhanced')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List enhanced messages with LLM and evaluation data',
  })
  @ApiResponse({
    status: 200,
    description: 'Enhanced messages retrieved successfully',
    type: [EnhancedMessageResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found or access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID', format: 'uuid' })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Number of messages to skip for pagination',
    example: 0,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of messages to return',
    example: 50,
  })
  @ApiQuery({
    name: 'include_evaluations',
    required: false,
    type: Boolean,
    description: 'Include evaluation data in response',
  })
  @ApiQuery({
    name: 'include_llm_data',
    required: false,
    type: Boolean,
    description: 'Include LLM provider and model data',
  })
  async getEnhancedSessionMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Request() req: any,
    @Query('skip') skip: number = 0,
    @Query('limit') limit: number = 50,
    @Query('include_evaluations') includeEvaluations: boolean = true,
    @Query('include_llm_data') includeLlmData: boolean = true,
  ): Promise<EnhancedMessageResponseDto[]> {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      this.logger.error('No token found in getEnhancedSessionMessages request');
      throw new Error('No token provided');
    }

    return this.sessionsService.getEnhancedSessionMessages(
      sessionId,
      currentUser,
      token,
      {
        skip: Number(skip),
        limit: Number(limit),
        includeEvaluations,
        includeLlmData,
      },
    );
  }
}
