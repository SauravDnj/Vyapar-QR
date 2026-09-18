import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/** Self-reported — there's no payment gateway behind a raw UPI deep-link,
 * so this is the customer telling the business "I paid", not a verified
 * receipt. The owner-facing WhatsApp alert says so explicitly. */
export class ClaimPaymentDto {
  /** Optional: a customer can open their UPI app and type the amount there,
   * in which case we never learn it and the claim records no figure. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount?: number;

  /** Offered on the thank-you screen, never required to pay. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsIn(['gpay', 'phonepe', 'paytm', 'other'])
  method?: string;

  /** Honeypot — same convention as every other public form in this codebase. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
