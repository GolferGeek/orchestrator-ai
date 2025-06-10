import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsNumber, IsDateString, IsObject, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class SessionCreateDto {
  @ApiPropertyOptional({ description: 'Optional name for the session' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID', format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'User ID who owns the session', format: 'uuid' })
  @IsUUID()
  user_id!: string;

  @ApiPropertyOptional({ description: 'Optional name for the session' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Session creation timestamp' })
  @IsDateString()
  created_at!: string;

  @ApiProperty({ description: 'Session last updated timestamp' })
  @IsDateString()
  updated_at!: string;
}

export class SessionListResponseDto {
  @ApiProperty({ description: 'List of sessions', type: [SessionResponseDto] })
  @IsArray()
  @Type(() => SessionResponseDto)
  sessions!: SessionResponseDto[];

  @ApiProperty({ description: 'Total count of sessions' })
  @IsNumber()
  count!: number;
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Message ID', format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ description: 'Session ID', format: 'uuid' })
  @IsUUID()
  session_id!: string;

  @ApiProperty({ description: 'User ID', format: 'uuid' })
  @IsUUID()
  user_id!: string;

  @ApiProperty({ description: 'Message role', enum: MessageRole })
  @IsEnum(MessageRole)
  role!: MessageRole;

  @ApiPropertyOptional({ description: 'Message content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: 'Message timestamp' })
  @IsDateString()
  timestamp!: string;

  @ApiProperty({ description: 'Message order in the session' })
  @IsNumber()
  order!: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class MessageListResponseDto {
  @ApiProperty({ description: 'List of messages', type: [MessageResponseDto] })
  @IsArray()
  @Type(() => MessageResponseDto)
  messages!: MessageResponseDto[];

  @ApiProperty({ description: 'Session ID', format: 'uuid' })
  @IsUUID()
  session_id!: string;

  @ApiProperty({ description: 'Total count of messages in the session' })
  @IsNumber()
  count!: number;

  @ApiProperty({ description: 'Number of messages skipped' })
  @IsNumber()
  skip!: number;

  @ApiProperty({ description: 'Maximum number of messages returned' })
  @IsNumber()
  limit!: number;
} 