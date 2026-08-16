import { IsString, MaxLength, MinLength } from 'class-validator';

export class StampCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone!: string;
}
