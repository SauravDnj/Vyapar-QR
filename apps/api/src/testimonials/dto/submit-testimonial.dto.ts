import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SubmitTestimonialDto {
  @IsString()
  @MaxLength(200)
  authorName!: string;

  @IsString()
  @MaxLength(1000)
  quote!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  /** Honeypot — must stay hidden via CSS on the real form, never shown to
   * real users. Non-empty ⇒ the service silently returns success without
   * writing a row; never reveal to the bot that it was caught. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
