import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Sent when a 4-5★ customer taps "Post on Google": records the review they
 * took with them, so the owner can see it and it lands in their sheet. */
export class ReviewHandoffDto {
  /** The funnel response created when they picked their star rating. */
  @IsString()
  @MaxLength(64)
  responseId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNotes?: string;

  @IsOptional()
  @IsBoolean()
  aiDrafted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
