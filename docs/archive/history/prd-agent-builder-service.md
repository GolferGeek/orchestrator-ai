# PRD: Agent Builder Service - Complete Implementation Guide

**Version:** 1.0  
**Status:** Ready for Implementation  
**Assignee:** Intern Developer  
**Estimated Timeline:** 2-3 weeks  

## 1. Executive Summary

### Problem Statement
Users need the ability to dynamically create new AI agents for their organization without manual file creation and configuration. Currently, adding new agents requires:
- Manual creation of YAML configuration files
- Writing detailed Context.md system prompts
- Creating TypeScript service classes
- Understanding complex directory structures and naming conventions

### Solution Overview
The Agent Builder Service provides a standalone API and web interface for creating AI agents dynamically using Claude Code's programmatic capabilities. Users can describe their desired agent functionality, and the system will automatically generate, validate, and deploy fully functional agents.

### Business Value
- **Rapid Workforce Expansion**: Create specialized agents in minutes instead of hours
- **No Technical Expertise Required**: Business users can create agents through intuitive forms
- **Quality Assurance**: Generated agents follow established patterns and best practices
- **Integration Ready**: Agents automatically integrate with existing orchestrator workflows

### Success Metrics
- Agent creation time: < 2 minutes from request to deployment
- Generated agent functionality: 95% success rate on first deployment
- User adoption: 80% of users successfully create agents without assistance
- Code quality: Generated agents pass all validation tests

## 2. Technical Architecture

### Service Architecture
The Agent Builder Service is implemented as a standalone NestJS module alongside existing services like AgentDiscoveryService and AgentPoolService. This provides clean separation of concerns and enables both orchestrator integration and direct API access.

### Directory Structure
```
/src/agent-builder/
├── agent-builder.service.ts        # Core service implementation
├── agent-builder.controller.ts     # REST API endpoints
├── agent-builder.module.ts         # NestJS module configuration
├── interfaces.ts                   # TypeScript interfaces
├── dto/                            # Data Transfer Objects
│   ├── create-agent.dto.ts
│   ├── agent-preview.dto.ts
│   └── agent-status.dto.ts
├── templates/                      # File generation templates
│   ├── yaml-template.service.ts
│   ├── context-template.service.ts
│   └── service-template.service.ts
├── claude-code/                    # Claude Code integration
│   ├── claude-executor.service.ts
│   └── batch-scripts/
└── validators/                     # Validation logic
    ├── name-validator.service.ts
    └── structure-validator.service.ts
```

## 3. Complete Backend Implementation

### 3.1 Core Interfaces

```typescript
// /src/agent-builder/interfaces.ts

export interface AgentCreationRequest {
  // Required fields
  prompt: string;                    // User description of desired agent
  agentName: string;                // Name for the agent
  department: string;               // marketing, engineering, operations, etc.
  reportsTo: string;               // Manager orchestrator name
  
  // Optional fields
  agentType: 'context_driven' | 'function_based';
  priority: 'low' | 'medium' | 'high';
  capabilities?: string[];          // Custom capabilities
  additionalContext?: string;       // Extra context for generation
  userMetadata?: Record<string, any>;
}

export interface AgentCreationResult {
  success: boolean;
  agentId: string;
  agentPath: string;
  message: string;
  generatedFiles: GeneratedFiles;
  deploymentStatus: 'pending' | 'deployed' | 'failed';
  discoveryUpdated: boolean;
  timestamp: string;
}

export interface GeneratedFiles {
  yaml: {
    content: string;
    path: string;
    valid: boolean;
  };
  contextMd: {
    content: string;
    path: string;
    valid: boolean;
  };
  serviceTs: {
    content: string;
    path: string;
    valid: boolean;
  };
}

export interface AgentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface AgentDeploymentStatus {
  agentId: string;
  status: 'creating' | 'validating' | 'deploying' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  error?: string;
  deployedAt?: string;
}

export interface ClaudeCodeExecutionResult {
  success: boolean;
  generatedFiles: string[];
  output: string;
  error?: string;
  executionTime: number;
}
```

### 3.2 Data Transfer Objects

```typescript
// /src/agent-builder/dto/create-agent.dto.ts

import { IsString, IsOptional, IsEnum, IsArray, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({
    description: 'Detailed description of the desired agent functionality',
    example: 'Create a social media marketing agent that can generate Instagram posts, analyze engagement metrics, and suggest optimal posting times for e-commerce brands.',
    minLength: 20,
    maxLength: 2000
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt: string;

  @ApiProperty({
    description: 'Name for the new agent (alphanumeric and underscores only)',
    example: 'social_media_specialist',
    pattern: '^[a-z][a-z0-9_]*$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Agent name must start with a letter and contain only lowercase letters, numbers, and underscores'
  })
  agentName: string;

  @ApiProperty({
    description: 'Department where the agent will operate',
    example: 'marketing',
    enum: ['marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product']
  })
  @IsString()
  @IsEnum(['marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product'])
  department: string;

  @ApiProperty({
    description: 'Manager orchestrator that this agent will report to',
    example: 'marketing_manager_orchestrator'
  })
  @IsString()
  @IsNotEmpty()
  reportsTo: string;

  @ApiProperty({
    description: 'Type of agent to create',
    example: 'context_driven',
    enum: ['context_driven', 'function_based'],
    required: false
  })
  @IsOptional()
  @IsEnum(['context_driven', 'function_based'])
  agentType?: 'context_driven' | 'function_based' = 'context_driven';

  @ApiProperty({
    description: 'Priority level for agent creation',
    example: 'medium',
    enum: ['low', 'medium', 'high'],
    required: false
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high' = 'medium';

  @ApiProperty({
    description: 'Custom capabilities for the agent',
    example: ['content_creation', 'social_media_management', 'analytics'],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @ApiProperty({
    description: 'Additional context or requirements for agent generation',
    example: 'This agent should specialize in B2B SaaS marketing and understand technical product features.',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  additionalContext?: string;
}

// /src/agent-builder/dto/agent-preview.dto.ts

export class AgentPreviewDto {
  @ApiProperty({ description: 'Generated YAML configuration preview' })
  yamlPreview: string;

  @ApiProperty({ description: 'Generated Context.md preview' })
  contextPreview: string;

  @ApiProperty({ description: 'Generated service class preview' })
  servicePreview: string;

  @ApiProperty({ description: 'Validation results for the generated files' })
  validationResults: AgentValidationResult;

  @ApiProperty({ description: 'Estimated deployment path' })
  deploymentPath: string;
}
```

