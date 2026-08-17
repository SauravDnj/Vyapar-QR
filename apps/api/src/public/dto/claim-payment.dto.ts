import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/** Self-reported — there's no payment gateway behind a raw UPI deep-link,
 * so this is the customer telling the business "I paid", not a verified
 * receipt. The owner-facing WhatsApp alert says so explicitly. */
export class ClaimPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsIn(['gpay', 'phonepe', 'paytm', 'other'])
  method?: string;

  /** Honeypot — same convention as every other public form in this codebase. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
