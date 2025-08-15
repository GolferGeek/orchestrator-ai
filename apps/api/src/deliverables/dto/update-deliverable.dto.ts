import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDeliverableDto } from './create-deliverable.dto';

export class UpdateDeliverableDto extends PartialType(
  OmitType(CreateDeliverableDto, ['conversation_id'] as const),
) {}
