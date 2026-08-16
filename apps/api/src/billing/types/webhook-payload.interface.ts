/** Minimal shape of the fields this app reads from Razorpay webhook events.
 * The full payload has many more fields — see https://razorpay.com/docs/webhooks/payloads/ */
export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription?: { entity: { id: string; current_end?: number | null; status: string } };
    payment?: { entity: { id: string; amount: number; status: string } };
  };
}
