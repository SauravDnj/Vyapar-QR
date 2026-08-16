import { IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'code may only contain letters, numbers, and hyphens' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  discountText!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;
}
