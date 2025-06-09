import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { createClient } from '@supabase/supabase-js';

// Mock the Supabase client
jest.mock('@supabase/supabase-js');
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('SupabaseService', () => {
  let service: SupabaseService;
  let configService: ConfigService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    // Create mock Supabase client
    mockSupabaseClient = {
      auth: {
        setSession: jest.fn(),
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'supabase.url':
                  return 'https://test.supabase.co';
                case 'supabase.anonKey':
                  return 'test-anon-key';
                case 'supabase.serviceKey':
                  return 'test-service-key';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize clients successfully', () => {
      service.onModuleInit();
      
      expect(mockCreateClient).toHaveBeenCalledTimes(2);
      expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
      expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-service-key');
    });

    it('should not throw error if SUPABASE_URL is missing (logs warning instead)', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return null;
        return 'test-key';
      });

      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('should handle missing anon key gracefully', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return 'https://test.supabase.co';
        if (key === 'supabase.anonKey') return null;
        if (key === 'supabase.serviceKey') return 'test-service-key';
        return null;
      });

      expect(() => service.onModuleInit()).not.toThrow();
      expect(mockCreateClient).toHaveBeenCalledTimes(1); // Only service client
    });

    it('should handle missing service key gracefully', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return 'https://test.supabase.co';
        if (key === 'supabase.anonKey') return 'test-anon-key';
        if (key === 'supabase.serviceKey') return null;
        return null;
      });

      expect(() => service.onModuleInit()).not.toThrow();
      expect(mockCreateClient).toHaveBeenCalledTimes(1); // Only anon client
    });
  });

  describe('getAnonClient', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return the anonymous client', () => {
      const client = service.getAnonClient();
      expect(client).toBe(mockSupabaseClient);
    });

    it('should throw HttpException if anon client is not available', () => {
      // Create service without anon key
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return 'https://test.supabase.co';
        if (key === 'supabase.anonKey') return null;
        if (key === 'supabase.serviceKey') return 'test-service-key';
        return null;
      });

      const serviceWithoutAnon = new SupabaseService(configService);
      serviceWithoutAnon.onModuleInit();

      expect(() => serviceWithoutAnon.getAnonClient()).toThrow(HttpException);
      expect(() => serviceWithoutAnon.getAnonClient()).toThrow(
        expect.objectContaining({
          message: 'Supabase client is not available. Check server configuration.',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        }),
      );
    });
  });

  describe('getServiceClient', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return the service client', () => {
      const client = service.getServiceClient();
      expect(client).toBe(mockSupabaseClient);
    });

    it('should throw HttpException if service client is not available', () => {
      // Create service without service key
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return 'https://test.supabase.co';
        if (key === 'supabase.anonKey') return 'test-anon-key';
        if (key === 'supabase.serviceKey') return null;
        return null;
      });

      const serviceWithoutService = new SupabaseService(configService);
      serviceWithoutService.onModuleInit();

      expect(() => serviceWithoutService.getServiceClient()).toThrow(HttpException);
      expect(() => serviceWithoutService.getServiceClient()).toThrow(
        expect.objectContaining({
          message: 'Supabase service client is not available. Check server configuration.',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        }),
      );
    });
  });

  describe('createAuthenticatedClient', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create an authenticated client with token', () => {
      const token = 'test-jwt-token';
      const authenticatedClient = service.createAuthenticatedClient(token);

      expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
      expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledWith({
        access_token: token,
        refresh_token: 'placeholder_refresh_token',
      });
      expect(authenticatedClient).toBe(mockSupabaseClient);
    });

    it('should throw HttpException if configuration is missing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return null;
        return 'test-key';
      });

      expect(() => service.createAuthenticatedClient('test-token')).toThrow(HttpException);
      expect(() => service.createAuthenticatedClient('test-token')).toThrow(
        expect.objectContaining({
          message: 'Authentication service configuration error.',
          status: HttpStatus.SERVICE_UNAVAILABLE,
        }),
      );
    });

    it('should handle client creation errors', () => {
      // Reset the mock to throw an error for this specific test
      mockCreateClient.mockReset();
      mockCreateClient.mockImplementation(() => {
        throw new Error('Client creation failed');
      });

      expect(() => service.createAuthenticatedClient('test-token')).toThrow(HttpException);
      
      // Test the specific error by catching it
      try {
        service.createAuthenticatedClient('test-token');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        if (error instanceof HttpException) {
          expect(error.message).toBe('Could not create authenticated client.');
          expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        }
      }
    });
  });

  describe('executeQuery', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should execute query with anon client by default', async () => {
      const mockCallback = jest.fn().mockResolvedValue('query result');
      
      const result = await service.executeQuery(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(mockSupabaseClient);
      expect(result).toBe('query result');
    });

    it('should execute query with service client when requested', async () => {
      const mockCallback = jest.fn().mockResolvedValue('service query result');
      
      const result = await service.executeQuery(mockCallback, true);

      expect(mockCallback).toHaveBeenCalledWith(mockSupabaseClient);
      expect(result).toBe('service query result');
    });

    it('should handle query execution errors', async () => {
      const mockCallback = jest.fn().mockRejectedValue(new Error('Query failed'));
      
      await expect(service.executeQuery(mockCallback)).rejects.toThrow('Query failed');
    });
  });

  describe('checkConnection', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should return success status for healthy connection', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [{ id: 'test-id' }],
            error: null,
          }),
        }),
      });

      const result = await service.checkConnection();

      expect(result).toEqual({
        status: 'ok',
        message: 'Database connection successful',
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should return error status for failed query', async () => {
      const mockError = { message: 'Connection failed' };
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: mockError,
          }),
        }),
      });

      const result = await service.checkConnection();

      expect(result).toEqual({
        status: 'error',
        message: 'Connection failed',
      });
    });

    it('should handle connection check exceptions', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await service.checkConnection();

      expect(result).toEqual({
        status: 'error',
        message: 'Network error',
      });
    });

    it('should return error if anon client is not initialized', async () => {
      // Create service without anon key
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'supabase.url') return 'https://test.supabase.co';
        if (key === 'supabase.anonKey') return null;
        if (key === 'supabase.serviceKey') return 'test-service-key';
        return null;
      });

      const serviceWithoutAnon = new SupabaseService(configService);
      serviceWithoutAnon.onModuleInit();

      const result = await serviceWithoutAnon.checkConnection();

      expect(result).toEqual({
        status: 'disabled',
        message: 'Supabase not configured - service disabled',
      });
    });
  });
}); 