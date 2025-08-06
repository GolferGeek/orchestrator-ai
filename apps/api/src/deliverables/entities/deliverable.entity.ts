import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliverableType, DeliverableFormat } from '../dto';

export class Deliverable {
  @ApiProperty({ description: 'Unique identifier' })
  id!: string;

  @ApiProperty({ description: 'User who owns this deliverable' })
  user_id!: string;

  @ApiPropertyOptional({ description: 'Conversation this deliverable belongs to' })
  conversation_id?: string;

  @ApiPropertyOptional({ description: 'Message that generated this deliverable' })
  message_id?: string;

  @ApiProperty({ description: 'Title of the deliverable' })
  title!: string;

  @ApiProperty({ description: 'Content of the deliverable' })
  content!: string;

  @ApiProperty({ enum: DeliverableType, description: 'Type of deliverable' })
  deliverable_type!: DeliverableType;

  @ApiProperty({ enum: DeliverableFormat, description: 'Format of the content' })
  format!: DeliverableFormat;

  @ApiProperty({ description: 'Version number' })
  version!: number;

  @ApiPropertyOptional({ description: 'Parent deliverable ID for versioning' })
  parent_deliverable_id?: string;

  @ApiProperty({ description: 'Whether this is the latest version' })
  is_latest_version!: boolean;

  @ApiPropertyOptional({ 
    description: 'Additional metadata', 
    type: 'object',
    additionalProperties: true
  })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Tags for organization', type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Agent that created this deliverable' })
  created_by_agent?: string;

  @ApiPropertyOptional({ description: 'Optional description of the deliverable' })
  description?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at!: Date;
}

export class DeliverableVersion {
  @ApiProperty({ description: 'Version identifier' })
  id!: string;

  @ApiProperty({ description: 'Version title' })
  title!: string;

  @ApiProperty({ description: 'Version number' })
  version!: number;

  @ApiProperty({ description: 'Whether this is the latest version' })
  is_latest_version!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at!: Date;

  @ApiPropertyOptional({ description: 'Agent that created this version' })
  created_by_agent?: string;

  @ApiProperty({ description: 'Content preview (first 200 characters)' })
  content_preview!: string;
}

export class DeliverableSearchResult {
  @ApiProperty({ description: 'Deliverable identifier' })
  id!: string;

  @ApiProperty({ description: 'Deliverable title' })
  title!: string;

  @ApiProperty({ enum: DeliverableType, description: 'Type of deliverable' })
  deliverable_type!: DeliverableType;

  @ApiProperty({ enum: DeliverableFormat, description: 'Format of the content' })
  format!: DeliverableFormat;

  @ApiProperty({ description: 'Version number' })
  version!: number;

  @ApiProperty({ description: 'Whether this is the latest version' })
  is_latest_version!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at!: Date;

  @ApiPropertyOptional({ description: 'Agent that created this deliverable' })
  created_by_agent?: string;

  @ApiProperty({ description: 'Content preview (first 200 characters)' })
  content_preview!: string;

  @ApiPropertyOptional({ description: 'Tags for organization', type: [String] })
  tags?: string[];
}