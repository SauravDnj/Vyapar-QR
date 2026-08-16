import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const LEAD_STATUSES = ['new', 'contacted', 'converted', 'lost'] as const;

export class BroadcastDto {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: (typeof LEAD_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  message?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  aiPrompt?: string;
}
