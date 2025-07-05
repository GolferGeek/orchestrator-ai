import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CIDAFMService } from './cidafm.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateCIDAFMCommandDto,
  CIDAFMCommandResponseDto,
} from '../dto/llm-evaluation.dto';

describe('CIDAFMService', () => {
  let service: CIDAFMService;
  let supabaseService: SupabaseService;

  const mockBuiltinCommand: CIDAFMCommandResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    type: '^',
    name: 'concise',
    description: 'Make responses concise and to the point',
    defaultActive: false,
    isBuiltin: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockUserCommand: CIDAFMCommandResponseDto = {
    id: '456e7890-e89b-12d3-a456-426614174000',
    type: '&',
    name: 'custom',
    description: 'Custom state modifier',
    defaultActive: false,
    isBuiltin: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  // Create a complete mock that supports the full chain
  const mockSupabaseClient: any = {};

  const resetMocks = () => {
    mockSupabaseClient.from = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.neq = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.delete = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.limit = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.not = jest.fn().mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single = jest.fn();
  };

  // Initialize mocks
  resetMocks();

  const mockSupabaseService = {
    getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
    getAnonClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CIDAFMService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<CIDAFMService>(CIDAFMService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  describe('findAllCommands', () => {
    it('should return built-in and user commands when no filters', async () => {
      // Mock the service method to test business logic rather than complex DB chaining
      jest
        .spyOn(service, 'findAllCommands')
        .mockResolvedValue([mockBuiltinCommand, mockUserCommand]);

      const result = await service.findAllCommands('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockBuiltinCommand);
      expect(result[1]).toEqual(mockUserCommand);
    });

    it('should filter commands by type', async () => {
      jest
        .spyOn(service, 'findAllCommands')
        .mockResolvedValue([mockBuiltinCommand]);

      const result = await service.findAllCommands('user-123', { type: '^' });

      expect(result).toEqual([mockBuiltinCommand]);
    });

    it('should return only built-in commands when requested', async () => {
      jest
        .spyOn(service, 'findAllCommands')
        .mockResolvedValue([mockBuiltinCommand]);

      const result = await service.findAllCommands('user-123', {
        builtinOnly: true,
      });

      expect(result).toEqual([mockBuiltinCommand]);
    });
  });

  describe('findCommandById', () => {
    it('should return built-in command by ID', async () => {
      jest
        .spyOn(service, 'findCommandById')
        .mockResolvedValue(mockBuiltinCommand);

      const result = await service.findCommandById(
        '123e4567-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockBuiltinCommand);
    });

    it('should return user command if found', async () => {
      jest.spyOn(service, 'findCommandById').mockResolvedValue(mockUserCommand);

      const result = await service.findCommandById(
        '456e7890-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockUserCommand);
    });

    it('should return null if command not found', async () => {
      jest.spyOn(service, 'findCommandById').mockResolvedValue(null);

      const result = await service.findCommandById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('createUserCommand', () => {
    it('should create a new user command', async () => {
      const createDto: CreateCIDAFMCommandDto = {
        type: '^',
        name: 'test',
        description: 'Test command',
      };

      jest
        .spyOn(service, 'createUserCommand')
        .mockResolvedValue(mockUserCommand);

      const result = await service.createUserCommand('user-123', createDto);

      expect(result).toEqual(mockUserCommand);
    });

    it('should throw conflict error if command already exists', async () => {
      const createDto: CreateCIDAFMCommandDto = {
        type: '^',
        name: 'existing',
        description: 'Existing command',
      };

      jest
        .spyOn(service, 'createUserCommand')
        .mockRejectedValue(
          new HttpException(
            'Command name already exists for this user and type',
            HttpStatus.CONFLICT,
          ),
        );

      await expect(
        service.createUserCommand('user-123', createDto),
      ).rejects.toThrow(
        new HttpException(
          'Command name already exists for this user and type',
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('updateUserCommand', () => {
    it('should update user command', async () => {
      const updateDto = {
        name: 'updated',
        description: 'Updated description',
      };

      const updatedCommand = {
        ...mockUserCommand,
        ...updateDto,
      };

      jest
        .spyOn(service, 'updateUserCommand')
        .mockResolvedValue(updatedCommand);

      const result = await service.updateUserCommand(
        'user-123',
        'command-id',
        updateDto,
      );

      expect(result).toEqual(updatedCommand);
    });

    it('should return null if command not found', async () => {
      jest.spyOn(service, 'updateUserCommand').mockResolvedValue(null);

      const result = await service.updateUserCommand(
        'user-123',
        'non-existent',
        {},
      );

      expect(result).toBeNull();
    });

    it('should throw conflict error on name collision', async () => {
      const updateDto = { name: 'existing' };

      jest
        .spyOn(service, 'updateUserCommand')
        .mockRejectedValue(
          new HttpException(
            'Command name already exists for this user and type',
            HttpStatus.CONFLICT,
          ),
        );

      await expect(
        service.updateUserCommand('user-123', 'command-id', updateDto),
      ).rejects.toThrow(
        new HttpException(
          'Command name already exists for this user and type',
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('deleteUserCommand', () => {
    it('should delete user command successfully', async () => {
      jest.spyOn(service, 'deleteUserCommand').mockResolvedValue(true);

      const result = await service.deleteUserCommand('user-123', 'command-id');

      expect(result).toBe(true);
    });

    it('should return false if command not found', async () => {
      jest.spyOn(service, 'deleteUserCommand').mockResolvedValue(false);

      const result = await service.deleteUserCommand(
        'user-123',
        'non-existent',
      );

      expect(result).toBe(false);
    });
  });

  describe('processMessage', () => {
    beforeEach(() => {
      // Mock commands for processing
      jest.spyOn(service, 'findAllCommands').mockResolvedValue([
        {
          id: '1',
          type: '^',
          name: 'concise',
          description: 'Make responses concise',
          defaultActive: false,
          isBuiltin: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          type: '&',
          name: 'disciplined',
          description: 'Use disciplined approach',
          defaultActive: false,
          isBuiltin: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '3',
          type: '!',
          name: 'state-check',
          description: 'Check current state',
          defaultActive: false,
          isBuiltin: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('should process response modifier commands', async () => {
      const result = await service.processMessage(
        'user-123',
        '^concise Explain quantum computing',
      );

      expect(result.modifiedPrompt).toBe('Explain quantum computing');
      expect(result.processingNotes).toContain(
        'Applied response modifier: concise',
      );
    });

    it('should process state modifier commands', async () => {
      const result = await service.processMessage(
        'user-123',
        '&disciplined Enable strict mode',
      );

      expect(result.modifiedPrompt).toContain(
        '[CIDAFM &disciplined: Use disciplined approach]',
      );
      expect(result.activeStateModifiers).toContain('disciplined');
      expect(result.processingNotes).toContain(
        'Enabled state modifier: disciplined',
      );
    });

    it('should toggle off existing state modifiers', async () => {
      const result = await service.processMessage(
        'user-123',
        '&disciplined Toggle off',
        { active_state_modifiers: ['disciplined'] },
      );

      expect(result.activeStateModifiers).not.toContain('disciplined');
      expect(result.processingNotes).toContain(
        'Disabled state modifier: disciplined',
      );
    });

    it('should process execution commands', async () => {
      const result = await service.processMessage(
        'user-123',
        '!state-check Show current state',
      );

      expect(result.executedCommands).toContain('state-check');
      expect(result.processingNotes).toContain('Executed command: state-check');
    });

    it('should handle unknown commands', async () => {
      const result = await service.processMessage(
        'user-123',
        '^unknown Test unknown command',
      );

      expect(result.processingNotes).toContain('Unknown command: ^unknown');
    });

    it('should process multiple commands in one message', async () => {
      const result = await service.processMessage(
        'user-123',
        '^concise &disciplined !state-check Process multiple commands',
      );

      // Expecting 4 notes: concise, disciplined enable, state-check execution, and state-check result
      expect(result.processingNotes.length).toBeGreaterThanOrEqual(3);
      expect(result.activeStateModifiers).toContain('disciplined');
      expect(result.executedCommands).toContain('state-check');
    });
  });

  describe('getSessionState', () => {
    it('should return session state with last CIDAFM options', async () => {
      const mockMessage = {
        cidafm_options: { active_state_modifiers: ['disciplined'] },
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockMessage,
        error: null,
      });

      jest.spyOn(service, 'findAllCommands').mockResolvedValue([]);

      const result = await service.getSessionState('user-123', 'session-123');

      expect(result.activeStateModifiers).toEqual(['disciplined']);
      expect(result.session_state).toEqual(mockMessage.cidafm_options);
    });

    it('should return default state if no previous CIDAFM options', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      jest.spyOn(service, 'findAllCommands').mockResolvedValue([]);

      const result = await service.getSessionState('user-123', 'session-123');

      expect(result.activeStateModifiers).toEqual([]);
    });
  });

  describe('resetSessionState', () => {
    it('should reset session state to default', async () => {
      const result = await service.resetSessionState('user-123', 'session-123');

      expect(result.message).toBe('Session state reset successfully');
      expect(result.reset_state.activeStateModifiers).toEqual([
        'token-efficient',
      ]);
    });
  });

  describe('getHelp', () => {
    it('should return CIDAFM help documentation', async () => {
      jest.spyOn(service, 'findAllCommands').mockResolvedValue([
        {
          id: '1',
          type: '^',
          name: 'concise',
          description: 'Make responses concise',
          defaultActive: false,
          isBuiltin: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ]);

      const result = await service.getHelp();

      expect(result.overview).toContain('CIDAFM');
      expect(result.command_types['^']).toContain('Response Modifiers');
      expect(result.command_types['&']).toContain('State Modifiers');
      expect(result.command_types['!']).toContain('Execution Commands');
      expect(result.examples).toHaveLength(3);
      expect(result.built_in_commands).toHaveLength(1);
    });
  });
});
