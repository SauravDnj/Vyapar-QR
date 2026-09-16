import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  /** Quick-pick chips the customer tapped, e.g. "Food", "Service". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  highlights?: string[];

  /** 0 for the first draft; "Try another" sends 1, 2, … for a new wording. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  variant?: number;

  /** Honeypot — same convention as every other public form in this codebase. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
