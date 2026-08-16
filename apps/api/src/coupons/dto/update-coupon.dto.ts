import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCouponDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
