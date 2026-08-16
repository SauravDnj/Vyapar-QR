import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** Honeypot — must stay hidden via CSS on the real form, never shown to
   * real users. Non-empty ⇒ the service silently returns success without
   * writing a row; never reveal to the bot that it was caught. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