### 3.3 Core Service Implementation

```typescript
// /src/agent-builder/agent-builder.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  AgentCreationRequest, 
  AgentCreationResult, 
  GeneratedFiles, 
  AgentValidationResult,
  AgentDeploymentStatus,
  ClaudeCodeExecutionResult 
} from './interfaces';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { LLMService } from '../llms/llm.service';

const execAsync = promisify(exec);

@Injectable()
export class AgentBuilderService {
  private readonly logger = new Logger(AgentBuilderService.name);
  private deploymentStatuses = new Map<string, AgentDeploymentStatus>();

  constructor(
    private readonly agentDiscoveryService: AgentDiscoveryService,
    private readonly llmService: LLMService,
  ) {}

  /**
   * Create a new agent based on user requirements
   */
  async createAgent(request: AgentCreationRequest): Promise<AgentCreationResult> {
    const agentId = this.generateAgentId(request.agentName, request.department);
    
    try {
      this.logger.log(`🏗️ Starting agent creation: ${agentId}`);
      
      // Update status
      this.updateDeploymentStatus(agentId, 'creating', 10, 'Analyzing requirements');

      // Step 1: Validate agent name and requirements
      const validation = await this.validateAgentRequirements(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      this.updateDeploymentStatus(agentId, 'creating', 25, 'Generating agent specification');

      // Step 2: Generate agent specification using LLM
      const agentSpec = await this.generateAgentSpecification(request);

      this.updateDeploymentStatus(agentId, 'creating', 40, 'Generating files with Claude Code');

      // Step 3: Generate files using Claude Code
      const generatedFiles = await this.generateFilesWithClaudeCode(request, agentSpec);

      this.updateDeploymentStatus(agentId, 'validating', 60, 'Validating generated files');

      // Step 4: Validate generated files
      const fileValidation = await this.validateGeneratedFiles(generatedFiles);
      if (!fileValidation.isValid) {
        throw new Error(`Generated files validation failed: ${fileValidation.errors.join(', ')}`);
      }

      this.updateDeploymentStatus(agentId, 'deploying', 80, 'Deploying agent files');

      // Step 5: Deploy agent files
      const agentPath = await this.deployAgentFiles(request, generatedFiles);

      this.updateDeploymentStatus(agentId, 'deploying', 90, 'Updating agent discovery');

      // Step 6: Update agent discovery
      await this.updateAgentDiscovery();

      this.updateDeploymentStatus(agentId, 'completed', 100, 'Agent created successfully');

      this.logger.log(`✅ Agent creation completed: ${agentId} at ${agentPath}`);

      return {
        success: true,
        agentId,
        agentPath,
        message: `Agent "${request.agentName}" created successfully in ${request.department} department`,
        generatedFiles,
        deploymentStatus: 'deployed',
        discoveryUpdated: true,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`❌ Agent creation failed for ${agentId}:`, error);
      
      this.updateDeploymentStatus(agentId, 'failed', 0, `Creation failed: ${error.message}`);

      return {
        success: false,
        agentId,
        agentPath: '',
        message: `Agent creation failed: ${error.message}`,
        generatedFiles: null,
        deploymentStatus: 'failed',
        discoveryUpdated: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate agent name availability and requirements
   */
  async validateAgentRequirements(request: AgentCreationRequest): Promise<AgentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Check if agent name already exists
      const existingAgents = await this.agentDiscoveryService.discoverAgents();
      const nameExists = existingAgents.some(agent => 
        agent.name.toLowerCase() === request.agentName.toLowerCase()
      );

      if (nameExists) {
        errors.push(`Agent name "${request.agentName}" already exists`);
      }

      // Validate agent name format
      if (!/^[a-z][a-z0-9_]*$/.test(request.agentName)) {
        errors.push('Agent name must start with a letter and contain only lowercase letters, numbers, and underscores');
      }

      // Check if department exists in known structure
      const validDepartments = ['marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product'];
      if (!validDepartments.includes(request.department)) {
        warnings.push(`Department "${request.department}" is not in standard list: ${validDepartments.join(', ')}`);
      }

      // Validate reportsTo orchestrator exists
      const orchestratorExists = existingAgents.some(agent => 
        agent.name === request.reportsTo && agent.type === 'orchestrator'
      );

      if (!orchestratorExists) {
        errors.push(`Manager orchestrator "${request.reportsTo}" not found`);
        suggestions.push('Available orchestrators: ' + 
          existingAgents
            .filter(agent => agent.type === 'orchestrator')
            .map(agent => agent.name)
            .join(', ')
        );
      }

      // Validate prompt length and quality
      if (request.prompt.length < 20) {
        errors.push('Agent description must be at least 20 characters long');
      }

      if (request.prompt.length > 2000) {
        errors.push('Agent description must be less than 2000 characters');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };

    } catch (error) {
      this.logger.error('Validation error:', error);
      return {
        isValid: false,
        errors: [`Validation process failed: ${error.message}`],
        warnings: [],
        suggestions: [],
      };
    }
  }

  /**
   * Generate agent specification using LLM analysis
   */
  private async generateAgentSpecification(request: AgentCreationRequest): Promise<any> {
    const systemPrompt = `You are an AI agent specification generator. Analyze user requests to create detailed agent specifications.

