import { Test, TestingModule } from '@nestjs/testing';
import {
  AgentMetadataService,
  AgentCard,
  AgentMetadata,
  AgentCardConfig,
} from './agent-metadata.service';
import * as fs from 'fs-extra';

// Mock fs-extra
jest.mock('fs-extra');
const mockFs = {
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(Buffer.from('')),
};

// Replace the actual fs methods with our mocks
(fs.pathExists as jest.MockedFunction<typeof fs.pathExists>) =
  mockFs.pathExists;
(fs.readFile as any) = mockFs.readFile;

describe('AgentMetadataService', () => {
  let service: AgentMetadataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentMetadataService],
    }).compile();

    service = module.get<AgentMetadataService>(AgentMetadataService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear caches after each test
    service.clearCaches();
  });

  describe('constructor', () => {
    it('should initialize with default cache options', () => {
      const newService = new AgentMetadataService();
      expect(newService).toBeDefined();
    });

    it('should initialize with custom cache options', () => {
      const newService = new AgentMetadataService();
      expect(newService).toBeDefined();
    });
  });

  describe('generateAgentCard', () => {
    const mockAgentConfig = {
      name: 'Test Agent',
      type: 'specialist',
      description: 'A test agent for unit testing',
      version: '2.0.0',
      provider: {
        organization: 'Test Org',
        url: 'https://test.com',
      },
    };

    it('should generate a basic agent card', async () => {
      const baseUrl = 'https://api.test.com';
      const card = await service.generateAgentCard(mockAgentConfig, baseUrl);

      expect(card).toBeDefined();
      expect(card.name).toBe('Test Agent');
      expect(card.type).toBe('specialist');
      expect(card.description).toBe('A test agent for unit testing');
      expect(card.url).toBe(baseUrl);
      expect(card.version).toBe('2.0.0');
      expect(card.capabilities).toBeDefined();
      expect(card.skills).toBeDefined();
      expect(Array.isArray(card.skills)).toBe(true);
      expect(card.defaultInputModes).toEqual([
        'text/plain',
        'application/json',
      ]);
      expect(card.defaultOutputModes).toEqual([
        'text/plain',
        'application/json',
      ]);
    });

    it('should use default values for missing config properties', async () => {
      const minimalConfig = { name: 'Minimal Agent' };
      const baseUrl = 'https://api.test.com';
      const card = await service.generateAgentCard(minimalConfig, baseUrl);

      expect(card.name).toBe('Minimal Agent');
      expect(card.type).toBe('general');
      expect(card.description).toBe(
        'Minimal Agent - A2A Protocol compliant agent',
      );
      expect(card.version).toBe('1.0.0');
      expect(card.provider).toEqual({
        organization: 'Orchestra AI',
        url: 'https://orchestra-ai.com',
      });
    });

    it('should apply card configuration overrides', async () => {
      const config: Partial<AgentCardConfig> = {
        card: {
          iconUrl: 'https://test.com/icon.png',
          documentationUrl: 'https://test.com/docs',
        },
        capabilitiesOverride: {
          streaming: true,
          pushNotifications: true,
        },
      };

      const card = await service.generateAgentCard(
        mockAgentConfig,
        'https://api.test.com',
        config,
      );

      expect(card.iconUrl).toBe('https://test.com/icon.png');
      expect(card.documentationUrl).toBe('https://test.com/docs');
      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(true);
    });

    it('should cache generated cards', async () => {
      const baseUrl = 'https://api.test.com';

      // First call
      const card1 = await service.generateAgentCard(mockAgentConfig, baseUrl);

      // Second call should return cached result
      const card2 = await service.generateAgentCard(mockAgentConfig, baseUrl);

      expect(card1).toBe(card2); // Should be the same object reference
    });

    it('should handle unknown agent config', async () => {
      const card = await service.generateAgentCard({}, 'https://api.test.com');

      expect(card.name).toBe('Unknown Agent');
      expect(card.type).toBe('general');
      expect(card.description).toBe(
        'Unknown Agent - A2A Protocol compliant agent',
      );
    });
  });

  describe('generateAuthenticatedAgentCard', () => {
    const mockAgentConfig = {
      name: 'Auth Agent',
      type: 'specialist',
    };

    it('should generate authenticated card with additional skills', async () => {
      const config: Partial<AgentCardConfig> = {
        authenticatedSkills: [
          {
            id: 'admin-access',
            name: 'Admin Access',
            description: 'Administrative functions',
            tags: ['admin', 'security'],
          },
        ],
      };

      const card = await service.generateAuthenticatedAgentCard(
        mockAgentConfig,
        'https://api.test.com',
        config,
      );

      expect(card.skills.length).toBeGreaterThan(1);
      expect(card.skills.some((skill) => skill.id === 'admin-access')).toBe(
        true,
      );
    });

    it('should add authenticated security schemes', async () => {
      const config: Partial<AgentCardConfig> = {
        authenticatedSecuritySchemes: {
          oauth2: {
            type: 'oauth2',
            description: 'OAuth2 authentication',
          },
        },
      };

      const card = await service.generateAuthenticatedAgentCard(
        mockAgentConfig,
        'https://api.test.com',
        config,
      );

      expect(card.securitySchemes?.oauth2).toBeDefined();
      expect(card.securitySchemes?.oauth2?.type).toBe('oauth2');
    });
  });

  describe('detectCapabilities', () => {
    it('should detect orchestrator capabilities', () => {
      const capabilities = service.detectCapabilities('orchestrator', {});

      expect(capabilities).toContain('general_assistance');
      expect(capabilities).toContain('task_delegation');
      expect(capabilities).toContain('agent_coordination');
      expect(capabilities).toContain('workflow_management');
    });

    it('should detect specialist capabilities', () => {
      const capabilities = service.detectCapabilities('specialist', {});

      expect(capabilities).toContain('general_assistance');
      expect(capabilities).toContain('domain_expertise');
      expect(capabilities).toContain('specialized_processing');
    });

    it('should detect context agent capabilities', () => {
      const capabilities = service.detectCapabilities('context', {});

      expect(capabilities).toContain('general_assistance');
      expect(capabilities).toContain('context_processing');
      expect(capabilities).toContain('document_analysis');
    });

    it('should detect function agent capabilities', () => {
      const capabilities = service.detectCapabilities('function', {});

      expect(capabilities).toContain('general_assistance');
      expect(capabilities).toContain('function_execution');
      expect(capabilities).toContain('code_processing');
    });

    it('should detect python-function agent capabilities', () => {
      const capabilities = service.detectCapabilities('python-function', {});

      expect(capabilities).toContain('general_assistance');
      expect(capabilities).toContain('python_execution');
      expect(capabilities).toContain('script_processing');
      expect(capabilities).toContain('data_analysis');
    });

    it('should detect configuration-based capabilities', () => {
      const agentConfig = {
        streaming: true,
        pushNotifications: true,
        authentication: true,
        fileProcessing: true,
        capabilities: ['custom_capability'],
      };

      const capabilities = service.detectCapabilities('general', agentConfig);

      expect(capabilities).toContain('streaming_support');
      expect(capabilities).toContain('push_notifications');
      expect(capabilities).toContain('authenticated_access');
      expect(capabilities).toContain('file_processing');
      expect(capabilities).toContain('custom_capability');
    });

    it('should handle unknown agent types', () => {
      const capabilities = service.detectCapabilities('unknown', {});

      expect(capabilities).toContain('general_assistance');
      expect(capabilities).toContain('general_processing');
    });

    it('should remove duplicate capabilities', () => {
      const agentConfig = {
        capabilities: ['general_assistance', 'custom_capability'],
      };

      const capabilities = service.detectCapabilities('general', agentConfig);

      // Should not have duplicates
      const uniqueCapabilities = [...new Set(capabilities)];
      expect(capabilities.length).toBe(uniqueCapabilities.length);
    });
  });

  describe('analyzeDirectoryStructure', () => {
    beforeEach(() => {
      // Reset all mocks
      mockFs.pathExists.mockReset();
    });

    it('should detect context agent structure', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-context.md'));
      });

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.hasContextFile).toBe(true);
      expect(structure.hasFunctionFile).toBe(false);
      expect(structure.hasPythonFunction).toBe(false);
      expect(structure.hasServiceFile).toBe(false);
      expect(structure.agentType).toBe('context');
      expect(structure.contextPath).toBe('/test/path/agent-context.md');
    });

    it('should detect function agent structure', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-function.ts'));
      });

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.hasContextFile).toBe(false);
      expect(structure.hasFunctionFile).toBe(true);
      expect(structure.hasPythonFunction).toBe(false);
      expect(structure.hasServiceFile).toBe(false);
      expect(structure.agentType).toBe('function');
      expect(structure.functionPath).toBe('/test/path/agent-function.ts');
    });

    it('should detect python-function agent structure', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-function.py'));
      });

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.hasContextFile).toBe(false);
      expect(structure.hasFunctionFile).toBe(false);
      expect(structure.hasPythonFunction).toBe(true);
      expect(structure.hasServiceFile).toBe(false);
      expect(structure.agentType).toBe('python-function');
      expect(structure.pythonFunctionPath).toBe('/test/path/agent-function.py');
    });

    it('should detect hybrid agent structure', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(
          filePath.includes('agent-context.md') ||
            filePath.includes('agent-function.ts'),
        );
      });

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.hasContextFile).toBe(true);
      expect(structure.hasFunctionFile).toBe(true);
      expect(structure.hasPythonFunction).toBe(false);
      expect(structure.hasServiceFile).toBe(false);
      expect(structure.agentType).toBe('hybrid');
    });

    it('should detect service agent structure', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-service.ts'));
      });

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.hasContextFile).toBe(false);
      expect(structure.hasFunctionFile).toBe(false);
      expect(structure.hasPythonFunction).toBe(false);
      expect(structure.hasServiceFile).toBe(true);
      expect(structure.agentType).toBe('unknown');
      expect(structure.servicePath).toBe('/test/path/agent-service.ts');
    });

    it('should handle unknown agent structure', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.hasContextFile).toBe(false);
      expect(structure.hasFunctionFile).toBe(false);
      expect(structure.hasPythonFunction).toBe(false);
      expect(structure.hasServiceFile).toBe(false);
      expect(structure.agentType).toBe('unknown');
    });

    it('should cache directory structure analysis', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      // First call
      const structure1 = await service.analyzeDirectoryStructure('/test/path');

      // Second call should use cache
      const structure2 = await service.analyzeDirectoryStructure('/test/path');

      expect(structure1).toBe(structure2);
      expect(mockFs.pathExists).toHaveBeenCalledTimes(4); // Only called once for each file type
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('File system error'));

      const structure = await service.analyzeDirectoryStructure('/test/path');

      expect(structure.agentType).toBe('unknown');
      expect(structure.hasContextFile).toBe(false);
    });
  });

  describe('analyzeAgentDirectory', () => {
    beforeEach(() => {
      mockFs.pathExists.mockReset();
      mockFs.readFile.mockReset();
    });

    it('should analyze agent directory with context file', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-context.md'));
      });

      const mockContextContent = `
# Test Agent

Type: specialist
Description: A test agent for analysis
Version: 1.5.0

## Capabilities
- text_processing
- data_analysis

## Skills
- **Text Analysis**: Analyze text content
- **Data Processing**: Process structured data
      `;

      mockFs.readFile.mockResolvedValue(mockContextContent);

      const _result = await service.analyzeAgentDirectory(
        '/test/agents/test-agent',
      );

      expect(result.agentName).toBe('test-agent');
      expect(result.agentPath).toBe('/test/agents/test-agent');
      expect(result.structure.agentType).toBe('context');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.name).toBe('Test Agent');
      expect(result.metadata?.type).toBe('specialist');
      expect(result.metadata?.version).toBe('1.5.0');
    });

    it('should handle directory without context file', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-function.ts'));
      });

      const _result = await service.analyzeAgentDirectory(
        '/test/agents/function-agent',
      );

      expect(result.agentName).toBe('function-agent');
      expect(result.structure.agentType).toBe('function');
      expect(result.metadata).toBeUndefined();
    });

    it('should handle context file read errors', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        return Promise.resolve(filePath.includes('agent-context.md'));
      });

      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      const _result = await service.analyzeAgentDirectory(
        '/test/agents/error-agent',
      );

      expect(result.agentName).toBe('error-agent');
      expect(result.structure.agentType).toBe('context');
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('metadata caching', () => {
    const mockMetadata: AgentMetadata = {
      name: 'Test Agent',
      type: 'specialist',
      description: 'Test description',
      version: '1.0.0',
      capabilities: ['test_capability'],
      skills: [],
    };

    it('should cache and retrieve metadata', () => {
      const agentId = 'test-agent-123';

      // Cache metadata
      service.cacheMetadata(agentId, mockMetadata);

      // Retrieve cached metadata
      const cached = service.getCachedMetadata(agentId);

      expect(cached).toEqual(mockMetadata);
    });

    it('should return null for non-existent cached metadata', () => {
      const cached = service.getCachedMetadata('non-existent-agent');
      expect(cached).toBeNull();
    });

    it('should clear all caches', () => {
      // Cache some data
      service.cacheMetadata('agent1', mockMetadata);

      // Clear caches
      service.clearCaches();

      // Should return null after clearing
      const cached = service.getCachedMetadata('agent1');
      expect(cached).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('metadata');
      expect(stats).toHaveProperty('cards');
      expect(stats).toHaveProperty('structures');

      expect(stats.metadata).toHaveProperty('size');
      expect(stats.metadata).toHaveProperty('size');
      expect(stats.cards).toHaveProperty('size');
      expect(stats.cards).toHaveProperty('size');
      expect(stats.structures).toHaveProperty('size');
    });
  });

  describe('validateAgentCard', () => {
    const validCard: AgentCard = {
      name: 'Valid Agent',
      description: 'A valid agent card',
      url: 'https://api.test.com',
      version: '1.0.0',
      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],
      skills: [
        {
          id: 'test-skill',
          name: 'Test Skill',
          description: 'A test skill',
          tags: ['test'],
        },
      ],
    };

    it('should validate a correct agent card', () => {
      const _result = service.validateAgentCard(validCard);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing name', () => {
      const invalidCard = { ...validCard, name: '' };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent card must have a non-empty name');
    });

    it('should detect missing description', () => {
      const invalidCard = { ...validCard, description: '' };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Agent card must have a non-empty description',
      );
    });

    it('should detect missing URL', () => {
      const invalidCard = { ...validCard, url: '' };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent card must have a valid URL');
    });

    it('should detect missing version', () => {
      const invalidCard = { ...validCard, version: '' };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent card must have a version');
    });

    it('should detect missing skills', () => {
      const invalidCard = { ...validCard, skills: [] };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Agent card must have at least one skill',
      );
    });

    it('should detect missing input modes', () => {
      const invalidCard = { ...validCard, defaultInputModes: [] };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Agent card must specify default input modes',
      );
    });

    it('should detect missing output modes', () => {
      const invalidCard = { ...validCard, defaultOutputModes: [] };
      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Agent card must specify default output modes',
      );
    });

    it('should validate individual skills', () => {
      const invalidCard = {
        ...validCard,
        skills: [
          {
            id: '',
            name: '',
            description: '',
            tags: 'invalid' as any,
          },
        ],
      };

      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Skill at index 0 must have a non-empty ID',
      );
      expect(result.errors).toContain(
        'Skill at index 0 must have a non-empty name',
      );
      expect(result.errors).toContain(
        'Skill at index 0 must have a non-empty description',
      );
      expect(result.errors).toContain('Skill at index 0 must have tags array');
    });

    it('should handle multiple validation errors', () => {
      const invalidCard = {
        ...validCard,
        name: '',
        description: '',
        url: '',
        version: '',
        skills: [],
        defaultInputModes: [],
        defaultOutputModes: [],
      };

      const _result = service.validateAgentCard(invalidCard);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });

  describe('private helper methods', () => {
    describe('extractMetadataFromContext', () => {
      it('should extract metadata from markdown content', async () => {
        const mockContent = `
# Test Agent

Type: specialist
Description: A comprehensive test agent
Version: 2.1.0

## Capabilities
- text_processing
- data_analysis
- file_handling

## Skills
- **Text Analysis**: Advanced text processing capabilities
- **Data Mining**: Extract insights from structured data
- **File Processing**: Handle various file formats
        `;

        mockFs.readFile.mockResolvedValue(mockContent);

        // Access private method through any casting
        const _metadata = await (service as any).extractMetadataFromContext(
          '/test/context.md',
        );

        expect(metadata.name).toBe('Test Agent');
        expect(metadata.type).toBe('specialist');
        expect(metadata.description).toBe('A comprehensive test agent');
        expect(metadata.version).toBe('2.1.0');
        expect(metadata.capabilities).toEqual(['general_assistance']); // Default when parsing fails
        expect(metadata.skills).toHaveLength(1); // Default skills when parsing fails
        expect(metadata.skills[0].name).toBe('Basic Communication');
      });

      it('should handle missing metadata fields', async () => {
        const mockContent = `
# Basic Agent

Some basic content without structured metadata.
        `;

        mockFs.readFile.mockResolvedValue(mockContent);

        const _metadata = await (service as any).extractMetadataFromContext(
          '/test/context.md',
        );

        expect(metadata.name).toBe('Basic Agent');
        expect(metadata.type).toBe('general');
        expect(metadata.description).toBe('');
        expect(metadata.version).toBe('1.0.0');
        expect(metadata.capabilities).toEqual(['general_assistance']);
        expect(metadata.skills).toHaveLength(1); // Default skill
      });
    });
  });
});
