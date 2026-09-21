import { ArrayMinSize, IsArray, IsIn, IsUrl } from 'class-validator';

export const WEBHOOK_EVENT_TYPES = [
  'lead.created',
  'lead.updated',
  'payment.claimed',
  'payment.updated',
  'feedback.received',
  'review.synced',
  'order.created',
  'subscription.updated',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  eventTypes!: WebhookEventType[];
}

export class ConnectWebhookDto {
  @IsUrl({ require_tld: false, protocols: ['https'], require_protocol: true })
  url!: string;
}
