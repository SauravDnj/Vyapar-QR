import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';

const UPI_ID_PATTERN = /^[\w.-]+@[\w.-]+$/;

export class PaymentMethodInputDto {
  @IsIn(['gpay', 'phonepe', 'paytm', 'other'])
  type!: 'gpay' | 'phonepe' | 'paytm' | 'other';

  @IsOptional()
  @IsString()
  qrImageUrl?: string;

  @IsOptional()
  @Matches(UPI_ID_PATTERN, { message: 'upiId must look like name@bank' })
  upiId?: string;
}

export class SavePaymentMethodsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodInputDto)
  methods!: PaymentMethodInputDto[];
}
