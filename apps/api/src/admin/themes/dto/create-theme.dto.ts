import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateThemeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  category!: string;

  @IsOptional()
  @IsString()
  previewImageUrl?: string;

  @IsBoolean()
  isPremium!: boolean;
}
