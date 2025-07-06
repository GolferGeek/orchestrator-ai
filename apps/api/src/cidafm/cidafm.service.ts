import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateCIDAFMCommandDto,
  CIDAFMCommandResponseDto,
} from '../dto/llm-evaluation.dto';
import { CIDAFMCommandType } from '../types/llm-evaluation';

interface CommandFilters {
  type?: CIDAFMCommandType;
  builtinOnly?: boolean;
  includeUserCommands?: boolean;
}

@Injectable()
export class CIDAFMService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAllCommands(
    userId: string,
    filters: CommandFilters = {},
  ): Promise<CIDAFMCommandResponseDto[]> {
    const client = this.supabaseService.getServiceClient();

    // Get built-in commands
    let builtinQuery = client
      .from('cidafm_commands')
      .select('*')
      .eq('is_builtin', true)
      .order('type')
      .order('name');

    if (filters.type) {
      builtinQuery = builtinQuery.eq('type', filters.type);
    }

    const { data: builtinCommands, error: builtinError } = await builtinQuery;

    if (builtinError) {
      throw new HttpException(
        `Failed to fetch built-in commands: ${builtinError.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let allCommands = [...(builtinCommands || [])];

    // Get user commands if requested
    if (!filters.builtinOnly && filters.includeUserCommands !== false) {
      let userQuery = client
        .from('user_cidafm_commands')
        .select('*')
        .eq('user_id', userId)
        .order('type')
        .order('name');

      if (filters.type) {
        userQuery = userQuery.eq('type', filters.type);
      }

      const { data: userCommands, error: userError } = await userQuery;

      if (userError) {
        throw new HttpException(
          `Failed to fetch user commands: ${userError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Transform user commands to match built-in command structure
      const transformedUserCommands = (userCommands || []).map((cmd: any) => ({
        ...cmd,
        default_active: false,
        is_builtin: false,
      }));

      allCommands = [...allCommands, ...transformedUserCommands];
    }

    return allCommands;
  }

  async findCommandById(id: string): Promise<CIDAFMCommandResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    // Try built-in commands first
    const { data: builtinCommand } = await client
      .from('cidafm_commands')
      .select('*')
      .eq('id', id)
      .single();

    if (builtinCommand) {
      return builtinCommand;
    }

    // If not found in built-in, try user commands
    const { data: userCommand } = await client
      .from('user_cidafm_commands')
      .select('*')
      .eq('id', id)
      .single();

    if (userCommand) {
      return {
        ...userCommand,
        default_active: false,
        is_builtin: false,
      };
    }

    return null;
  }

  async createUserCommand(
    userId: string,
    createCommandDto: CreateCIDAFMCommandDto,
  ): Promise<CIDAFMCommandResponseDto> {
    const client = this.supabaseService.getServiceClient();

    // Check if user already has a command with this name and type
    const { data: existingCommand } = await client
      .from('user_cidafm_commands')
      .select('id')
      .eq('user_id', userId)
      .eq('type', createCommandDto.type)
      .eq('name', createCommandDto.name)
      .single();

    if (existingCommand) {
      throw new HttpException(
        'Command name already exists for this user and type',
        HttpStatus.CONFLICT,
      );
    }

    const { data, error } = await client
      .from('user_cidafm_commands')
      .insert({
        user_id: userId,
        type: createCommandDto.type,
        name: createCommandDto.name,
        description: createCommandDto.description,
      })
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to create user command: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      ...data,
      default_active: false,
      is_builtin: false,
    };
  }

  async updateUserCommand(
    userId: string,
    commandId: string,
    updateCommandDto: Partial<CreateCIDAFMCommandDto>,
  ): Promise<CIDAFMCommandResponseDto | null> {
    const client = this.supabaseService.getServiceClient();

    // Check if command exists and belongs to user
    const { data: existing } = await client
      .from('user_cidafm_commands')
      .select('*')
      .eq('id', commandId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return null;
    }

    // If updating name, check for conflicts
    if (updateCommandDto.name && updateCommandDto.name !== existing.name) {
      const { data: conflictCommand } = await client
        .from('user_cidafm_commands')
        .select('id')
        .eq('user_id', userId)
        .eq('type', updateCommandDto.type || existing.type)
        .eq('name', updateCommandDto.name)
        .neq('id', commandId)
        .single();

      if (conflictCommand) {
        throw new HttpException(
          'Command name already exists for this user and type',
          HttpStatus.CONFLICT,
        );
      }
    }

    const { data, error } = await client
      .from('user_cidafm_commands')
      .update({
        ...updateCommandDto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commandId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new HttpException(
        `Failed to update user command: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      ...data,
      default_active: false,
      is_builtin: false,
    };
  }

  async deleteUserCommand(userId: string, commandId: string): Promise<boolean> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('user_cidafm_commands')
      .delete()
      .eq('id', commandId)
      .eq('user_id', userId);

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // Not found
      }
      throw new HttpException(
        `Failed to delete user command: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return true;
  }

  async processMessage(
    userId: string,
    message: string,
    currentState?: Record<string, any>,
    _sessionId?: string,
  ): Promise<{
    modifiedPrompt: string;
    activeStateModifiers: string[];
    executedCommands: string[];
    processingNotes: string[];
  }> {
    const commands = await this.findAllCommands(userId, {
      includeUserCommands: true,
    });

    // Initialize state
    const state = currentState || { active_state_modifiers: [] };
    const executedCommands: string[] = [];
    const processingNotes: string[] = [];
    let modifiedPrompt = message;

    // Parse CIDAFM commands from the message
    const commandPattern = /([^&!]|^)([&^!])([a-zA-Z0-9_-]+)/g;
    const foundCommands: Array<{ type: string; name: string; full: string }> =
      [];

    let match;
    while ((match = commandPattern.exec(message)) !== null) {
      foundCommands.push({
        type: match[2] || '',
        name: match[3] || '',
        full: match[0].trim(),
      });
    }

    // Process each command
    for (const foundCommand of foundCommands) {
      const command = commands.find(
        (cmd) =>
          cmd.type === foundCommand.type && cmd.name === foundCommand.name,
      );

      if (!command) {
        processingNotes.push(`Unknown command: ${foundCommand.full}`);
        continue;
      }

      switch (foundCommand.type) {
        case '^': // Response modifier
          processingNotes.push(
            `Applied response modifier: ${foundCommand.name}`,
          );
          // Remove the command from the prompt
          modifiedPrompt = modifiedPrompt.replace(foundCommand.full, '').trim();
          break;

        case '&': {
          // State modifier
          const isActive = state.active_state_modifiers.includes(
            foundCommand.name,
          );
          if (isActive) {
            // Toggle off
            state.active_state_modifiers = state.active_state_modifiers.filter(
              (mod: string) => mod !== foundCommand.name,
            );
            processingNotes.push(
              `Disabled state modifier: ${foundCommand.name}`,
            );
          } else {
            // Toggle on
            state.active_state_modifiers.push(foundCommand.name);
            processingNotes.push(
              `Enabled state modifier: ${foundCommand.name}`,
            );
          }
          // Remove the command from the prompt
          modifiedPrompt = modifiedPrompt.replace(foundCommand.full, '').trim();
          break;
        }

        case '!': // Execution command
          executedCommands.push(foundCommand.name);
          processingNotes.push(`Executed command: ${foundCommand.name}`);
          // Handle specific execution commands
          await this.handleExecutionCommand(
            foundCommand.name,
            state,
            processingNotes,
          );
          // Remove the command from the prompt
          modifiedPrompt = modifiedPrompt.replace(foundCommand.full, '').trim();
          break;
      }
    }

    // Apply state modifiers to the prompt
    modifiedPrompt = this.applyStateModifiers(
      modifiedPrompt,
      state.active_state_modifiers,
      commands,
    );

    return {
      modifiedPrompt: modifiedPrompt,
      activeStateModifiers: state.active_state_modifiers,
      executedCommands: executedCommands,
      processingNotes: processingNotes,
    };
  }

  async getSessionState(
    userId: string,
    sessionId: string,
  ): Promise<{
    activeStateModifiers: string[];
    session_state: Record<string, any>;
    available_commands: CIDAFMCommandResponseDto[];
  }> {
    // Get session state from the last message with CIDAFM options
    const client = this.supabaseService.getServiceClient();

    const { data: lastMessage } = await client
      .from('messages')
      .select('cidafm_options')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .not('cidafm_options', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const state = lastMessage?.cidafm_options || { activeStateModifiers: [] };
    const commands = await this.findAllCommands(userId, {
      includeUserCommands: true,
    });

    return {
      activeStateModifiers: state.active_state_modifiers || [],
      session_state: state,
      available_commands: commands,
    };
  }

  async resetSessionState(
    _userId: string,
    _sessionId: string,
  ): Promise<{
    message: string;
    reset_state: Record<string, any>;
  }> {
    const resetState = {
      activeStateModifiers: ['token-efficient'], // Default state
      custom_options: {},
    };

    return {
      message: 'Session state reset successfully',
      reset_state: resetState,
    };
  }

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
    const commands = await this.findAllCommands('', { builtinOnly: true });

    return {
      overview:
        'CIDAFM (Context Import Document + AI Function Module) is a protocol for modifying AI behavior through structured commands.',
      command_types: {
        '^': 'Response Modifiers - Apply only to the current response',
        '&': 'State Modifiers - Persistent until toggled off',
        '!': 'Execution Commands - Single-use functions that execute immediately',
      },
      examples: [
        {
          command: '^concise',
          description: 'Make only the current response concise',
          example: '^concise Explain quantum computing',
        },
        {
          command: '&disciplined',
          description: 'Enable disciplined mode for all future responses',
          example: '&disciplined (toggles on/off)',
        },
        {
          command: '!state-check',
          description: 'Show current active state modifiers',
          example: '!state-check',
        },
      ],
      built_in_commands: commands.map((cmd) => ({
        type: cmd.type,
        name: cmd.name,
        description: cmd.description || '',
      })),
    };
  }

  private async handleExecutionCommand(
    commandName: string,
    state: Record<string, any>,
    processingNotes: string[],
  ): Promise<void> {
    switch (commandName) {
      case 'state-check':
        processingNotes.push(
          `Active state modifiers: ${state.active_state_modifiers?.join(', ') || 'none'}`,
        );
        break;
      case 'export-context':
        processingNotes.push(
          'Context export requested - provide session summary',
        );
        break;
      case 'step-by-step':
        processingNotes.push(
          'Step-by-step mode activated - break response into steps',
        );
        break;
      default:
        processingNotes.push(`Execution command '${commandName}' processed`);
    }
  }

  private applyStateModifiers(
    prompt: string,
    activeModifiers: string[],
    commands: CIDAFMCommandResponseDto[],
  ): string {
    let modifiedPrompt = prompt;

    // Ensure activeModifiers is an array
    const modifiersArray = Array.isArray(activeModifiers)
      ? activeModifiers
      : [];

    for (const modifierName of modifiersArray) {
      const command = commands.find(
        (cmd) => cmd.type === '&' && cmd.name === modifierName,
      );

      if (command && command.description) {
        // Add the modifier instruction to the prompt
        modifiedPrompt = `[CIDAFM &${modifierName}: ${command.description}]\n\n${modifiedPrompt}`;
      }
    }

    return modifiedPrompt;
  }
}
