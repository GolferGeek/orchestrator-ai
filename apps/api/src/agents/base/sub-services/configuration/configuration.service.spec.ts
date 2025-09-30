import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationService } from './configuration.service';
import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Test schema class for validation
class TestConfigSchema {
  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  port?: number;

  @IsArray()
  @IsOptional()
  features?: string[];
}

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let mockLogger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigurationService],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);

    // Mock the logger to avoid console output during tests
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };
    (service as any).logger = mockLogger;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.TEST_VAR;
    delete process.env.TEST_PREFIX_VAR;
    delete process.env.API_HOST;
    delete process.env.API_PORT;
  });

  describe('parseYamlFile', () => {
    const testYamlContent = `
name: test-agent
port: 3000
features:
  - feature1
  - feature2
url: \${API_HOST}:\${API_PORT:4000}
`;

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(testYamlContent);
    });

    it('should parse a valid YAML file successfully', async () => {
      const _result = await service.parseYamlFile('/test/config.yaml');

      expect(result.data).toEqual({
        name: 'test-agent',
        port: 3000,
        features: ['feature1', 'feature2'],
        url: '${API_HOST}:4000',
      });
      expect(result.sourcePath).toBe('/test/config.yaml');
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/test/config.yaml',
        'utf8',
      );
    });

    it('should substitute environment variables by default', async () => {
      process.env.API_HOST = 'localhost';
      process.env.API_PORT = '8080';

      const _result = await service.parseYamlFile('/test/config.yaml');

      expect(result.data.url).toBe('localhost:8080');
      expect(result.substitutedVars).toEqual(['API_HOST', 'API_PORT']);
    });

    it('should use default values when environment variables are not set', async () => {
      const _result = await service.parseYamlFile('/test/config.yaml');

      expect(result.data.url).toBe('${API_HOST}:4000');
      expect(result.substitutedVars).toEqual([]);
    });

    it('should skip environment variable substitution when disabled', async () => {
      process.env.API_HOST = 'localhost';

      const _result = await service.parseYamlFile('/test/config.yaml', {
        substituteEnvVars: false,
      });

      expect(result.data.url).toBe('${API_HOST}:${API_PORT:4000}');
      expect(result.substitutedVars).toBeUndefined();
    });

    it('should resolve relative file paths', async () => {
      await service.parseYamlFile('/test/config.yaml');

      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/test/config.yaml',
        'utf8',
      );
    });

    it('should throw error when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        service.parseYamlFile('/nonexistent/config.yaml'),
      ).rejects.toThrow(
        'Configuration file not found: /nonexistent/config.yaml',
      );
    });

    it('should throw error when YAML parsing fails', async () => {
      mockFs.readFileSync.mockReturnValue('invalid: yaml: content: [');

      await expect(service.parseYamlFile('/test/config.yaml')).rejects.toThrow(
        'Failed to parse YAML configuration',
      );
    });

    it('should throw error when YAML file is empty', async () => {
      mockFs.readFileSync.mockReturnValue('');

      await expect(service.parseYamlFile('/test/config.yaml')).rejects.toThrow(
        'Failed to parse YAML configuration',
      );
    });
  });

  describe('parseYamlString', () => {
    const testYamlContent = `
name: test-agent
port: 3000
url: \${API_HOST:localhost}:\${API_PORT:4000}
`;

    it('should parse YAML string successfully', () => {
      const _result = service.parseYamlString(testYamlContent);

      expect(result.data).toEqual({
        name: 'test-agent',
        port: 3000,
        url: 'localhost:4000',
      });
    });

    it('should substitute environment variables in string parsing', () => {
      process.env.API_HOST = 'production.example.com';
      process.env.API_PORT = '443';

      const _result = service.parseYamlString(testYamlContent);

      expect(result.data.url).toBe('production.example.com:443');
      expect(result.substitutedVars).toEqual(['API_HOST', 'API_PORT']);
    });

    it('should throw error for invalid YAML string', () => {
      expect(() => service.parseYamlString('invalid: yaml: [')).toThrow(
        'Failed to parse YAML content',
      );
    });
  });

  describe('substituteEnvVars', () => {
    it('should substitute simple environment variables', () => {
      process.env.TEST_VAR = 'test-value';

      const config = {
        setting: '${TEST_VAR}',
        nested: {
          value: '${TEST_VAR}',
        },
      };

      const _result = service.substituteEnvVars(config);

      expect(result.data).toEqual({
        setting: 'test-value',
        nested: {
          value: 'test-value',
        },
      });
      expect(result.substitutedVars).toEqual(['TEST_VAR', 'TEST_VAR']);
    });

    it('should substitute environment variables with default values', () => {
      const config = {
        host: '${MISSING_HOST:localhost}',
        port: '${MISSING_PORT:4000}',
      };

      const _result = service.substituteEnvVars(config);

      expect(result.data).toEqual({
        host: 'localhost',
        port: '4000',
      });
      expect(result.substitutedVars).toEqual([]);
    });

    it('should use environment variable prefix', () => {
      process.env.TEST_PREFIX_VAR = 'prefixed-value';

      const config = {
        setting: '${VAR}',
      };

      const _result = service.substituteEnvVars(config, 'TEST_PREFIX_');

      expect(result.data.setting).toBe('prefixed-value');
      expect(result.substitutedVars).toEqual(['TEST_PREFIX_VAR']);
    });

    it('should handle arrays and nested objects', () => {
      process.env.TEST_VAR = 'test-value';

      const config = {
        array: ['${TEST_VAR}', 'static-value'],
        nested: {
          deep: {
            value: '${TEST_VAR}',
          },
        },
      };

      const _result = service.substituteEnvVars(config);

      expect(result.data).toEqual({
        array: ['test-value', 'static-value'],
        nested: {
          deep: {
            value: 'test-value',
          },
        },
      });
    });

    it('should throw error in strict mode when variable is missing', () => {
      const config = { setting: '${MISSING_VAR}' };

      expect(() => service.substituteEnvVars(config, undefined, true)).toThrow(
        'Required environment variable not found: MISSING_VAR',
      );
    });

    it('should keep placeholder in non-strict mode when variable is missing', () => {
      const config = { setting: '${MISSING_VAR}' };

      const _result = service.substituteEnvVars(config, undefined, false);

      expect(result.data.setting).toBe('${MISSING_VAR}');
      expect(result.substitutedVars).toEqual([]);
    });

    it('should handle non-string values without modification', () => {
      const config = {
        number: 42,
        boolean: true,
        null_value: null,
        undefined_value: undefined,
      };

      const _result = service.substituteEnvVars(config);

      expect(result.data).toEqual(config);
      expect(result.substitutedVars).toEqual([]);
    });
  });

  describe('validateSchema', () => {
    it('should validate valid configuration successfully', async () => {
      const config = {
        name: 'test-agent',
        port: 3000,
        features: ['feature1', 'feature2'],
      };

      const errors = await service.validateSchema(
        config,
        TestConfigSchema as any,
      );

      expect(errors).toHaveLength(0);
    });

    it('should return validation errors for invalid configuration', async () => {
      const config = {
        name: 123, // Should be string
        port: 'invalid', // Should be number
        features: 'not-array', // Should be array
      };

      const errors = await service.validateSchema(
        config,
        TestConfigSchema as any,
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'name')).toBe(true);
    });

    it('should handle missing required fields', async () => {
      const config = {
        // Missing required 'name' field
        port: 3000,
      };

      const errors = await service.validateSchema(
        config,
        TestConfigSchema as any,
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'name')).toBe(true);
    });
  });

  describe('resolveFilePath', () => {
    it('should return absolute paths unchanged', () => {
      const absolutePath = '/absolute/path/to/file.yaml';
      const _result = service.resolveFilePath(absolutePath);

      expect(result).toBe(absolutePath);
    });

    it('should resolve relative paths from current working directory', () => {
      const relativePath = 'config/file.yaml';
      const _result = service.resolveFilePath(relativePath);

      expect(result).toBe(path.resolve(process.cwd(), relativePath));
    });

    it('should resolve relative paths from specified base directory', () => {
      const relativePath = 'config/file.yaml';
      const baseDir = '/custom/base';
      const _result = service.resolveFilePath(relativePath, baseDir);

      expect(result).toBe(path.resolve(baseDir, relativePath));
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', () => {
      mockFs.existsSync.mockReturnValue(true);

      const _result = service.fileExists('/test/config.yaml');

      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/config.yaml');
    });

    it('should return false when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const _result = service.fileExists('/test/config.yaml');

      expect(result).toBe(false);
    });

    it('should resolve relative paths before checking existence', () => {
      mockFs.existsSync.mockReturnValue(true);

      service.fileExists('config.yaml', '/test');

      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/config.yaml');
    });
  });

  describe('getFileStats', () => {
    const mockStats = {
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date(),
    } as fs.Stats;

    it('should return file stats when file exists', () => {
      mockFs.statSync.mockReturnValue(mockStats);

      const _result = service.getFileStats('/test/config.yaml');

      expect(result).toBe(mockStats);
      expect(mockFs.statSync).toHaveBeenCalledWith('/test/config.yaml');
    });

    it('should return null when file does not exist', () => {
      mockFs.statSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const _result = service.getFileStats('/test/config.yaml');

      expect(result).toBeNull();
    });
  });

  describe('writeYamlFile', () => {
    const testConfig = {
      name: 'test-agent',
      port: 3000,
      features: ['feature1', 'feature2'],
    };

    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockImplementation();
      mockFs.writeFileSync.mockImplementation();
    });

    it('should write configuration to YAML file successfully', async () => {
      await service.writeYamlFile('/test/config.yaml', testConfig);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/config.yaml',
        expect.stringContaining('name: test-agent'),
        'utf8',
      );
    });

    it('should create directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await service.writeYamlFile('/test/new-dir/config.yaml', testConfig);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/new-dir', {
        recursive: true,
      });
    });

    it('should resolve relative paths before writing', async () => {
      await service.writeYamlFile('config.yaml', testConfig, {
        baseDirectory: '/test',
      });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test/config.yaml',
        expect.any(String),
        'utf8',
      );
    });

    it('should throw error when write operation fails', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(
        service.writeYamlFile('/test/config.yaml', testConfig),
      ).rejects.toThrow('Failed to write YAML configuration');
    });
  });

  describe('integration tests', () => {
    it('should handle complete configuration workflow', async () => {
      // Setup environment variables
      process.env.API_HOST = 'localhost';
      process.env.API_PORT = '4000';

      const yamlContent = `
name: integration-test
port: \${API_PORT}
host: \${API_HOST}
features:
  - auth
  - logging
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yamlContent);

      // Parse the configuration
      const _result = await service.parseYamlFile('/test/config.yaml');

      // Verify parsing and substitution
      expect(result.data).toEqual({
        name: 'integration-test',
        port: '4000',
        host: 'localhost',
        features: ['auth', 'logging'],
      });
      expect(result.substitutedVars).toEqual(['API_PORT', 'API_HOST']);

      // Validate against schema
      const validationErrors = await service.validateSchema(
        result.data,
        TestConfigSchema,
      );

      // Note: This will have validation errors because port is string instead of number
      // This demonstrates the validation working correctly
      expect(validationErrors.length).toBeGreaterThan(0);
    });
  });
});
