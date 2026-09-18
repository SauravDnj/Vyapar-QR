import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class ColumnMappingDto {
  @IsString()
  reviewerName!: string;

  @IsString()
  rating!: string;

  @IsString()
  comment!: string;

  @IsString()
  reviewDate!: string;
}

export class SaveReviewConfigDto {
  @IsOptional()
  @IsString()
  sheetId?: string;

  @IsOptional()
  @IsString()
  sheetRange?: string;

  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  reviewLink?: string;

  @IsOptional()
  @IsString()
  feedbackWhatsappNumber?: string;

  @IsOptional()
  @IsString()
  feedbackSheetId?: string;

  @IsOptional()
  @IsString()
  feedbackSheetTab?: string;

  /** Comma-separated services the review may mention, e.g. "bridal gold, temple jewellery". */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoKeywords?: string;

  /** Area or city a review should name once, e.g. "Jayanagar, Bengaluru". */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  localityHint?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping?: ColumnMappingDto;
}
