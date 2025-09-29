import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEnabled', () => {
    it('should return false when feature flag is disabled', () => {
      jest.spyOn(configService, 'get').mockReturnValue('false');

      const result = service.isEnabled('TEST_FLAG');

      expect(result).toBe(false);
      expect(configService.get).toHaveBeenCalledWith(
        'FEATURE_FLAG_TEST_FLAG_ENABLED',
        'false',
      );
    });

    it('should return true when feature flag is enabled with no restrictions', () => {
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'FEATURE_FLAG_TEST_FLAG_ENABLED') return 'true';
          return defaultValue || '';
        });

      const result = service.isEnabled('TEST_FLAG');

      expect(result).toBe(true);
    });

    it('should respect target users', () => {
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'FEATURE_FLAG_TEST_FLAG_ENABLED') return 'true';
          if (key === 'FEATURE_FLAG_TEST_FLAG_TARGET_USERS')
            return 'user1,user2';
          return defaultValue || '';
        });

      const resultTargeted = service.isEnabled('TEST_FLAG', {
        userId: 'user1',
      });
      const resultNotTargeted = service.isEnabled('TEST_FLAG', {
        userId: 'user3',
      });

      expect(resultTargeted).toBe(true);
      expect(resultNotTargeted).toBe(false);
    });

    it('should respect exclude users', () => {
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'FEATURE_FLAG_TEST_FLAG_ENABLED') return 'true';
          if (key === 'FEATURE_FLAG_TEST_FLAG_EXCLUDE_USERS')
            return 'user1,user2';
          return defaultValue || '';
        });

      const resultExcluded = service.isEnabled('TEST_FLAG', {
        userId: 'user1',
      });
      const resultNotExcluded = service.isEnabled('TEST_FLAG', {
        userId: 'user3',
      });

      expect(resultExcluded).toBe(false);
      expect(resultNotExcluded).toBe(true);
    });

    it('should handle rollout percentage', () => {
      jest
        .spyOn(configService, 'get')
        .mockImplementation((key: string, defaultValue?: string) => {
          if (key === 'FEATURE_FLAG_TEST_FLAG_ENABLED') return 'true';
          if (key === 'FEATURE_FLAG_TEST_FLAG_ROLLOUT_PERCENTAGE') return '50';
          return defaultValue || '';
        });

      // Test with deterministic user ID that should be in 50% rollout
      const result = service.isEnabled('TEST_FLAG', { userId: 'test-user-1' });

      // The result depends on the hash function, but it should be consistent
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isSovereignRoutingEnabled', () => {
    it('should check SOVEREIGN_ROUTING flag', () => {
      jest.spyOn(configService, 'get').mockReturnValue('true');

      const result = service.isSovereignRoutingEnabled({ userId: 'test' });

      expect(configService.get).toHaveBeenCalledWith(
        'FEATURE_FLAG_SOVEREIGN_ROUTING_ENABLED',
        'false',
      );
    });
  });
});
