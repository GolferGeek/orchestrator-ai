import {
  IsString,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiProperty({ description: 'Title of the new version', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Content of the new version' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for this version',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Name of the agent that created this version',
  })
  @IsOptional()
  @IsString()
  created_by_agent?: string;
}
