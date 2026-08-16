import { IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
