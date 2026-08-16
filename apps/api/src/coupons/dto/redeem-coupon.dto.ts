import { IsString, MinLength } from 'class-validator';

export class RedeemCouponDto {
  @IsString()
  @MinLength(2)
  code!: string;
}
