import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateThemeDto } from './create-theme.dto';

export class UpdateThemeDto extends PartialType(CreateThemeDto) {
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
