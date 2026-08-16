import { IsHexColor, IsOptional, IsString, MinLength } from 'class-validator';

export class SelectThemeDto {
  @IsString()
  @MinLength(1)
  themeId!: string;

  /** Client-chosen accent color override — pass `null` explicitly to reset
   * to the theme's own default. Omit the field to leave it unchanged. */
  @IsOptional()
  @IsHexColor()
  accentColor?: string | null;
}
