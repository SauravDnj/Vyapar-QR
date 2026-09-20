import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

import type { SocialPlatform } from '@vyaparqr/types';

export class SocialLinkInputDto {
  @IsIn(['whatsapp', 'instagram', 'facebook', 'linkedin', 'x', 'youtube'])
  platform!: SocialPlatform;

  @IsString()
  value!: string;
}

export class SocialReviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkInputDto)
  socialLinks!: SocialLinkInputDto[];

  @IsOptional()
  @IsString()
  reviewLink?: string;

  @IsOptional()
  @IsString()
  sheetId?: string;

  @IsOptional()
  @IsString()
  sheetRange?: string;

  @IsOptional()
  @IsString()
  googlePlaceId?: string;
}
