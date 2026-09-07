# QRHub — How to use it

A practical guide to the live system: who logs in, what each person can do, and
how a business goes from signing up to having a working QR code.

For deploying or changing the system, see
[`DEPLOY_VERCEL.md`](./DEPLOY_VERCEL.md). For what's built, see
[`PROGRESS.md`](./PROGRESS.md).

---

## The live system

| What | Where |
|---|---|
| **Admin** (both logins below) | https://qrhub-admin.vercel.app |
| **Customer landing pages** | https://qrhub-landing.vercel.app/site/`<slug>` |
| API | https://qrhub-api.vercel.app |

---

## Who logs in

There are three kinds of people. Only two of them have a login.

### 1. Super Admin — you, the platform owner

| | |
|---|---|
| Email | `admin@qrhub.local` |
| Password | `rzNbY1F4nVbta-v7` |

Runs the whole platform: approves businesses, sets pricing plans, manages the
theme catalog, sees revenue across every client.

> **Change this password**, and move to an email you actually own.
> `admin@qrhub.local` is not a real address, so password-reset mail goes
> nowhere. Create a replacement super admin, then delete this one.

### 2. Client Admin — a business that pays you

| | |
|---|---|
| Email | `client@qrhub.local` |
| Password | `heXdqs-gpTEJ` |
| Live page | https://qrhub-landing.vercel.app/site/blue-bean-cafe |

This is a working demo account — "Blue Bean Cafe", already onboarded, published
and approved. Log in to see what a real customer of yours sees.

A business only ever sees its own data. It cannot see other businesses, or
anything on the Super Admin side.

### 3. The person who scans the QR — no login at all

They open the landing page and act immediately: pay, message, review, book.
**This is deliberate.** Asking someone to create an account before they can pay
for a coffee would defeat the entire point of a scan-and-go card.

---

## How a business gets set up

Five steps, all inside the admin app.

### Step 1 — Sign up

The business registers at https://qrhub-admin.vercel.app/register and lands
straight in onboarding.

### Step 2 — Onboarding

| Step | What they enter |
|---|---|
| **Business** | Name, tagline, description, address, opening hours, phone |
| **Theme** | Pick a design from the catalog; optionally override the accent colour |
| **Payment** | UPI IDs and/or QR images for GPay, PhonePe, Paytm |
| **Social & reviews** | WhatsApp number, Instagram, Facebook, Google review link |

Only **theme** and **at least one payment method** are strictly required —
publishing is blocked without them.

### Step 3 — Publish

Finishing onboarding publishes the page and **generates the QR code** (PNG and
SVG). It's in the dashboard under **QR Codes**, ready to print on a card,
sticker, or table tent.

### Step 4 — You approve them

New businesses start as `pending`. In **Super Admin → Clients**, open the
business and click **Approve**.

### Step 5 — It's live

The page is now public at `/site/<slug>`, where the slug comes from the
business name — "Blue Bean Cafe" becomes `blue-bean-cafe`.

> **Both things are required.** The page stays a 404 until it is *published*
> **and** the client is *approved*. That is intentional: it stops half-finished
> pages and unapproved businesses appearing in public.

---

## What the scanning customer can do

Everything on one page, no app, no signup:

- **Pay** — one tap opens GPay, PhonePe or Paytm with the business's UPI ID
  already filled in. They can type an amount and mark it paid; the business
  gets a notification.
- **Review, filtered** — 4–5★ goes to the public Google review page; 1–3★ opens
  a private feedback form instead. Complaints reach the owner rather than the
  internet.
- **WhatsApp / Instagram / Facebook** — one tap to chat.
- **Leave their details** — a contact form that becomes a lead in the dashboard.
- **Menu and ordering**, **book a slot**, **collect loyalty stamps** — where the
  business has set those up.

> **On payments:** QRHub never touches the money. It opens the customer's own
> UPI app pointed at the business's own UPI ID. There is no payment gateway,
> no settlement, and no cut taken — which is also why a "paid" confirmation is
> self-reported and the business should check its UPI app before trusting it.

---

## The business dashboard

| Section | What it's for |
|---|---|
| **Leads** | Everyone who left their details; mark contacted, add notes |
| **Analytics** | Scans, page views, button clicks, conversion funnel |
| **Reviews** | Google reviews synced in, plus private negative feedback |
| **QR Codes** | Download the master QR, or make extra ones per table/poster |
| **Menu / Orders** | Digital menu and WhatsApp ordering |
| **Bookings** | Publish free slots; customers book without an account |
| **Coupons / Loyalty** | Discount codes and stamp cards |
| **Testimonials** | Collect and show customer quotes |
| **WhatsApp** | Chat inbox, broadcasts, AI-assisted replies |
| **Theme / Page** | Change design, edit content, add photos |
| **Locations** | Extra branches |
| **Staff** | Extra logins with limited permissions |
| **Domain** | Point a custom domain at the page |
| **Billing** | Plan and invoices |

## The Super Admin dashboard

| Section | What it's for |
|---|---|
| **Clients** | Approve, reject, suspend, reactivate businesses |
| **Plans** | Pricing tiers and what each unlocks |
| **Themes** | The design catalog every business picks from |
| **Analytics / Reports** | Platform-wide usage and revenue |
| **Agencies** | Resellers who bring in clients under a referral link |
| **Audit log** | Who changed what |
| **Settings** | Platform configuration |

---

## Common tasks

**Approve a waiting business** — Super Admin → Clients → open it → Approve.

**Find a business's public page** — its slug is the business name in lowercase
with dashes: `https://qrhub-landing.vercel.app/site/<slug>`.

**Re-download a QR code** — the business's dashboard → QR Codes. The QR points
at a fixed URL, so the page content can change forever without reprinting.

**Change a plan's price** — Super Admin → Plans. Existing subscriptions keep
their current price until renewal.

**Suspend a non-paying business** — Super Admin → Clients → Suspend. The public
page goes offline; the data is kept.

---

## When something looks wrong

**A public page shows 404.** Either the page was never published (finish
onboarding) or the client isn't approved yet. Both are required.

**A business says its page won't publish.** It's missing a theme or a payment
method — publishing is blocked without both.

**Admin pages fail to load data.** Usually `CORS_ORIGINS` on the API not
matching the admin URL exactly. See the troubleshooting section in
`DEPLOY_VERCEL.md`.

**A customer says they paid but the business didn't get it.** Expected — the
"paid" tap is self-reported, not a verified receipt. The business must confirm
in its own UPI app.

---

## Things worth knowing before you sell this

**Data lives in JSON files, not a database server.** That keeps hosting free
and simple, and is genuinely fine at this size. Two limits come with it: two
people writing the same kind of record at the exact same moment can have one
overwrite the other, and every query loads that record type's whole file. Plan
to move to a real database once any collection passes roughly 10,000 rows —
analytics events will get there first. The swap only touches one file; nothing
else in the app changes.

**Background jobs run once a day**, at 03:00 UTC — billing suspensions, lead
follow-ups, booking reminders, review sync, weekly digests. Vercel's free plan
allows only daily jobs; a paid plan lets each run on its own schedule.

**Some features need accounts you haven't connected yet.** Razorpay
(subscription billing), Google (review sync), Meta (WhatsApp Business API),
Groq (AI replies), MSG91 (SMS). Everything works without them — those specific
features simply stay off until the keys are added.
