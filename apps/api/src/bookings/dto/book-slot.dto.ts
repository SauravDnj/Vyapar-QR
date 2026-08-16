import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BookSlotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
