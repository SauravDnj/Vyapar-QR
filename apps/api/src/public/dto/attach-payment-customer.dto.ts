import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Everything here is optional: it is asked for *after* the customer has
 * paid, purely so the business can thank them or follow up. A payment is
 * never blocked on giving a number. */
export class AttachPaymentCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
