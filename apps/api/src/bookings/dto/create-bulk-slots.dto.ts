import { IsInt, IsISO8601, Matches, Max, Min } from 'class-validator';

export class CreateBulkSlotsDto {
  /** Date the slots fall on, `YYYY-MM-DD`. */
  @IsISO8601()
  date!: string;

  /** `HH:mm`, 24-hour. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  /** `HH:mm`, 24-hour — must be after `startTime`. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @IsInt()
  @Min(5)
  @Max(240)
  intervalMinutes!: number;
}
