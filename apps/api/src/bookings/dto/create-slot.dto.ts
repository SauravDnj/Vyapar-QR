import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class CreateSlotDto {
  @IsISO8601()
  startsAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;
}
