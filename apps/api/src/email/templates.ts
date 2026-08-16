export interface EmailContent {
  subject: string;
  html: string;
}

function wrap(bodyHtml: string): string {
  return `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">${bodyHtml}</div>`;
}

export function clientApprovedEmail(businessName: string, dashboardUrl: string): EmailContent {
  return {
    subject: 'Your QRHub account has been approved',
    html: wrap(`
      <h2>You're approved, ${businessName}!</h2>
      <p>Your QRHub account is now active. You can log in and finish setting up your page.</p>
      <p><a href="${dashboardUrl}">Go to your dashboard</a></p>
    `),
  };
}

export function invoiceReceiptEmail(businessName: string, amount: string, invoiceId: string): EmailContent {
  return {
    subject: `Receipt for your QRHub subscription — ₹${amount}`,
    html: wrap(`
      <h2>Payment received</h2>
      <p>Hi ${businessName}, we've received your payment of <strong>₹${amount}</strong>.</p>
      <p>Invoice reference: ${invoiceId}</p>
    `),
  };
}

export function staffInviteEmail(businessName: string, inviteUrl: string): EmailContent {
  return {
    subject: `You've been invited to help run ${businessName} on QRHub`,
    html: wrap(`
      <h2>You're invited</h2>
      <p>${businessName} has invited you to manage their QRHub page as a team member.</p>
      <p><a href="${inviteUrl}">Accept the invite</a></p>
      <p>This link expires in 7 days.</p>
    `),
  };
}

export function newLeadEmail(businessName: string, leadName: string, leadPhone: string, notes: string | null, leadsUrl: string): EmailContent {
  return {
    subject: `New lead: ${leadName}`,
    html: wrap(`
      <h2>New lead from your page</h2>
      <p>Hi ${businessName}, someone just filled out your contact form.</p>
      <p><strong>Name:</strong> ${leadName}<br/><strong>Phone:</strong> ${leadPhone}</p>
      ${notes ? `<p><strong>Message:</strong> ${notes}</p>` : ''}
      <p><a href="${leadsUrl}">View in your dashboard</a></p>
    `),
  };
}

export interface NewOrderEmailItem {
  name: string;
  unitPrice: string;
  quantity: number;
}

export function newOrderEmail(
  businessName: string,
  orderId: string,
  items: NewOrderEmailItem[],
  totalAmount: string,
  ordersUrl: string,
): EmailContent {
  const itemsHtml = items.map((item) => `${String(item.quantity)}× ${item.name} (₹${item.unitPrice})`).join('<br/>');
  return {
    subject: `New order — ₹${totalAmount}`,
    html: wrap(`
      <h2>New order from your menu</h2>
      <p>Hi ${businessName}, someone just placed an order on your page.</p>
      <p>${itemsHtml}</p>
      <p><strong>Total: ₹${totalAmount}</strong></p>
      <p>Order reference: ${orderId}</p>
      <p><a href="${ordersUrl}">View in your dashboard</a></p>
    `),
  };
}

export function lowRatingFeedbackEmail(businessName: string, rating: number, feedbackText: string | null, reviewsUrl: string): EmailContent {
  return {
    subject: `Private feedback (${String(rating)}★) — kept off your public reviews`,
    html: wrap(`
      <h2>A visitor left ${String(rating)}★ feedback</h2>
      <p>Hi ${businessName}, someone rated their experience ${String(rating)}★ on your review funnel — this stays private and was <strong>not</strong> posted publicly.</p>
      ${feedbackText ? `<p><strong>What they said:</strong> ${feedbackText}</p>` : '<p>They didn\'t leave a written comment.</p>'}
      <p><a href="${reviewsUrl}">View in your dashboard</a></p>
    `),
  };
}

export interface WeeklyDigestStats {
  pageViews: number;
  qrScans: number;
  newLeads: number;
  newTestimonials: number;
  dashboardUrl: string;
  /** P13-06: an AI-written plain-English summary of the week, shown above
   * the raw numbers when Groq is configured — null falls back to numbers
   * only, exactly as before this feature existed. */
  aiSummary?: string | null;
}

export function weeklyDigestEmail(businessName: string, stats: WeeklyDigestStats): EmailContent {
  return {
    subject: `Your week on QRHub — ${businessName}`,
    html: wrap(`
      <h2>Here's how your page did this week</h2>
      ${stats.aiSummary ? `<p>${stats.aiSummary}</p>` : ''}
      <p>
        <strong>${String(stats.pageViews)}</strong> page views<br/>
        <strong>${String(stats.qrScans)}</strong> QR scans<br/>
        <strong>${String(stats.newLeads)}</strong> new leads<br/>
        <strong>${String(stats.newTestimonials)}</strong> new testimonials
      </p>
      <p><a href="${stats.dashboardUrl}">Open your dashboard</a></p>
    `),
  };
}

export function passwordResetEmail(resetUrl: string): EmailContent {
  return {
    subject: 'Reset your QRHub password',
    html: wrap(`
      <h2>Reset your password</h2>
      <p>Click the link below to set a new password. This link expires in 15 minutes.</p>
      <p><a href="${resetUrl}">Reset password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `),
  };
}
