import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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

  @IsString()
  @MaxLength(30)
  customerPhone!: string;

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
