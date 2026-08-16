import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SocialLinkInputDto {
  @IsIn(['whatsapp', 'instagram', 'facebook'])
  platform!: 'whatsapp' | 'instagram' | 'facebook';

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
