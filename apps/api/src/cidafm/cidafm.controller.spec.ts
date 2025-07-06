import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CIDAFMController } from './cidafm.controller';
import { CIDAFMService } from './cidafm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateCIDAFMCommandDto,
  CIDAFMCommandResponseDto,
} from '../dto/llm-evaluation.dto';

describe('CIDAFMController', () => {
  let controller: CIDAFMController;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
  };

  const mockCIDAFMCommand: CIDAFMCommandResponseDto = {
    id: '456e7890-e89b-12d3-a456-426614174000',
    type: '^',
    name: 'concise',
    description: 'Make responses concise and to the point',
    defaultActive: false,
    isBuiltin: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockCIDAFMService = {
    findAllCommands: jest.fn(),
    findCommandById: jest.fn(),
    createUserCommand: jest.fn(),
    updateUserCommand: jest.fn(),
    deleteUserCommand: jest.fn(),
    processMessage: jest.fn(),
    getSessionState: jest.fn(),
    resetSessionState: jest.fn(),
    getHelp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CIDAFMController],
      providers: [
        {
          provide: CIDAFMService,
          useValue: mockCIDAFMService,
        },
        {
          provide: JwtAuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<CIDAFMController>(CIDAFMController);
    service = module.get<CIDAFMService>(CIDAFMService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCommands', () => {
    it('should return array of CIDAFM commands', async () => {
      mockCIDAFMService.findAllCommands.mockResolvedValue([mockCIDAFMCommand]);

      const result = await controller.getCommands(mockUser);

      expect(result).toEqual([mockCIDAFMCommand]);
      expect(mockCIDAFMService.findAllCommands).toHaveBeenCalledWith(
        mockUser.id,
        {
          type: undefined,
          builtinOnly: true,
          includeUserCommands: false,
        },
      );
    });

    it('should filter commands by type', async () => {
      mockCIDAFMService.findAllCommands.mockResolvedValue([mockCIDAFMCommand]);

      await controller.getCommands(mockUser, '^', true, false);

      expect(mockCIDAFMService.findAllCommands).toHaveBeenCalledWith(
        mockUser.id,
        {
          type: '^',
          builtinOnly: true,
          includeUserCommands: false,
        },
      );
    });
  });

  describe('getCommandsByType', () => {
    it('should return commands of specified type', async () => {
      mockCIDAFMService.findAllCommands.mockResolvedValue([mockCIDAFMCommand]);

      const result = await controller.getCommandsByType(mockUser, '^');

      expect(result).toEqual([mockCIDAFMCommand]);
      expect(mockCIDAFMService.findAllCommands).toHaveBeenCalledWith(
        mockUser.id,
        {
          type: '^',
        },
      );
    });
  });

  describe('getCommand', () => {
    it('should return a single command', async () => {
      mockCIDAFMService.findCommandById.mockResolvedValue(mockCIDAFMCommand);

      const result = await controller.getCommand(
        '456e7890-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual(mockCIDAFMCommand);
      expect(mockCIDAFMService.findCommandById).toHaveBeenCalledWith(
        '456e7890-e89b-12d3-a456-426614174000',
      );
    });

    it('should throw HttpException when command not found', async () => {
      mockCIDAFMService.findCommandById.mockResolvedValue(null);

      await expect(controller.getCommand('non-existent-id')).rejects.toThrow(
        new HttpException('Command not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('createUserCommand', () => {
    it('should create a custom command', async () => {
      const createDto: CreateCIDAFMCommandDto = {
        type: '^',
        name: 'custom',
        description: 'Custom response modifier',
      };

      mockCIDAFMService.createUserCommand.mockResolvedValue(mockCIDAFMCommand);

      const result = await controller.createUserCommand(mockUser, createDto);

      expect(result).toEqual(mockCIDAFMCommand);
      expect(mockCIDAFMService.createUserCommand).toHaveBeenCalledWith(
        mockUser.id,
        createDto,
      );
    });
  });

  describe('updateUserCommand', () => {
    it('should update a user command', async () => {
      const updateDto = {
        name: 'updated',
        description: 'Updated description',
      };

      mockCIDAFMService.updateUserCommand.mockResolvedValue(mockCIDAFMCommand);

      const result = await controller.updateUserCommand(
        mockUser,
        '456e7890-e89b-12d3-a456-426614174000',
        updateDto,
      );

      expect(result).toEqual(mockCIDAFMCommand);
      expect(mockCIDAFMService.updateUserCommand).toHaveBeenCalledWith(
        mockUser.id,
        '456e7890-e89b-12d3-a456-426614174000',
        updateDto,
      );
    });

    it('should throw HttpException when command not found for update', async () => {
      mockCIDAFMService.updateUserCommand.mockResolvedValue(null);

      await expect(
        controller.updateUserCommand(mockUser, 'non-existent-id', {}),
      ).rejects.toThrow(
        new HttpException('Command not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('deleteUserCommand', () => {
    it('should delete a user command', async () => {
      mockCIDAFMService.deleteUserCommand.mockResolvedValue(true);

      const result = await controller.deleteUserCommand(
        mockUser,
        '456e7890-e89b-12d3-a456-426614174000',
      );

      expect(result).toEqual({ message: 'Command deleted successfully' });
      expect(mockCIDAFMService.deleteUserCommand).toHaveBeenCalledWith(
        mockUser.id,
        '456e7890-e89b-12d3-a456-426614174000',
      );
    });

    it('should throw HttpException when command not found for deletion', async () => {
      mockCIDAFMService.deleteUserCommand.mockResolvedValue(false);

      await expect(
        controller.deleteUserCommand(mockUser, 'non-existent-id'),
      ).rejects.toThrow(
        new HttpException('Command not found', HttpStatus.NOT_FOUND),
      );
    });
  });

  describe('processCommands', () => {
    it('should process CIDAFM commands in a message', async () => {
      const processResult = {
        modified_prompt: 'Processed message',
        active_state_modifiers: ['disciplined'],
        executed_commands: ['state-check'],
        processing_notes: ['Applied response modifier: concise'],
      };

      mockCIDAFMService.processMessage.mockResolvedValue(processResult);

      const body = {
        message: '^concise &disciplined !state-check Test message',
        current_state: { active_state_modifiers: [] },
        session_id: 'session-123',
      };

      const result = await controller.processCommands(mockUser, body);

      expect(result).toEqual(processResult);
      expect(mockCIDAFMService.processMessage).toHaveBeenCalledWith(
        mockUser.id,
        body.message,
        body.current_state,
        body.session_id,
      );
    });
  });

  describe('getSessionState', () => {
    it('should return current CIDAFM state for a session', async () => {
      const sessionState = {
        active_state_modifiers: ['disciplined'],
        session_state: { active_state_modifiers: ['disciplined'] },
        available_commands: [mockCIDAFMCommand],
      };

      mockCIDAFMService.getSessionState.mockResolvedValue(sessionState);

      const result = await controller.getSessionState(mockUser, 'session-123');

      expect(result).toEqual(sessionState);
      expect(mockCIDAFMService.getSessionState).toHaveBeenCalledWith(
        mockUser.id,
        'session-123',
      );
    });
  });

  describe('resetSessionState', () => {
    it('should reset CIDAFM state for a session', async () => {
      const resetResult = {
        message: 'Session state reset successfully',
        reset_state: { active_state_modifiers: ['token-efficient'] },
      };

      mockCIDAFMService.resetSessionState.mockResolvedValue(resetResult);

      const result = await controller.resetSessionState(
        mockUser,
        'session-123',
      );

      expect(result).toEqual(resetResult);
      expect(mockCIDAFMService.resetSessionState).toHaveBeenCalledWith(
        mockUser.id,
        'session-123',
      );
    });
  });

  describe('getHelp', () => {
    it('should return CIDAFM help documentation', async () => {
      const helpContent = {
        overview: 'CIDAFM overview',
        command_types: {
          '^': 'Response Modifiers',
          '&': 'State Modifiers',
          '!': 'Execution Commands',
        },
        examples: [
          {
            command: '^concise',
            description: 'Make only the current response concise',
            example: '^concise Explain quantum computing',
          },
        ],
        built_in_commands: [
          {
            type: '^',
            name: 'concise',
            description: 'Make responses concise',
          },
        ],
      };

      mockCIDAFMService.getHelp.mockResolvedValue(helpContent);

      const result = await controller.getHelp();

      expect(result).toEqual(helpContent);
      expect(mockCIDAFMService.getHelp).toHaveBeenCalled();
    });
  });
});
