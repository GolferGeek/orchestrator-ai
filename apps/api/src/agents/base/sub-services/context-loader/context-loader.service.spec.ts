import { Test, TestingModule } from '@nestjs/testing';
import { ContextLoaderService } from './context-loader.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ContextLoaderService', () => {
  let service: ContextLoaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContextLoaderService],
    }).compile();

    service = module.get<ContextLoaderService>(ContextLoaderService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('loadContextFile', () => {
    it('should return null when context.md file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result).toBeNull();
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('/test/agent/directory', 'context.md')
      );
    });

    it('should return null when file reading throws an error', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result).toBeNull();
    });

    it('should parse context file successfully with videos section', async () => {
      const mockContent = `# Agent Name

## System Prompt
This is the system prompt.

## Videos
metrics-agent-walkthrough
marketing-swarm-demo
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result).not.toBeNull();
      expect(result?.videos).toEqual(['metrics-agent-walkthrough', 'marketing-swarm-demo']);
      expect(result?.systemPrompt).toContain('This is the system prompt.');
      expect(result?.instructions).toBeUndefined();
    });

    it('should parse videos section with bullet points', async () => {
      const mockContent = `# Agent Name

## Videos
- metrics-agent-walkthrough
+ requirements-writer-tutorial
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual([
        'metrics-agent-walkthrough',
        'requirements-writer-tutorial',
      ]);
    });

    it('should handle empty videos section', async () => {
      const mockContent = `# Agent Name

## System Prompt
This is the system prompt.

## Videos

## Instructions
These are instructions.
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toBeUndefined();
      expect(result?.systemPrompt).toContain('This is the system prompt.');
    });

    it('should ignore invalid video IDs in videos section', async () => {
      const mockContent = `# Agent Name

## Videos
valid-video-id
another-valid-id
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['valid-video-id', 'another-valid-id']);
    });

    it('should handle videos section with case-insensitive header', async () => {
      const mockContent = `# Agent Name

## videos
video-id-1
video-id-2
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['video-id-1', 'video-id-2']);
    });

    it('should prevent duplicate video IDs', async () => {
      const mockContent = `# Agent Name

## Videos
video-id-1
video-id-2
video-id-1
video-id-3
video-id-2
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['video-id-1', 'video-id-2', 'video-id-3']);
    });

    it('should handle context file without videos section', async () => {
      const mockContent = `# Agent Name

## System Prompt
This is the system prompt.
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toBeUndefined();
      expect(result?.systemPrompt).toContain('This is the system prompt.');
      expect(result?.instructions).toBeUndefined();
      expect(result?.knowledgeBase).toBeUndefined();
    });

    it('should validate video ID length and format', async () => {
      const mockContent = `# Agent Name

## Videos
valid-id-123
x
${'a'.repeat(101)}
another-valid-id_test
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['valid-id-123', 'x', 'another-valid-id_test']);
    });

    it('should handle mixed content in videos section', async () => {
      const mockContent = `# Agent Name

## Videos
valid-video-1

Some description text here
- valid-video-2

More text
valid-video-3
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['valid-video-1', 'valid-video-2', 'valid-video-3']);
    });
  });

  describe('parseVideos (private method testing via integration)', () => {
    it('should handle null or undefined content gracefully', async () => {
      const mockContent = `# Agent Name

## Videos
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toBeUndefined();
    });

    it('should extract video IDs with various formatting', async () => {
      const mockContent = `# Agent Name

## Videos
  video-with-spaces  
- bullet-point-video
+ plus-video
video123
video_with_underscores
video-with-dashes
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual([
        'video-with-spaces',
        'bullet-point-video',
        'plus-video',
        'video123',
        'video_with_underscores',
        'video-with-dashes',
      ]);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt with all sections including videos metadata', async () => {
      const contextContent = {
        systemPrompt: 'Base system prompt',
        instructions: 'Agent instructions',
        knowledgeBase: 'Knowledge content',
        examples: [
          { query: 'Test query', response: 'Test response' }
        ],
        videos: ['video-1', 'video-2'],
        rawContent: 'Raw markdown content'
      };

      const systemPrompt = service.buildSystemPrompt(contextContent, 'TestAgent', 'context');

      expect(systemPrompt).toContain('Base system prompt');
      expect(systemPrompt).toContain('## Instructions');
      expect(systemPrompt).toContain('Agent instructions');
      expect(systemPrompt).toContain('## Knowledge Base');
      expect(systemPrompt).toContain('Knowledge content');
      expect(systemPrompt).toContain('## Examples');
      expect(systemPrompt).toContain('Test query');
      expect(systemPrompt).toContain('Test response');
    });

    it('should build system prompt without optional sections', async () => {
      const contextContent = {
        systemPrompt: 'Base system prompt',
        rawContent: 'Raw markdown content'
      };

      const systemPrompt = service.buildSystemPrompt(contextContent, 'TestAgent', 'context');

      expect(systemPrompt).toBe('Base system prompt');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed video section gracefully', async () => {
      const mockContent = `# Agent Name

## Videos
<<invalid>>
@#$%^&*()
normal-video-id
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['normal-video-id']);
    });

    it('should handle extremely long video IDs', async () => {
      const longVideoId = 'a'.repeat(150);
      const mockContent = `# Agent Name

## Videos
${longVideoId}
valid-id
`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      // Should exclude the overly long video ID
      expect(result?.videos).toEqual(['valid-id']);
    });

    it('should handle empty lines and whitespace in videos section', async () => {
      const mockContent = `# Agent Name

## Videos



video-1


video-2



`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = await service.loadContextFile('/test/agent/directory');

      expect(result?.videos).toEqual(['video-1', 'video-2']);
    });
  });
});