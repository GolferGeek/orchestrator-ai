import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  const mockSupabaseService = {
    getAnonClient: jest.fn(),
    createAuthenticatedClient: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    it('should call authService.signup with correct parameters', async () => {
      const userCreateDto = {
        email: 'test@example.com',
        password: 'password123',
        display_name: 'Test User',
      };

      const expectedResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
      };

      mockAuthService.signup.mockResolvedValue(expectedResponse);

      const result = await controller.signup(userCreateDto);

      expect(authService.signup).toHaveBeenCalledWith(userCreateDto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('should call authService.login with correct parameters', async () => {
      const userLoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const expectedResponse = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(userLoginDto);

      expect(authService.login).toHaveBeenCalledWith(userLoginDto);
      expect(result).toEqual(expectedResponse);
    });
  });
}); 