import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsPositive, IsString, Min, ValidateNested } from 'class-validator';

import { PlanFeaturesDto } from './plan-features.dto';

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsIn(['monthly', 'yearly'])
  billingCycle!: 'monthly' | 'yearly';

  @ValidateNested()
  @Type(() => PlanFeaturesDto)
  featuresJson!: PlanFeaturesDto;

  @IsInt()
  @Min(0)
  maxThemes!: number;

  @IsBoolean()
  customDomainAllowed!: boolean;
}
