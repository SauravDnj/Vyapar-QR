import { IsBoolean } from 'class-validator';

export class PlanFeaturesDto {
  @IsBoolean()
  analytics!: boolean;

  @IsBoolean()
  customDomain!: boolean;

  @IsBoolean()
  whiteLabel!: boolean;

  @IsBoolean()
  digitalMenu!: boolean;
}
