import { IsIn } from 'class-validator';

import type { PaymentClaimStatus } from '../../jsondb';

export class UpdatePaymentStatusDto {
  @IsIn(['claimed', 'confirmed', 'cancelled'])
  status!: PaymentClaimStatus;
}
