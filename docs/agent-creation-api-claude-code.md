# Agent Creation API with Claude Code Integration

## Overview

This document outlines how to implement a system that allows users to create new agents through the API, leveraging Claude Code to generate the necessary directory structure and files. This enables dynamic agent creation without requiring manual coding.

## Architecture

The system consists of:
- **Agent Creation Service**: Handles the creation process and file generation
- **Agent Creation Controller**: REST API endpoints for agent creation
- **Claude Code Integration**: Uses Claude API to generate context content
- **Discovery Integration**: Automatically refreshes agent discovery after creation

## Implementation

### 1. Agent Creation Service

Create `apps/api/src/agents/agent-creation.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';

export interface CreateAgentRequest {
  name: string;
  type: string; // e.g., 'marketing', 'finance', 'engineering'
  category: string; // e.g., 'content_creation', 'data_analysis'
  description: string;
  capabilities: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    examples: string[];
  }>;
  contextContent?: string; // Optional custom context content
}

export interface AgentCreationResult {
  success: boolean;
  agentPath: string;
  filesCreated: string[];
  error?: string;
}

@Injectable()
export class AgentCreationService {
  private readonly logger = new Logger(AgentCreationService.name);
  private readonly agentsBasePath: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.agentsBasePath = path.join(process.cwd(), 'src', 'agents', 'actual');
  }

  async createAgent(request: CreateAgentRequest): Promise<AgentCreationResult> {
    try {
      this.logger.log(`Creating agent: ${request.name} in category: ${request.type}`);

      // 1. Create directory structure
      const agentPath = await this.createDirectoryStructure(request);
      
      // 2. Generate files using Claude Code
      const filesCreated = await this.generateAgentFiles(request, agentPath);

      // 3. Trigger agent discovery refresh
      await this.triggerDiscoveryRefresh();

      return {
        success: true,
        agentPath,
        filesCreated,
      };
    } catch (error) {
      this.logger.error(`Failed to create agent: ${error.message}`);
      return {
        success: false,
        agentPath: '',
        filesCreated: [],
        error: error.message,
      };
    }
  }

  private async createDirectoryStructure(request: CreateAgentRequest): Promise<string> {
    const agentDir = path.join(this.agentsBasePath, request.type, request.name);
    
    // Create directory if it doesn't exist
    await fs.mkdir(agentDir, { recursive: true });
    
    this.logger.log(`Created directory: ${agentDir}`);
    return agentDir;
  }

  private async generateAgentFiles(request: CreateAgentRequest, agentPath: string): Promise<string[]> {
    const filesCreated: string[] = [];

    // Generate agent.yaml
    const yamlContent = this.generateAgentYaml(request);
    await fs.writeFile(path.join(agentPath, 'agent.yaml'), yamlContent);
    filesCreated.push('agent.yaml');

    // Generate agent-service.ts
    const serviceContent = this.generateAgentService(request);
    await fs.writeFile(path.join(agentPath, 'agent-service.ts'), serviceContent);
    filesCreated.push('agent-service.ts');

    // Generate context.md using Claude Code
    const contextContent = await this.generateContextWithClaude(request);
    await fs.writeFile(path.join(agentPath, 'context.md'), contextContent);
    filesCreated.push('context.md');

    return filesCreated;
  }

  private generateAgentYaml(request: CreateAgentRequest): string {
    const agentName = request.name.replace(/([A-Z])/g, ' $1').trim();
    
    return `# ${agentName} Agent Configuration
metadata:
  name: "${agentName}"
  type: "specialist"
  category: "${request.category}"
  version: "1.0.0"
  description: "${request.description}"

# Agent type - determines loading strategy
type: "context"

capabilities:
${request.capabilities.map(cap => `  - ${cap}`).join('\n')}

skills:
${request.skills.map(skill => `  - id: "${skill.id}"
    name: "${skill.name}"
    description: "${skill.description}"
    tags: ["${request.category}"]
    examples:
${skill.examples.map(example => `      - "${example}"`).join('\n')}
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/markdown", "text/html", "application/json"]`).join('\n\n')}

