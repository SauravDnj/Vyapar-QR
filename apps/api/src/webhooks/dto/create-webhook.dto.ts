import { ArrayMinSize, IsArray, IsIn, IsUrl } from 'class-validator';

export const WEBHOOK_EVENT_TYPES = ['lead.created', 'review.synced', 'subscription.updated', 'order.created'] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export class CreateWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  eventTypes!: WebhookEventType[];
}
