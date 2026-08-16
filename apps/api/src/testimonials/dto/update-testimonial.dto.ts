import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTestimonialDto {
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  authorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  quote?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
