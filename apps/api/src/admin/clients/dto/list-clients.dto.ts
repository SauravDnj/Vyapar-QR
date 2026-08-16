import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum ClientStatusFilter {
  pending = 'pending',
  active = 'active',
  suspended = 'suspended',
  rejected = 'rejected',
}

export class ListClientsQueryDto {
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
  @IsEnum(ClientStatusFilter)
  status?: ClientStatusFilter;

  @IsOptional()
  @IsString()
  search?: string;
}
