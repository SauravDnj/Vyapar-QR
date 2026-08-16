import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum LeadStatusFilter {
  new = 'new',
  contacted = 'contacted',
  converted = 'converted',
  lost = 'lost',
}

export class ListLeadsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize = 20;

  @IsOptional()
  @IsEnum(LeadStatusFilter)
  status?: LeadStatusFilter;

  @IsOptional()
  @IsString()
  search?: string;
}
