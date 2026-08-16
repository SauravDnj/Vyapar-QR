import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SubmitFunnelDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  feedbackText?: string;

  /** Honeypot — must stay hidden via CSS on the real form, never shown to
   * real users. Non-empty ⇒ the service silently returns success without
   * writing a row; never reveal to the bot that it was caught. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
