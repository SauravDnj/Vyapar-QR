import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveLoyaltyProgramDto {
  @IsInt()
  @Min(2)
  @Max(50)
  stampsRequired!: number;

  @IsString()
  @MaxLength(200)
  rewardText!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
