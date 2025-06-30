import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CIDAFMService } from './cidafm.service';
import {
  CreateCIDAFMCommandDto,
  CIDAFMCommandResponseDto,
} from '../dto/llm-evaluation.dto';

@ApiTags('CIDAFM Commands')
@Controller('cidafm')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CIDAFMController {
  constructor(private readonly cidafmService: CIDAFMService) {}

  @Get('commands')
  @ApiOperation({ summary: 'Get all available CIDAFM commands' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['^', '&', '!'],
    description: 'Filter by command type',
  })
  @ApiQuery({
    name: 'builtin_only',
    required: false,
    type: Boolean,
    description: 'Show only built-in commands',
  })
  @ApiQuery({
    name: 'include_user_commands',
    required: false,
    type: Boolean,
    description: 'Include user custom commands',
  })
  @ApiResponse({
    status: 200,
    description: 'List of CIDAFM commands',
    type: [CIDAFMCommandResponseDto],
  })
  async getCommands(
    @CurrentUser() user: any,
    @Query('type') type?: '^' | '&' | '!',
    @Query('builtin_only') builtinOnly?: boolean,
    @Query('include_user_commands') includeUserCommands?: boolean,
  ): Promise<CIDAFMCommandResponseDto[]> {
    return this.cidafmService.findAllCommands(user.id, {
      type,
      builtinOnly,
      includeUserCommands,
    });
  }

  @Get('commands/by-type/:type')
  @ApiOperation({ summary: 'Get CIDAFM commands by type' })
  @ApiParam({
    name: 'type',
    enum: ['^', '&', '!'],
    description: 'Command type: ^ (response), & (state), ! (execution)',
  })
  @ApiResponse({
    status: 200,
    description: 'Commands of the specified type',
    type: [CIDAFMCommandResponseDto],
  })
  async getCommandsByType(
    @CurrentUser() user: any,
    @Param('type') type: '^' | '&' | '!',
  ): Promise<CIDAFMCommandResponseDto[]> {
    return this.cidafmService.findAllCommands(user.id, { type });
  }

  @Get('commands/:id')
  @ApiOperation({ summary: 'Get a specific CIDAFM command by ID' })
  @ApiParam({ name: 'id', description: 'Command UUID' })
  @ApiResponse({
    status: 200,
    description: 'Command details',
    type: CIDAFMCommandResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Command not found' })
  async getCommand(@Param('id') id: string): Promise<CIDAFMCommandResponseDto> {
    const command = await this.cidafmService.findCommandById(id);
    if (!command) {
      throw new HttpException('Command not found', HttpStatus.NOT_FOUND);
    }
    return command;
  }

  @Post('commands')
  @ApiOperation({ summary: 'Create a custom CIDAFM command' })
  @ApiResponse({
    status: 201,
    description: 'Custom command created successfully',
    type: CIDAFMCommandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({
    status: 409,
    description: 'Command name already exists for user',
  })
  async createUserCommand(
    @CurrentUser() user: any,
    @Body() createCommandDto: CreateCIDAFMCommandDto,
  ): Promise<CIDAFMCommandResponseDto> {
    return this.cidafmService.createUserCommand(user.id, createCommandDto);
  }

  @Put('commands/:id')
  @ApiOperation({ summary: 'Update a custom CIDAFM command' })
  @ApiParam({ name: 'id', description: 'Command UUID' })
  @ApiResponse({
    status: 200,
    description: 'Command updated successfully',
    type: CIDAFMCommandResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Command not found' })
  @ApiResponse({ status: 403, description: 'Cannot modify built-in commands' })
  async updateUserCommand(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateCommandDto: Partial<CreateCIDAFMCommandDto>,
  ): Promise<CIDAFMCommandResponseDto> {
    const command = await this.cidafmService.updateUserCommand(
      user.id,
      id,
      updateCommandDto,
    );
    if (!command) {
      throw new HttpException('Command not found', HttpStatus.NOT_FOUND);
    }
    return command;
  }

  @Delete('commands/:id')
  @ApiOperation({ summary: 'Delete a custom CIDAFM command' })
  @ApiParam({ name: 'id', description: 'Command UUID' })
  @ApiResponse({ status: 200, description: 'Command deleted successfully' })
  @ApiResponse({ status: 404, description: 'Command not found' })
  @ApiResponse({ status: 403, description: 'Cannot delete built-in commands' })
  async deleteUserCommand(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const deleted = await this.cidafmService.deleteUserCommand(user.id, id);
    if (!deleted) {
      throw new HttpException('Command not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Command deleted successfully' };
  }

  @Post('process')
  @ApiOperation({ summary: 'Process CIDAFM commands in a message' })
  @ApiResponse({
    status: 200,
    description: 'CIDAFM processing result',
    schema: {
      type: 'object',
      properties: {
        modified_prompt: { type: 'string' },
        active_state_modifiers: { type: 'array', items: { type: 'string' } },
        executed_commands: { type: 'array', items: { type: 'string' } },
        processing_notes: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async processCommands(
    @CurrentUser() user: any,
    @Body()
    body: {
      message: string;
      current_state?: Record<string, any>;
      session_id?: string;
    },
  ): Promise<{
    modified_prompt: string;
    active_state_modifiers: string[];
    executed_commands: string[];
    processing_notes: string[];
  }> {
    return this.cidafmService.processMessage(
      user.id,
      body.message,
      body.current_state,
      body.session_id,
    );
  }

  @Get('state/:sessionId')
  @ApiOperation({ summary: 'Get current CIDAFM state for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'Current CIDAFM state',
    schema: {
      type: 'object',
      properties: {
        active_state_modifiers: { type: 'array', items: { type: 'string' } },
        session_state: { type: 'object' },
        available_commands: {
          type: 'array',
          items: { $ref: '#/components/schemas/CIDAFMCommandResponseDto' },
        },
      },
    },
  })
  async getSessionState(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ): Promise<{
    active_state_modifiers: string[];
    session_state: Record<string, any>;
    available_commands: CIDAFMCommandResponseDto[];
  }> {
    return this.cidafmService.getSessionState(user.id, sessionId);
  }

  @Post('state/:sessionId/reset')
  @ApiOperation({ summary: 'Reset CIDAFM state for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({
    status: 200,
    description: 'State reset successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        reset_state: { type: 'object' },
      },
    },
  })
  async resetSessionState(
    @CurrentUser() user: any,
    @Param('sessionId') sessionId: string,
  ): Promise<{
    message: string;
    reset_state: Record<string, any>;
  }> {
    return this.cidafmService.resetSessionState(user.id, sessionId);
  }

  @Get('help')
  @ApiOperation({ summary: 'Get CIDAFM help and documentation' })
  @ApiResponse({
    status: 200,
    description: 'CIDAFM help documentation',
    schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        command_types: { type: 'object' },
        examples: { type: 'array' },
        built_in_commands: { type: 'array' },
      },
    },
  })
  async getHelp(): Promise<{
    overview: string;
    command_types: Record<string, string>;
    examples: Array<{ command: string; description: string; example: string }>;
    built_in_commands: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }> {
    return this.cidafmService.getHelp();
  }
}