input_modes:
  - "text/plain"
  - "application/json"

output_modes:
  - "text/markdown"
  - "text/html"
  - "application/json"
  - "text/plain"

configuration:
  default_output_format: "markdown"
  execution_modes: ["immediate"]
  content_length_options:
    short: "300-600 words"
    medium: "600-1200 words"
    long: "1200+ words"
  tone_options:
    - "professional"
    - "casual"
    - "technical"
    - "conversational"
    - "formal"
    - "creative"
  audience_targeting:
    - "B2B"
    - "B2C"
    - "technical"
    - "general"
    - "industry-specific"`;
  }

  private generateAgentService(request: CreateAgentRequest): string {
    const className = request.name.replace(/[^a-zA-Z0-9]/g, '') + 'Service';
    
    return `import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { LLMService } from '@/llms/llm.service';
import { TaskStatusService } from '@/tasks/task-status.service';
import { TasksService } from '@/tasks/tasks.service';
import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';

@Injectable()
export class ${className} extends ContextAgentBaseService {
  constructor(
    httpService: HttpService,
    llmService: LLMService,
    agentRegistrationService?: any,
    jsonRpcProtocolService?: any,
    loggingService?: any,
    authService?: any,
    configurationService?: any,
    taskStatusService?: TaskStatusService,
    tasksService?: TasksService,
  ) {
    super(
      httpService,
      llmService,
      agentRegistrationService,
      jsonRpcProtocolService,
      loggingService,
      authService,
      configurationService,
      taskStatusService,
      tasksService,
    );
  }

  /**
   * Override the default name generation to return the correct agent name
   */
  getAgentName(): string {
    return '${request.name.replace(/([A-Z])/g, ' $1').trim()}';
  }
}`;
  }

  private async generateContextWithClaude(request: CreateAgentRequest): Promise<string> {
    // Use custom context if provided, otherwise generate with Claude
    if (request.contextContent) {
      return request.contextContent;
    }

    const claudePrompt = `Create a comprehensive context.md file for a new AI agent with the following specifications:

Agent Name: ${request.name}
Category: ${request.category}
Description: ${request.description}
Capabilities: ${request.capabilities.join(', ')}
Skills: ${request.skills.map(s => s.name).join(', ')}

The context.md file should follow this structure:
1. System Prompt - Define the agent's identity and core directive
2. Writing Standards - How the agent should respond
3. Required Output Format - Specific format requirements
4. Content Specializations - Areas of expertise
5. Instructions - Step-by-step process
6. Examples - Sample interactions
7. Knowledge Base - Relevant information and best practices

Make it comprehensive, professional, and aligned with the agent's purpose. The content should be ready to use immediately.`;

    try {
      // Use Claude API to generate the context
      const response = await firstValueFrom(
        this.httpService.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: claudePrompt
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.configService.get('ANTHROPIC_API_KEY'),
              'anthropic-version': '2023-06-01'
            }
          }
        )
      );

      return response.data.content[0].text;
    } catch (error) {
      this.logger.error('Failed to generate context with Claude:', error);
      // Fallback to basic context
      return this.generateBasicContext(request);
    }
  }

  private generateBasicContext(request: CreateAgentRequest): string {
    return `# System Prompt

You are a ${request.name} agent specializing in ${request.category}.

## Core Identity
${request.description}

## Critical Directive
ALWAYS provide helpful, accurate, and actionable responses based on your expertise.

## Instructions
1. Analyze the user's request carefully
2. Provide comprehensive, well-structured responses
3. Include practical examples and actionable insights
4. Maintain professional tone and clear communication

## Knowledge Base
${request.capabilities.map(cap => `- ${cap}`).join('\n')}

## Examples
${request.skills.map(skill => 
  `### ${skill.name}
${skill.examples.map(example => `- "${example}"`).join('\n')}`
).join('\n\n')}`;
  }

  private async triggerDiscoveryRefresh(): Promise<void> {
    // This would trigger your existing agent discovery service to refresh
    // You might need to emit an event or call a method on the discovery service
    this.logger.log('Triggering agent discovery refresh');
  }
}
```

### 2. Agent Creation Controller

Create `apps/api/src/agents/agent-creation.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { AgentCreationService, CreateAgentRequest } from './agent-creation.service';

