import { IsOptional, IsString } from 'class-validator';

export class MenuSectionDto {
  @IsOptional()
  @IsString()
  heading?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
