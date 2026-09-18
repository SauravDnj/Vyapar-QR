import { IsIn, IsOptional } from 'class-validator';

import type { PaymentClaimStatus } from '../../jsondb';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsIn(['claimed', 'confirmed', 'cancelled'])
  status?: PaymentClaimStatus;
}
