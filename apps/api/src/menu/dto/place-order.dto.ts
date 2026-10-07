import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery'] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

class OrderItemDto {
  @IsString()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class PlaceOrderDto {
  @IsString()
  @MaxLength(200)
  customerName!: string;

  /** At least 10 digits once spaces, dashes and a leading + are allowed for:
   * the shop has to be able to call back about the order. */
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[\d\s-]{10,}$/, { message: 'Enter a valid phone number.' })
  customerPhone!: string;

  /** Optional so an older cached landing page can still order. */
  @IsOptional()
  @IsIn(ORDER_TYPES)
  orderType?: OrderTypeValue;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tableNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Honeypot — must stay hidden via CSS on the real form, never shown to
   * real users. Non-empty ⇒ the service silently returns success without
   * writing a row; never reveal to the bot that it was caught. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