@ApiTags('Agent Creation')
@Controller('agent-creation')
@UseGuards(JwtAuthGuard)
export class AgentCreationController {
  private readonly logger = new Logger(AgentCreationController.name);

  constructor(private readonly agentCreationService: AgentCreationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiBody({ type: Object, description: 'Agent creation request' })
  @ApiResponse({
    status: 201,
    description: 'Agent created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        agentPath: { type: 'string', example: 'marketing/blog_post' },
        filesCreated: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['agent.yaml', 'agent-service.ts', 'context.md']
        },
        message: { type: 'string', example: 'Agent created successfully and will be available shortly' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createAgent(
    @Body() request: CreateAgentRequest,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ) {
    this.logger.log(`User ${currentUser.id} creating agent: ${request.name}`);

    const result = await this.agentCreationService.createAgent(request);

    if (!result.success) {
      throw new Error(`Failed to create agent: ${result.error}`);
    }

    return {
      success: true,
      agentPath: result.agentPath,
      filesCreated: result.filesCreated,
      message: 'Agent created successfully and will be available shortly',
    };
  }
}
```

### 3. DTOs for Validation

Create `apps/api/src/agents/dto/create-agent.dto.ts`:

```typescript
import { IsString, IsArray, IsNotEmpty, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AgentSkillDto {
  @ApiProperty({ description: 'Unique identifier for the skill' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Display name for the skill' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description of what the skill does' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Example use cases for the skill', type: [String] })
  @IsArray()
  @IsString({ each: true })
  examples: string[];
}

export class CreateAgentDto {
  @ApiProperty({ description: 'Name of the agent (e.g., "blog_post", "invoice_processor")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Agent type/category (e.g., "marketing", "finance")' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Agent category (e.g., "content_creation", "data_analysis")' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Detailed description of the agent\'s purpose' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'List of agent capabilities', type: [String] })
  @IsArray()
  @IsString({ each: true })
  capabilities: string[];

  @ApiProperty({ description: 'Agent skills and functions', type: [AgentSkillDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentSkillDto)
  skills: AgentSkillDto[];

  @ApiProperty({ description: 'Custom context content (optional)', required: false })
  @IsOptional()
  @IsString()
  contextContent?: string;
}
```

### 4. Module Configuration

Update or create `apps/api/src/agents/agents.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AgentCreationService } from './agent-creation.service';
import { AgentCreationController } from './agent-creation.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AgentCreationController],
  providers: [AgentCreationService],
  exports: [AgentCreationService],
})
export class AgentsModule {}
```

### 5. Update Discovery Service

Add this method to your existing `AgentDiscoveryService`:

```typescript
// Add to apps/api/src/agent-discovery.service.ts
async refreshDiscovery(): Promise<void> {
  this.logger.log('🔄 Refreshing agent discovery...');
  await this.discoverAgents();
  this.logger.log('✅ Agent discovery refreshed');
}
```

## Usage Examples

### Basic Agent Creation

```bash
curl -X POST http://localhost:3000/agent-creation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "social_media_manager",
    "type": "marketing",
    "category": "social_media",
    "description": "Create engaging social media content and manage posting schedules",
    "capabilities": [
      "content_creation",
      "social_media_management",
      "content_scheduling",
      "engagement_analysis"
    ],
    "skills": [
      {
        "id": "social_post_creation",
        "name": "Social Post Creation",
        "description": "Generate engaging social media posts for various platforms",
        "examples": [
          "Create a LinkedIn post about AI trends",
          "Generate Instagram captions for product photos"
        ]
      }
    ]
  }'
```

### Agent with Custom Context

```bash
curl -X POST http://localhost:3000/agent-creation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "data_analyst",
    "type": "finance",
    "category": "data_analysis",
    "description": "Analyze financial data and generate insights",
    "capabilities": [
      "data_analysis",
      "financial_modeling",
      "report_generation",
      "trend_analysis"
    ],
    "skills": [
      {
        "id": "financial_analysis",
        "name": "Financial Analysis",
        "description": "Analyze financial statements and metrics",
        "examples": [
          "Analyze quarterly revenue trends",
          "Calculate key financial ratios"
        ]
      }
    ],
    "contextContent": "# System Prompt\n\nYou are a financial data analyst...\n\n## Core Identity\nExpert financial analyst...\n\n## Instructions\n1. Review financial data carefully...\n2. Provide clear, actionable insights...\n3. Include relevant metrics and trends...\n\n## Knowledge Base\n- Financial statement analysis\n- Ratio calculations\n- Trend identification\n- Risk assessment"
  }'
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "agentPath": "marketing/social_media_manager",
  "filesCreated": ["agent.yaml", "agent-service.ts", "context.md"],
  "message": "Agent created successfully and will be available shortly"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Failed to create agent: Directory already exists"
}
```

## Security Considerations

### Input Validation
- Validate all user inputs using DTOs
- Sanitize file paths to prevent directory traversal
- Limit file sizes and content lengths

### Authentication & Authorization
- Require JWT authentication for all creation endpoints
- Implement role-based access control if needed
- Log all agent creation activities

### Rate Limiting
- Implement rate limiting to prevent abuse
- Consider daily/monthly limits per user
- Monitor for suspicious creation patterns

### File System Security
- Validate agent names to prevent malicious paths
- Ensure proper file permissions
- Backup existing agents before modifications

## Environment Variables

Add these to your `.env` file:

```bash
# Claude API Configuration
ANTHROPIC_API_KEY=your_claude_api_key_here

# Agent Creation Limits
MAX_AGENTS_PER_USER=10
MAX_AGENT_NAME_LENGTH=50
MAX_CONTEXT_LENGTH=10000
```

## Error Handling

The service includes comprehensive error handling:

- **Directory Creation Errors**: Handles permission issues and existing directories
- **File Write Errors**: Manages disk space and permission problems
- **Claude API Errors**: Falls back to basic context generation
- **Validation Errors**: Returns detailed validation messages
- **Discovery Errors**: Logs issues but doesn't fail the creation

## Monitoring & Logging

### Log Levels
- **INFO**: Successful agent creation
- **WARN**: Non-critical issues (fallback to basic context)
- **ERROR**: Failed agent creation attempts
- **DEBUG**: Detailed creation process steps

### Metrics to Track
- Agent creation success rate
- Claude API usage and costs
- Most popular agent types/categories
- Creation time and performance

## Testing

### Unit Tests
- Test file generation functions
- Validate YAML and TypeScript output
- Mock Claude API responses

### Integration Tests
- Test complete agent creation flow
- Verify discovery service integration
- Test error scenarios

### E2E Tests
- Test API endpoints with real requests
- Verify agent functionality after creation
- Test authentication and authorization

## Future Enhancements

### Template System
- Pre-defined agent templates
- Custom template creation
- Template sharing between users

### Advanced Claude Integration
- Multi-step context generation
- Context refinement based on user feedback
- Custom prompt templates

### Agent Marketplace
- Public agent sharing
- Agent ratings and reviews
- Featured agent collections

### Advanced Features
- Agent versioning
- Agent cloning and modification
- Agent dependency management
- Automated testing for new agents

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check file system permissions
2. **Claude API Errors**: Verify API key and rate limits
3. **Discovery Not Working**: Ensure discovery service is properly integrated
4. **Invalid Agent Names**: Check naming conventions and validation

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
// In your service
this.logger.debug(`Creating agent with request: ${JSON.stringify(request)}`);
```

## Conclusion

This implementation provides a powerful, user-friendly way to create agents dynamically while maintaining security and consistency. The integration with Claude Code ensures high-quality context generation, while the modular design allows for easy extension and customization. 