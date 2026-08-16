import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class EventMetaDto {
  @IsOptional()
  @IsString()
  label?: string;
}

export class CaptureEventDto {
  @IsIn(['page_view', 'button_click'])
  eventType!: 'page_view' | 'button_click';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EventMetaDto)
  meta?: EventMetaDto;
}