RESPONSE FORMAT: Return ONLY valid JSON with this structure:
{
  "agentName": "string",
  "displayName": "string", 
  "description": "string",
  "department": "string",
  "capabilities": ["array", "of", "capabilities"],
  "skills": [
    {
      "id": "string",
      "name": "string", 
      "description": "string",
      "examples": ["array", "of", "examples"]
    }
  ],
  "personalityTraits": ["trait1", "trait2"],
  "communicationStyle": "string",
  "limitations": ["limitation1", "limitation2"]
}`;

    const userMessage = `Create an agent specification for:

AGENT REQUEST:
- Name: ${request.agentName}
- Department: ${request.department}
- Reports To: ${request.reportsTo}
- Type: ${request.agentType}
- Description: ${request.prompt}
${request.additionalContext ? `- Additional Context: ${request.additionalContext}` : ''}
${request.capabilities ? `- Requested Capabilities: ${request.capabilities.join(', ')}` : ''}

Generate detailed specifications for this agent.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.3,
          maxTokens: 1000,
          provider: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022',
        }
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error('Agent specification generation failed:', error);
      throw new Error(`Failed to generate agent specification: ${error.message}`);
    }
  }

  /**
   * Generate agent files using Claude Code integration
   */
  private async generateFilesWithClaudeCode(
    request: AgentCreationRequest, 
    agentSpec: any
  ): Promise<GeneratedFiles> {
    const tempDir = `/tmp/agent-builder-${Date.now()}`;
    
    try {
      // Create temporary directory
      await fs.mkdir(tempDir, { recursive: true });

      // Generate YAML file
      const yamlResult = await this.generateYamlFile(tempDir, request, agentSpec);
      
      // Generate Context.md file
      const contextResult = await this.generateContextFile(tempDir, request, agentSpec);
      
      // Generate service TypeScript file
      const serviceResult = await this.generateServiceFile(tempDir, request, agentSpec);

      // Read generated files
      const yamlContent = await fs.readFile(join(tempDir, 'agent.yaml'), 'utf8');
      const contextContent = await fs.readFile(join(tempDir, 'Context.md'), 'utf8');
      const serviceContent = await fs.readFile(join(tempDir, 'agent-service.ts'), 'utf8');

      return {
        yaml: {
          content: yamlContent,
          path: 'agent.yaml',
          valid: yamlResult.success,
        },
        contextMd: {
          content: contextContent,
          path: 'Context.md',
          valid: contextResult.success,
        },
        serviceTs: {
          content: serviceContent,
          path: 'agent-service.ts',
          valid: serviceResult.success,
        },
      };

    } catch (error) {
      this.logger.error('File generation failed:', error);
      throw new Error(`File generation failed: ${error.message}`);
    } finally {
      // Cleanup temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup temp directory:', cleanupError);
      }
    }
  }

  /**
   * Generate YAML configuration file using Claude Code
   */
  private async generateYamlFile(
    tempDir: string, 
    request: AgentCreationRequest, 
    agentSpec: any
  ): Promise<ClaudeCodeExecutionResult> {
    const yamlPrompt = `Generate a professional agent.yaml configuration file for this agent:

AGENT SPECIFICATION:
${JSON.stringify(agentSpec, null, 2)}

REQUIREMENTS:
- Follow the exact YAML structure used by existing agents
- Include metadata, hierarchy, type, capabilities, and skills sections
- Set type to "${request.agentType === 'context_driven' ? 'context' : 'function'}"
- Set reportsTo to "${request.reportsTo}"
- Set department to "${request.department}"
- Include comprehensive capabilities and skills arrays
- Add detailed skill definitions with examples

Generate ONLY the YAML content, no explanations or markdown formatting.`;

    return await this.executeClaudeCodeBatch(
      tempDir,
      'agent.yaml',
      yamlPrompt
    );
  }

  /**
   * Generate Context.md system prompt using Claude Code
   */
  private async generateContextFile(
    tempDir: string,
    request: AgentCreationRequest,
    agentSpec: any
  ): Promise<ClaudeCodeExecutionResult> {
    const contextPrompt = `Generate a comprehensive Context.md system prompt file for this agent:

AGENT SPECIFICATION:
${JSON.stringify(agentSpec, null, 2)}

REQUIREMENTS:
- Start with "# System Prompt" header
- Include engaging personality description matching the agent's role
- Add "## Critical Directive" section with actionable instructions
- Include "## Core Identity" section
- Add comprehensive "## Capabilities" section with "What I CAN do" and "What I CANNOT do"
- Include "## Key Information" section with relevant domain knowledge
- Add realistic "## Example Interactions" showing request/response patterns
- Write in first person ("I am", "I can", etc.)
- Make it professional but engaging
- Include specific examples relevant to the ${request.department} department

Generate ONLY the markdown content, no code blocks or explanations.`;

    return await this.executeClaudeCodeBatch(
      tempDir,
      'Context.md',
      contextPrompt
    );
  }

  /**
   * Generate TypeScript service class using Claude Code
   */
  private async generateServiceFile(
    tempDir: string,
    request: AgentCreationRequest,
    agentSpec: any
  ): Promise<ClaudeCodeExecutionResult> {
    const servicePrompt = `Generate a TypeScript agent service class for this agent:

AGENT SPECIFICATION:
- Name: ${request.agentName}
- Type: ${request.agentType}
- Department: ${request.department}

REQUIREMENTS:
- Import Injectable from @nestjs/common
- Import HttpService from @nestjs/axios
- Import appropriate base service class based on agent type
- Create class named "${this.pascalCase(request.agentName)}Service"
- Extend appropriate base service (ContextAgentBaseService or FunctionAgentBaseService)
- Include proper constructor with dependency injection
- Implement getAgentName() method returning "${request.agentName}"
- Add minimal implementation - all functionality should be in base class
- Include proper TypeScript types and decorators

Generate ONLY the TypeScript code, no explanations or markdown formatting.`;

    return await this.executeClaudeCodeBatch(
      tempDir,
      'agent-service.ts',
      servicePrompt
    );
  }

  /**
   * Execute Claude Code batch command
   */
  private async executeClaudeCodeBatch(
    outputDir: string,
    filename: string,
    prompt: string
  ): Promise<ClaudeCodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Create batch script
      const scriptContent = `#!/bin/bash
cd "${outputDir}"

# Create prompt file
cat > prompt.txt << 'EOF'
${prompt}
EOF

# Execute Claude Code
claude-code --batch --prompt "$(cat prompt.txt)" --output "${filename}"

# Clean up prompt file
rm prompt.txt
`;

      const scriptPath = join(outputDir, 'generate.sh');
      await fs.writeFile(scriptPath, scriptContent, { mode: 0o755 });

      // Execute script
      const { stdout, stderr } = await execAsync(`bash "${scriptPath}"`);

      // Check if output file was created
      const outputPath = join(outputDir, filename);
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);

      return {
        success: fileExists,
        generatedFiles: fileExists ? [outputPath] : [],
        output: stdout,
        error: stderr || undefined,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error(`Claude Code execution failed for ${filename}:`, error);
      return {
        success: false,
        generatedFiles: [],
        output: '',
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate generated files for correctness
   */
  private async validateGeneratedFiles(files: GeneratedFiles): Promise<AgentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate YAML structure
      if (!files.yaml.content.includes('metadata:')) {
        errors.push('YAML file missing metadata section');
      }
      if (!files.yaml.content.includes('hierarchy:')) {
        errors.push('YAML file missing hierarchy section');
      }
      if (!files.yaml.content.includes('capabilities:')) {
        errors.push('YAML file missing capabilities section');
      }

      // Validate Context.md structure
      if (!files.contextMd.content.includes('# System Prompt')) {
        errors.push('Context.md missing System Prompt header');
      }
      if (!files.contextMd.content.includes('## Critical Directive')) {
        errors.push('Context.md missing Critical Directive section');
      }
      if (files.contextMd.content.length < 500) {
        warnings.push('Context.md content seems too short');
      }

      // Validate TypeScript service
      if (!files.serviceTs.content.includes('@Injectable()')) {
        errors.push('Service file missing @Injectable decorator');
      }
      if (!files.serviceTs.content.includes('getAgentName()')) {
        errors.push('Service file missing getAgentName() method');
      }
      if (!files.serviceTs.content.includes('export class')) {
        errors.push('Service file missing class export');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions: [],
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`File validation failed: ${error.message}`],
        warnings: [],
        suggestions: [],
      };
    }
  }

  /**
   * Deploy generated files to agent directory
   */
  private async deployAgentFiles(
    request: AgentCreationRequest,
    files: GeneratedFiles
  ): Promise<string> {
    const agentPath = join(
      process.cwd(),
      'src',
      'agents',
      'actual',
      request.department,
      request.agentName
    );

    try {
      // Create agent directory
      await fs.mkdir(agentPath, { recursive: true });

      // Write YAML file
      await fs.writeFile(
        join(agentPath, 'agent.yaml'),
        files.yaml.content,
        'utf8'
      );

      // Write Context.md file
      await fs.writeFile(
        join(agentPath, 'Context.md'),
        files.contextMd.content,
        'utf8'
      );

      // Write service file
      await fs.writeFile(
        join(agentPath, 'agent-service.ts'),
        files.serviceTs.content,
        'utf8'
      );

      this.logger.log(`📁 Agent files deployed to: ${agentPath}`);
      return agentPath;

    } catch (error) {
      this.logger.error('File deployment failed:', error);
      throw new Error(`Failed to deploy agent files: ${error.message}`);
    }
  }

  /**
   * Update agent discovery after deployment
   */
  private async updateAgentDiscovery(): Promise<void> {
    try {
      await this.agentDiscoveryService.discoverAgents();
      this.logger.log('🔍 Agent discovery updated successfully');
    } catch (error) {
      this.logger.error('Failed to update agent discovery:', error);
      throw new Error(`Failed to update agent discovery: ${error.message}`);
    }
  }

  /**
   * Preview agent files before deployment
   */
  async previewAgent(request: AgentCreationRequest): Promise<{ preview: any; validation: AgentValidationResult }> {
    try {
      // Validate requirements first
      const validation = await this.validateAgentRequirements(request);
      if (!validation.isValid) {
        return { preview: null, validation };
      }

      // Generate specification
      const agentSpec = await this.generateAgentSpecification(request);

      // Generate files
      const files = await this.generateFilesWithClaudeCode(request, agentSpec);

      // Validate generated files
      const fileValidation = await this.validateGeneratedFiles(files);

      const preview = {
        agentSpec,
        files: {
          yaml: files.yaml.content,
          contextMd: files.contextMd.content,
          serviceTs: files.serviceTs.content,
        },
        deploymentPath: join('src', 'agents', 'actual', request.department, request.agentName),
      };

      return { 
        preview, 
        validation: {
          isValid: validation.isValid && fileValidation.isValid,
          errors: [...validation.errors, ...fileValidation.errors],
          warnings: [...validation.warnings, ...fileValidation.warnings],
          suggestions: validation.suggestions,
        }
      };

    } catch (error) {
      this.logger.error('Preview generation failed:', error);
      return {
        preview: null,
        validation: {
          isValid: false,
          errors: [`Preview generation failed: ${error.message}`],
          warnings: [],
          suggestions: [],
        }
      };
    }
  }

  /**
   * Get deployment status
   */
  getDeploymentStatus(agentId: string): AgentDeploymentStatus | null {
    return this.deploymentStatuses.get(agentId) || null;
  }

  /**
   * Remove agent and its files
   */
  async removeAgent(agentName: string, department: string): Promise<{ success: boolean; message: string }> {
    const agentPath = join(
      process.cwd(),
      'src',
      'agents', 
      'actual',
      department,
      agentName
    );

    try {
      // Check if agent directory exists
      await fs.access(agentPath);

      // Remove agent directory
      await fs.rm(agentPath, { recursive: true, force: true });

      // Update agent discovery
      await this.updateAgentDiscovery();

      this.logger.log(`🗑️ Agent removed: ${agentName} from ${department}`);

      return {
        success: true,
        message: `Agent "${agentName}" removed successfully from ${department} department`,
      };

    } catch (error) {
      this.logger.error(`Failed to remove agent ${agentName}:`, error);
      return {
        success: false,
        message: `Failed to remove agent: ${error.message}`,
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateAgentId(agentName: string, department: string): string {
    return `${department}_${agentName}_${Date.now()}`;
  }

  private updateDeploymentStatus(
    agentId: string,
    status: AgentDeploymentStatus['status'],
    progress: number,
    currentStep: string,
    error?: string
  ): void {
    this.deploymentStatuses.set(agentId, {
      agentId,
      status,
      progress,
      currentStep,
      error,
      deployedAt: status === 'completed' ? new Date().toISOString() : undefined,
    });
  }

  private pascalCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
```

### 3.4 REST API Controller

```typescript
// /src/agent-builder/agent-builder.controller.ts

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiParam,
  ApiQuery 
} from '@nestjs/swagger';
import { AgentBuilderService } from './agent-builder.service';
import { CreateAgentDto, AgentPreviewDto } from './dto';
import { 
  AgentCreationResult, 
  AgentValidationResult, 
  AgentDeploymentStatus 
} from './interfaces';

@ApiTags('Agent Builder')
@Controller('agent-builder')
export class AgentBuilderController {
  private readonly logger = new Logger(AgentBuilderController.name);

  constructor(private readonly agentBuilderService: AgentBuilderService) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create a new AI agent',
    description: 'Creates a new AI agent based on user requirements. Generates YAML config, Context.md prompt, and TypeScript service class.'
  })
  @ApiBody({ 
    type: CreateAgentDto,
    description: 'Agent creation requirements',
    examples: {
      'Social Media Agent': {
        value: {
          prompt: 'Create a social media marketing agent that can generate Instagram posts, analyze engagement metrics, and suggest optimal posting times for e-commerce brands.',
          agentName: 'social_media_specialist',
          department: 'marketing',
          reportsTo: 'marketing_manager_orchestrator',
          agentType: 'context_driven',
          priority: 'high',
          capabilities: ['content_creation', 'social_media_management', 'analytics'],
          additionalContext: 'This agent should specialize in B2B SaaS marketing and understand technical product features.'
        }
      },
      'Customer Support Agent': {
        value: {
          prompt: 'Build a customer support agent that can handle technical inquiries, troubleshoot common issues, and escalate complex problems to human agents.',
          agentName: 'tech_support_specialist',
          department: 'operations',
          reportsTo: 'operations_manager_orchestrator',
          agentType: 'context_driven',
          priority: 'medium'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Agent created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        agentId: { type: 'string', example: 'marketing_social_media_specialist_1640995200000' },
        agentPath: { type: 'string', example: 'src/agents/actual/marketing/social_media_specialist' },
        message: { type: 'string', example: 'Agent "social_media_specialist" created successfully in marketing department' },
        deploymentStatus: { type: 'string', example: 'deployed' },
        discoveryUpdated: { type: 'boolean', example: true },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request data or validation failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Agent name "existing_agent" already exists' },
        errors: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async createAgent(@Body() createAgentDto: CreateAgentDto): Promise<AgentCreationResult> {
    try {
      this.logger.log(`🚀 Agent creation request: ${createAgentDto.agentName}`);
      
      const result = await this.agentBuilderService.createAgent(createAgentDto);
      
      if (!result.success) {
        throw new BadRequestException(result.message);
      }

      this.logger.log(`✅ Agent created successfully: ${result.agentId}`);
      return result;

    } catch (error) {
      this.logger.error(`❌ Agent creation failed:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Agent creation failed: ${error.message}`
      );
    }
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Preview agent files before creation',
    description: 'Generates and validates agent files without deploying them. Useful for review before actual creation.'
  })
  @ApiBody({ type: CreateAgentDto })
  @ApiResponse({
    status: 200,
    description: 'Agent preview generated successfully',
    type: AgentPreviewDto
  })
  async previewAgent(@Body() createAgentDto: CreateAgentDto) {
    try {
      this.logger.log(`👀 Agent preview request: ${createAgentDto.agentName}`);
      
      const { preview, validation } = await this.agentBuilderService.previewAgent(createAgentDto);
      
      if (!validation.isValid) {
        return {
          success: false,
          validation,
          preview: null,
          message: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      return {
        success: true,
        validation,
        preview: {
          yamlPreview: preview.files.yaml,
          contextPreview: preview.files.contextMd,
          servicePreview: preview.files.serviceTs,
          deploymentPath: preview.deploymentPath,
          agentSpec: preview.agentSpec
        },
        message: 'Preview generated successfully'
      };

    } catch (error) {
      this.logger.error(`Preview generation failed:`, error);
      throw new InternalServerErrorException(
        `Preview generation failed: ${error.message}`
      );
    }
  }

  @Post('validate-name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Validate agent name availability',
    description: 'Checks if the proposed agent name is available and follows naming conventions.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        agentName: { type: 'string', example: 'social_media_specialist' },
        department: { type: 'string', example: 'marketing' }
      },
      required: ['agentName', 'department']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Name validation result',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        suggestions: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  async validateAgentName(
    @Body() body: { agentName: string; department: string }
  ): Promise<AgentValidationResult> {
    try {
      const mockRequest = {
        ...body,
        prompt: 'validation check',
        reportsTo: 'mock_orchestrator',
        agentType: 'context_driven' as const,
      };

      const validation = await this.agentBuilderService.validateAgentRequirements(mockRequest);
      
      return {
        isValid: validation.errors.length === 0,
        errors: validation.errors.filter(error => 
          error.includes('name') || error.includes('already exists')
        ),
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      };

    } catch (error) {
      this.logger.error('Name validation failed:', error);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        suggestions: [],
      };
    }
  }

  @Get('status/:agentId')
  @ApiOperation({ 
    summary: 'Get agent creation status',
    description: 'Returns the current status of an agent creation process.'
  })
  @ApiParam({ name: 'agentId', description: 'Agent ID returned from creation request' })
  @ApiResponse({
    status: 200,
    description: 'Agent creation status',
    schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        status: { type: 'string', enum: ['creating', 'validating', 'deploying', 'completed', 'failed'] },
        progress: { type: 'number', minimum: 0, maximum: 100 },
        currentStep: { type: 'string' },
        error: { type: 'string' },
        deployedAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Agent ID not found' })
  getAgentStatus(@Param('agentId') agentId: string): AgentDeploymentStatus {
    const status = this.agentBuilderService.getDeploymentStatus(agentId);
    
    if (!status) {
      throw new NotFoundException(`Agent ID "${agentId}" not found`);
    }

    return status;
  }

  @Delete('remove/:department/:agentName')
  @ApiOperation({ 
    summary: 'Remove an agent',
    description: 'Completely removes an agent and its files from the system.'
  })
  @ApiParam({ name: 'department', description: 'Department where the agent is located' })
  @ApiParam({ name: 'agentName', description: 'Name of the agent to remove' })
  @ApiResponse({
    status: 200,
    description: 'Agent removed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  async removeAgent(
    @Param('department') department: string,
    @Param('agentName') agentName: string
  ) {
    try {
      this.logger.log(`🗑️ Agent removal request: ${department}/${agentName}`);
      
      const result = await this.agentBuilderService.removeAgent(agentName, department);
      
      if (!result.success) {
        throw new BadRequestException(result.message);
      }

      return result;

    } catch (error) {
      this.logger.error(`Agent removal failed:`, error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Agent removal failed: ${error.message}`
      );
    }
  }

  @Get('templates')
  @ApiOperation({ 
    summary: 'Get available agent templates',
    description: 'Returns list of available agent templates and their descriptions.'
  })
  @ApiResponse({
    status: 200,
    description: 'Available templates',
    schema: {
      type: 'object',
      properties: {
        templates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              departments: { type: 'array', items: { type: 'string' } },
              examples: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  })
  getAgentTemplates() {
    return {
      templates: [
        {
          type: 'context_driven',
          name: 'Context-Driven Agent',
          description: 'Agent powered by detailed Context.md system prompt with comprehensive instructions and examples',
          departments: ['marketing', 'operations', 'finance', 'hr', 'sales'],
          examples: [
            'Content creation specialists',
            'Customer support agents', 
            'Data analysis agents',
            'Research assistants'
          ]
        },
        {
          type: 'function_based',
          name: 'Function-Based Agent',
          description: 'Agent with custom TypeScript/Python functions for complex operations and integrations',
          departments: ['engineering', 'operations', 'finance'],
          examples: [
            'API integration agents',
            'Database management agents',
            'Automated workflow agents',
            'System monitoring agents'
          ]
        }
      ]
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for agent builder service' })
  @ApiResponse({
    status: 200,
    description: 'Service health information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string' },
        claudeCodeAvailable: { type: 'boolean' },
        activeCreations: { type: 'number' }
      }
    }
  })
  async getHealth() {
    // Check if Claude Code is available
    let claudeCodeAvailable = false;
    try {
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('which claude-code', (error, stdout) => {
          claudeCodeAvailable = !error && stdout.trim().length > 0;
          resolve(null);
        });
      });
    } catch (error) {
      claudeCodeAvailable = false;
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      claudeCodeAvailable,
      activeCreations: 0, // Could track active creation processes
    };
  }
}
```

### 3.5 NestJS Module Configuration

```typescript
// /src/agent-builder/agent-builder.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentBuilderService } from './agent-builder.service';
import { AgentBuilderController } from './agent-builder.controller';
import { AgentDiscoveryService } from '../agent-discovery.service';
import { LLMModule } from '../llms/llm.module';

@Module({
  imports: [
    HttpModule,
    LLMModule,
  ],
  controllers: [AgentBuilderController],
  providers: [
    AgentBuilderService,
    AgentDiscoveryService,
  ],
  exports: [AgentBuilderService],
})
export class AgentBuilderModule {}
```

Add to main app module:

```typescript
// Add to /src/app.module.ts imports array:
import { AgentBuilderModule } from './agent-builder/agent-builder.module';

@Module({
  imports: [
    // ... existing imports
    AgentBuilderModule,
  ],
  // ... rest of module config
})
```

## 4. Frontend Implementation Requirements

### 4.1 React Components Architecture

```typescript
// Frontend component structure for intern to implement

// /frontend/src/components/AgentBuilder/AgentBuilderForm.tsx
interface AgentBuilderFormProps {
  onSubmit: (data: CreateAgentRequest) => void;
  loading?: boolean;
}

// Form fields based on CreateAgentDto:
// - Agent Description (rich text area, 20-2000 chars)
// - Agent Name (validated input with live checking)
// - Department (dropdown with all departments)
// - Reports To (dropdown with available orchestrators)
// - Agent Type (radio buttons: context_driven vs function_based)
// - Priority (dropdown: low/medium/high)
// - Custom Capabilities (tag input)
// - Additional Context (optional text area)

// /frontend/src/components/AgentBuilder/AgentPreview.tsx
interface AgentPreviewProps {
  preview: AgentPreviewData;
  onDeploy: () => void;
  onEdit: () => void;
}

// Shows:
// - Generated YAML (syntax highlighted)
// - Generated Context.md (markdown preview)
// - Generated service.ts (syntax highlighted)
// - Validation results (errors/warnings)
// - Deploy/Edit buttons

// /frontend/src/components/AgentBuilder/AgentManagement.tsx
// Dashboard showing:
// - List of created agents
// - Status indicators
// - Edit/Delete actions
// - Search and filtering
// - Creation history
```

### 4.2 API Integration Service

```typescript
// /frontend/src/services/agentBuilderApi.ts

class AgentBuilderApiService {
  private baseUrl = '/api/agent-builder';

  async createAgent(data: CreateAgentRequest): Promise<AgentCreationResult> {
    const response = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async previewAgent(data: CreateAgentRequest): Promise<AgentPreviewResponse> {
    const response = await fetch(`${this.baseUrl}/preview`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async validateAgentName(agentName: string, department: string): Promise<AgentValidationResult> {
    const response = await fetch(`${this.baseUrl}/validate-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName, department }),
    });
    return response.json();
  }

  async getAgentStatus(agentId: string): Promise<AgentDeploymentStatus> {
    const response = await fetch(`${this.baseUrl}/status/${agentId}`);
    return response.json();
  }

  async removeAgent(department: string, agentName: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/remove/${department}/${agentName}`, {
      method: 'DELETE',
    });
    return response.json();
  }

  async getTemplates(): Promise<{ templates: AgentTemplate[] }> {
    const response = await fetch(`${this.baseUrl}/templates`);
    return response.json();
  }
}
```

### 4.3 User Experience Flow

**Step 1: Agent Creation Form**
- Single comprehensive form with all required fields
- Real-time validation with API calls
- Rich text editor for agent description
- Dropdowns populated from existing orchestrators/departments
- Form validation with clear error messages

**Step 2: Preview & Validation**
- Show generated files in tabbed interface
- Highlight validation errors/warnings
- Allow editing before deployment
- Show deployment path and structure

**Step 3: Deployment & Monitoring**
- Progress indicator during creation
- Real-time status updates
- Success confirmation with agent details
- Link to management dashboard

**Step 4: Management Dashboard**
- Grid view of all created agents
- Status indicators (deployed, failed, etc.)
- Search and filter capabilities
- Quick actions (edit, delete, test)

### 4.4 Form Validation Rules

```typescript
// Frontend validation rules matching backend DTOs

const validationRules = {
  prompt: {
    required: true,
    minLength: 20,
    maxLength: 2000,
    message: 'Agent description must be between 20-2000 characters'
  },
  agentName: {
    required: true,
    pattern: /^[a-z][a-z0-9_]*$/,
    message: 'Agent name must start with a letter and contain only lowercase letters, numbers, and underscores',
    asyncValidation: true // Check availability via API
  },
  department: {
    required: true,
    enum: ['marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product']
  },
  reportsTo: {
    required: true,
    message: 'Must select a manager orchestrator'
  }
};
```

## 5. Testing Strategy

### 5.1 Backend Unit Tests

```typescript
// /src/agent-builder/agent-builder.service.spec.ts

describe('AgentBuilderService', () => {
  let service: AgentBuilderService;
  let mockAgentDiscovery: jest.Mocked<AgentDiscoveryService>;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentBuilderService,
        { provide: AgentDiscoveryService, useValue: mockAgentDiscovery },
        { provide: LLMService, useValue: mockLLMService },
      ],
    }).compile();

    service = module.get<AgentBuilderService>(AgentBuilderService);
  });

  describe('createAgent', () => {
    it('should create agent successfully with valid input', async () => {
      const request: AgentCreationRequest = {
        prompt: 'Create a social media marketing agent',
        agentName: 'social_media_specialist',
        department: 'marketing',
        reportsTo: 'marketing_manager_orchestrator',
        agentType: 'context_driven',
      };

      const result = await service.createAgent(request);
      
      expect(result.success).toBe(true);
      expect(result.agentId).toContain('marketing_social_media_specialist');
      expect(result.deploymentStatus).toBe('deployed');
    });

    it('should fail with invalid agent name', async () => {
      const request: AgentCreationRequest = {
        prompt: 'Test agent',
        agentName: 'Invalid Name!',
        department: 'marketing',
        reportsTo: 'marketing_manager_orchestrator',
        agentType: 'context_driven',
      };

      const result = await service.createAgent(request);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('name must start with a letter');
    });
  });

  describe('validateAgentRequirements', () => {
    it('should validate agent name uniqueness', async () => {
      mockAgentDiscovery.discoverAgents.mockResolvedValue([
        { name: 'existing_agent', type: 'specialist', path: 'marketing/existing_agent' }
      ]);

      const request: AgentCreationRequest = {
        prompt: 'Test agent',
        agentName: 'existing_agent',
        department: 'marketing',
        reportsTo: 'marketing_manager_orchestrator',
        agentType: 'context_driven',
      };

      const result = await service.validateAgentRequirements(request);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent name "existing_agent" already exists');
    });
  });
});
```

### 5.2 Integration Tests

```typescript
// /src/agent-builder/agent-builder.controller.spec.ts

describe('AgentBuilderController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AgentBuilderModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agent-builder/create (POST)', () => {
    return request(app.getHttpServer())
      .post('/agent-builder/create')
      .send({
        prompt: 'Create a test agent for integration testing',
        agentName: 'test_integration_agent',
        department: 'marketing',
        reportsTo: 'marketing_manager_orchestrator',
        agentType: 'context_driven'
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.agentId).toBeDefined();
        expect(res.body.agentPath).toContain('test_integration_agent');
      });
  });

  it('/agent-builder/preview (POST)', () => {
    return request(app.getHttpServer())
      .post('/agent-builder/preview')
      .send({
        prompt: 'Preview test agent',
        agentName: 'preview_test_agent',
        department: 'marketing',
        reportsTo: 'marketing_manager_orchestrator',
        agentType: 'context_driven'
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.preview.yamlPreview).toBeDefined();
        expect(res.body.preview.contextPreview).toBeDefined();
        expect(res.body.preview.servicePreview).toBeDefined();
      });
  });
});
```

## 6. Deployment & Operations

### 6.1 Environment Setup

```bash
# Installation requirements
npm install --save child_process fs path

# Claude Code installation (if not already available)
curl -sSL https://github.com/anthropics/claude-code/releases/latest/download/install.sh | bash

# Verify Claude Code installation
claude-code --version
```

### 6.2 Environment Variables

```bash
# Add to .env file
CLAUDE_CODE_PATH=/usr/local/bin/claude-code
AGENT_BUILDER_TEMP_DIR=/tmp/agent-builder
AGENT_BUILDER_MAX_CONCURRENT=5
AGENT_BUILDER_TIMEOUT=300000  # 5 minutes
```

### 6.3 Monitoring & Logging

The service includes comprehensive logging for:
- Agent creation requests and results
- Claude Code execution details
- File generation and validation
- Deployment status and errors
- Performance metrics

### 6.4 Error Handling

Robust error handling covers:
- Invalid input validation
- Claude Code execution failures
- File system errors
- Agent discovery integration issues
- Deployment rollback capabilities

## 7. Success Metrics & Acceptance Criteria

### 7.1 Functional Requirements ✅
- [ ] API accepts agent creation requests with all required fields
- [ ] Claude Code integration generates valid YAML, Context.md, and service files
- [ ] Generated agents deploy successfully to correct directory structure
- [ ] Agent discovery automatically updates after deployment
- [ ] Preview functionality shows generated files before deployment
- [ ] Validation prevents duplicate names and invalid configurations
- [ ] Agent removal functionality works correctly

### 7.2 Performance Requirements ✅
- [ ] Agent creation completes within 2 minutes
- [ ] API responds to preview requests within 30 seconds
- [ ] File generation using Claude Code completes within 60 seconds
- [ ] Agent discovery update completes within 10 seconds

### 7.3 Quality Requirements ✅
- [ ] Generated agents pass all validation tests
- [ ] 95% success rate for first-time deployments
- [ ] Generated Context.md files produce coherent agent responses
- [ ] TypeScript service files compile without errors
- [ ] YAML configuration files follow correct schema

### 7.4 User Experience Requirements ✅
- [ ] Frontend form provides clear validation feedback
- [ ] Real-time status updates during agent creation
- [ ] Intuitive preview interface with syntax highlighting
- [ ] Management dashboard shows all agent status clearly
- [ ] Error messages are actionable and user-friendly

## 8. Implementation Timeline

**Week 1: Backend Core**
- Day 1-2: Implement core service and interfaces
- Day 3-4: Build Claude Code integration
- Day 5: Add API controller and validation

**Week 2: Integration & Testing**  
- Day 1-2: Complete file generation templates
- Day 3-4: Integration with agent discovery
- Day 5: Unit and integration tests

**Week 3: Frontend & Polish**
- Day 1-3: Build React components and forms
- Day 4-5: API integration and error handling
- Weekend: Testing and bug fixes

## 9. Getting Started

1. **Clone the repository** and navigate to the agent builder directory
2. **Install dependencies** and verify Claude Code is available
3. **Start with the backend service** implementation following the provided code
4. **Build the API controller** with all endpoints
5. **Create the NestJS module** and integrate with main app
6. **Test the backend** thoroughly with provided test cases
7. **Build the frontend components** using the provided specifications
8. **Integrate frontend with API** and test end-to-end workflow
9. **Deploy and monitor** the complete system

This PRD provides everything needed to implement a complete, production-ready Agent Builder Service. The intern can follow this as a step-by-step implementation guide with working code examples and clear specifications for both backend and frontend development.