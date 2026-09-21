import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsString, Min, MinLength, ValidateNested } from 'class-validator';

import { PlanFeaturesDto } from './plan-features.dto';

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /* Zero is allowed. This used to be @IsPositive, while the form's input was
     min="0" — so a free or complimentary plan passed the form and then failed
     at the API with nothing but "Failed to create plan." Once the Super Admin
     assigns plans rather than clients buying them, a ₹0 plan is an ordinary
     thing to want. */
  @IsNumber()
  @Min(0)
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
