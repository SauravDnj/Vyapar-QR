import { IsIn } from 'class-validator';

const ORDER_STATUS_VALUES = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'] as const;
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUS_VALUES)
  status!: OrderStatusValue;
}
