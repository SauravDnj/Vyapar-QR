import type { Lead, PaymentClaim, ReviewFunnelResponse } from '../jsondb';

/**
 * The shape every lead, payment and feedback event carries.
 *
 * Each event used to send whichever handful of fields its call site had to
 * hand — `lead.created` from the contact form sent five, `payment.claimed`
 * sent four and no status. That was fine for a notification and useless for a
 * spreadsheet, which needs the same columns every time and needs to be able
 * to *update* a row rather than only add one.
 *
 * So every event now carries the whole record, flat and with a stable `id`.
 * A receiver — the Google Sheets script in particular — upserts by that id:
 * `lead.created` and `lead.updated` are the same operation, a delivery that
 * arrives twice writes the same row twice, and nothing depends on events
 * arriving in order.
 */

export interface LeadPayload extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: string;
  notes: string;
  tags: string;
  createdAt: string;
}

export interface PaymentPayload extends Record<string, unknown> {
  id: string;
  amount: number | null;
  method: string;
  status: string;
  customerName: string;
  customerPhone: string;
  note: string;
  leadId: string;
  confirmedAt: string;
  createdAt: string;
}

export interface FeedbackPayload extends Record<string, unknown> {
  id: string;
  rating: number;
  type: string;
  text: string;
  customerNotes: string;
  createdAt: string;
}

/* Receivers get strings, never null, so a sheet cell is blank rather than the
   literal word "null". */
const text = (value: string | null | undefined) => value ?? '';

/**
 * A timestamp as ISO text, and never an exception.
 *
 * These builders run as the *argument* to `dispatch`, so they execute before
 * its error boundary is entered: a throw here escapes into the lead or
 * payment that triggered the event. Calling `.toISOString()` directly did
 * exactly that for any record without a date — which fails a customer's
 * payment over a webhook, the one thing webhooks promise never to do.
 */
function iso(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function leadPayload(lead: Lead): LeadPayload {
  const tags = Array.isArray(lead.tags) ? (lead.tags as unknown[]).map(String).join('; ') : '';
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    notes: text(lead.notes),
    tags,
    createdAt: iso(lead.createdAt),
  };
}

export function paymentPayload(claim: PaymentClaim): PaymentPayload {
  return {
    id: claim.id,
    // Already a number: the JSON store persists Decimal as one, which is
    // also what a spreadsheet needs to sum the column.
    amount: claim.amount,
    method: claim.method,
    status: claim.status,
    customerName: text(claim.customerName),
    customerPhone: text(claim.customerPhone),
    note: text(claim.note),
    leadId: text(claim.leadId),
    confirmedAt: iso(claim.confirmedAt),
    createdAt: iso(claim.createdAt),
  };
}

export function feedbackPayload(
  response: ReviewFunnelResponse,
  row: { type: string; text: string | null; customerNotes: string | null },
): FeedbackPayload {
  return {
    id: response.id,
    rating: response.ratingGiven,
    type: row.type,
    text: text(row.text),
    customerNotes: text(row.customerNotes),
    createdAt: iso(response.createdAt),
  };
}
