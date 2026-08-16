import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

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

  @IsOptional()
  @ValidateNested()
  @Type(() => ColumnMappingDto)
  columnMapping?: ColumnMappingDto;
}
