import { IsOptional, IsString, MinLength } from 'class-validator';

export class BusinessInfoDto {
  @IsString()
  @MinLength(2)
  businessName!: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  hours?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** P4-05: referral slug from `/register?agency=<slug>`, only applied the
   * very first time the Client row is created (see `saveBusinessInfo`). */
  @IsOptional()
  @IsString()
  agencySlug?: string;
}
