import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum LeadStatusInput {
  new = 'new',
  contacted = 'contacted',
  converted = 'converted',
  lost = 'lost',
}

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatusInput)
  status?: LeadStatusInput;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
