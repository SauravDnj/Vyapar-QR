import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum OrderStatusFilter {
  pending = 'pending',
  confirmed = 'confirmed',
  ready = 'ready',
  completed = 'completed',
  cancelled = 'cancelled',
}

export class ListOrdersQueryDto {
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
  @IsEnum(OrderStatusFilter)
  status?: OrderStatusFilter;

  @IsOptional()
  @IsString()
  search?: string;
}
