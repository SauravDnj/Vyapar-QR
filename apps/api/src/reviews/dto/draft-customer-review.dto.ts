import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DraftCustomerReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(5)
  rating!: number;

  /** What the customer liked, in their own words — grounds the draft so
   * the AI doesn't invent specifics they never mentioned. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Honeypot — same convention as every other public form in this codebase. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
