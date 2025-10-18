import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export enum AgentType {
  FUNCTION = 'function',
  CONTEXT = 'context',
  API = 'api',
  ORCHESTRATOR = 'orchestrator',
}

export class CreateAgentDto {
  @ApiProperty({
    description: 'Organization slug (null for global)',
    required: false,
  })
  @IsOptional()
  @IsString()
  organization_slug?: string | null;

  @ApiProperty({
    description: 'Unique agent slug',
    examples: ['blog_post', 'hr_assistant'],
  })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,62}$/)
  slug!: string;

  @ApiProperty({ description: 'Display name', example: 'Blog Post Writer' })
  @IsString()
  display_name!: string;

  @ApiProperty({ enum: AgentType, example: AgentType.FUNCTION })
  @IsEnum(AgentType)
  agent_type!: AgentType;

  @ApiProperty({
    description: 'Mode profile (e.g., draft, active)',
    example: 'draft',
  })
  @IsString()
  mode_profile!: string;

  @ApiProperty({
    description: 'Agent status (draft, active, archived)',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string | null;

  @ApiProperty({
    description: 'YAML definition (JSON string allowed)',
    required: false,
  })
  @IsOptional()
  @IsString()
  yaml?: string;

  @ApiProperty({
    description: 'Function code (JavaScript/TypeScript) for function agents',
    required: false,
  })
  @IsOptional()
  @IsString()
  function_code?: string | null;

  @ApiProperty({
    description: 'Optional long-form description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Agent card metadata', required: false })
  @IsOptional()
  @IsObject()
  agent_card?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Context/Prompt configuration', required: false })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Runtime configuration (type-specific)',
    required: false,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Plan structure template (markdown string or JSON schema)',
    required: false,
  })
  @IsOptional()
  plan_structure?: string | Record<string, unknown> | null;

  @ApiProperty({
    description:
      'Deliverable structure template (markdown string or JSON schema)',
    required: false,
  })
  @IsOptional()
  deliverable_structure?: string | Record<string, unknown> | null;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  mode_profile?: string;

  @IsOptional()
  @IsString()
  yaml?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsObject()
  agent_card?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;
}
