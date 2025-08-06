import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliverableType, DeliverableFormat } from './create-deliverable.dto';

export class DeliverableFiltersDto {
  @ApiPropertyOptional({ description: 'Search term for title and content' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DeliverableType, description: 'Filter by deliverable type' })
  @IsOptional()
  @IsEnum(DeliverableType)
  type?: DeliverableType;

  @ApiPropertyOptional({ enum: DeliverableFormat, description: 'Filter by format' })
  @IsOptional()
  @IsEnum(DeliverableFormat)
  format?: DeliverableFormat;

  @ApiPropertyOptional({ description: 'Number of results to return', default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Number of results to skip', default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ 
    description: 'Show only latest versions (true) or all versions (false)', 
    default: true 
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  latest_only?: boolean = true;
}