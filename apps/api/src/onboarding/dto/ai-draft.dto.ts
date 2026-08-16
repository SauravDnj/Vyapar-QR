import { IsOptional, IsString, MinLength } from 'class-validator';

export class AiDraftDto {
  @IsString()
  @MinLength(2)
  businessName!: string;

  @IsOptional()
  @IsString()
  category?: string;
}
