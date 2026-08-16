# QRHub — SaaS Digital QR Business Card & Landing Page Platform
### System Architecture, Database Design & Build Plan

*Working name "QRHub" used as a placeholder — rename freely.*

---

## 1. Concept in One Paragraph

A business buys a subscription, picks a theme, and fills in its details once. The platform generates **one QR code**. Anyone who scans it lands on that business's hosted page, which shows company info, one-tap buttons that open GPay / PhonePe / Paytm directly (no payment gateway, no API key — just the client's own uploaded QR image plus native app deep-links), a "Rate us" flow tied to Google Reviews (synced from a Google Sheet the client controls), and click-to-chat buttons for WhatsApp / Instagram / Facebook. A **Super Admin** runs the whole platform: approves clients, sells subscription plans, manages the theme catalog, and watches system-wide reports. Each **Client Admin** only manages their own business, page, and leads.

---

## 2. User Roles

| Role | Who | Core capabilities |
|---|---|---|
| **Super Admin** | Platform owner/you | Approve/suspend clients, manage plans & pricing, manage the theme catalog, view platform-wide revenue & usage reports, configure global settings, impersonate a client for support |
| **Client Admin** | The business that subscribes | Build/edit their landing page, pick & customize a theme, upload payment QR images, connect their Google Sheet for reviews, manage social links, download their master QR, view their leads (mini-CRM), view their own analytics |
| **Client Staff** *(Phase 4, optional)* | Employee invited by a Client Admin | Limited access — e.g. reply to leads only, no billing/theme access |
| **End Visitor** | Anonymous public | No login. Scans QR → views landing page → taps buttons. Optionally leaves name/phone in a contact form, which becomes a CRM lead |

---

## 3. Core User Journeys

**A. Client onboarding**
Sign up → choose a plan → pay via Razorpay/Stripe → status = `pending_approval` → Super Admin approves → onboarding wizard (business name, logo, description, address, hours) → pick a theme from the category grid → upload GPay/PhonePe/Paytm QR images (+ optional UPI ID for true one-tap pay) → paste Google Sheet link + Google review link → add WhatsApp/Instagram/Facebook → **master QR code generated automatically**, downloadable as PNG/SVG/print poster.

**B. End-visitor flow (the actual product experience)**
Scan QR → landing page opens (fast, no app needed) → sees hero + company info → taps "Pay with GPay" → GPay opens directly on the phone → taps "Rate us" → smart review funnel asks "How was your experience?" → 4–5★ routes straight to the public Google review page (pre-filled 5★), 1–3★ routes to a private feedback form instead of a public review → taps WhatsApp/Instagram/Facebook → opens directly in that app.

**C. Super Admin flow**
New signup lands in an approval queue → reviews business details → approves/rejects → monitors active vs. expired subscriptions → manages plan pricing/features → adds new themes to the catalog → pulls MRR/churn/usage reports.

---

## 4. Recommended Additions (beyond your original spec)

These extend what you described without adding gateways, API keys, or complexity you didn't ask for:

| Addition | Why it matters |
|---|---|
| **Smart review funnel** (rate internally first, only 4–5★ goes to public Google review) | Standard, high-value pattern for exactly this product — protects the business from public bad reviews while still capturing unhappy-customer feedback privately |
| **"Save Contact" / vCard button** | One tap saves the business's phone/address/site straight into the visitor's phone contacts — very natural for a digital business card |
| **QR scan analytics** (scans over time, button-click breakdown, no personal data) | Clients will ask "is this even working" — this answers it, and is a strong upsell for paid plans |
| **Plan-based feature gating** | Ties naturally into your subscription/package system — e.g. Basic = 3 themes + no custom domain, Pro = all themes + custom domain + analytics |
| **Trial period support** | Lets Super Admin offer e.g. 7-day free trial before first billing — common SaaS expectation |
| **Printable poster / table-tent generator** | Client downloads a ready-to-print PDF with their QR + "Scan to Pay / Review Us" — big practical value for physical shops |
| **Custom domain mapping** *(Phase 3, premium feature)* | `client-brand.com` → their landing page, instead of `qrhub.io/site/slug` |
| **SEO fields per landing page** (title, description, og:image) | Free organic reach if the page is ever shared as a link, not just scanned |
| **Audit log** | Super Admin can see who changed what — important once you have paying clients and disputes happen |

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| API | Node.js + NestJS (TypeScript) | Structured modules map cleanly to Auth / Billing / Themes / CRM; built-in DI, guards, and validation pipes fit RBAC + JWT well |
| Admin frontends | Next.js (React, TypeScript) | One app, role-gated routes for Super Admin vs Client Admin dashboards |
| Public landing pages | Next.js (SSR/ISR), separate route group from the dashboards | Fast, SEO-friendly, cacheable per client slug |
| Database | PostgreSQL | Relational integrity for subscriptions/plans/tenants; JSONB columns for flexible theme/content data — best of both worlds |
| ORM | Prisma | Type-safe schema, migrations, good fit with NestJS |
| Cache/queue | Redis | Session/rate-limit store, background jobs (Google Sheet sync, QR generation, email) via BullMQ |
| File storage | S3-compatible (AWS S3 or Cloudflare R2) | QR images, logos, theme assets, generated posters |
| Auth | JWT (access + refresh), bcrypt/argon2 | Matches your explicit requirement |
| SaaS billing | Razorpay (or Stripe) | Only used for **your** subscription revenue — never touches the client's own end-customer payments |
| Reviews source | Google Sheets API (service account, read-only) | Matches your requirement that reviews live in a sheet the client owns |
| Email | Postmark/SES/SMTP | Approval notices, invoices, password resets |
| Deployment | Docker + Nginx, GitHub Actions CI/CD | Reproducible, portable to any VPS or cloud |

---

## 6. High-Level Architecture

```
                         ┌─────────────────────────┐
   Visitors' phones ───▶ │  Next.js Landing Renderer │  (public, per-slug SSR pages)
                         └────────────┬─────────────┘
                                      │
   Super Admin / Client ───▶  Next.js Admin Dashboard  (role-gated)
        Admin browsers                │
                                      ▼
                         ┌─────────────────────────┐
                         │      NestJS API           │
                         │  Auth · Billing · Themes  │
                         │  CRM · Analytics · Admin  │
                         └───┬─────────┬─────────┬───┘
                             │         │         │
                    ┌────────▼──┐ ┌────▼────┐ ┌──▼─────────┐
                    │ PostgreSQL│ │  Redis   │ │  S3 storage │
                    │ (Prisma)  │ │ (queue,  │ │ (QR/logo/   │
                    │           │ │  cache)  │ │  theme img) │
                    └───────────┘ └──────────┘ └─────────────┘
                             │
              ┌──────────────┼───────────────────┐
              ▼                                   ▼
      Google Sheets API                    Razorpay/Stripe
   (read client's review sheet)         (client's SaaS subscription billing)
```

---

## 7. Multi-Tenancy & Routing

- **Single database, shared schema, tenant-scoped rows.** Every business-data table carries a `client_id`; a NestJS guard/interceptor injects and enforces it on every query — no client can ever read another's data.
- **MVP routing:** `qrhub.io/site/{slug}` — no DNS/SSL complexity, works instantly for every new client.
- **Phase 3 upgrade:** optional custom domain — client points a CNAME at the platform, Nginx + Let's Encrypt handles SSL per domain, a `custom_domain` lookup table maps hostname → `client_id`.

---

## 8. Database Schema (Core Tables)

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email, password_hash, role, status, created_at | role ∈ {super_admin, client_admin, client_staff} |
| `clients` | id, user_id, business_name, slug, status, theme_id, trial_ends_at | status ∈ {pending, active, suspended, rejected} |
| `plans` | id, name, price, billing_cycle, features_json, max_themes, custom_domain_allowed | Defines what a subscription unlocks |
| `subscriptions` | id, client_id, plan_id, status, gateway_subscription_id, current_period_end | Drives access/feature gating |
| `invoices` | id, client_id, subscription_id, amount, status, gateway_ref, issued_at | Super Admin billing reports |
| `themes` | id, name, category, preview_image_url, schema_json, is_premium | `schema_json` defines the editable sections/fields for the builder |
| `landing_pages` | id, client_id, theme_id, content_json, seo_meta, status, published_at | `content_json` = the client's filled-in content per theme schema |
| `payment_methods` | id, client_id, type, qr_image_url, upi_id (optional), display_order | type ∈ {gpay, phonepe, paytm, other} |
| `social_links` | id, client_id, platform, value, display_order | platform ∈ {whatsapp, instagram, facebook, ...} |
| `google_review_configs` | id, client_id, sheet_id, sheet_range, google_place_id, review_link, avg_rating_cached, last_synced_at | Powers the review widget |
| `reviews_cache` | id, client_id, reviewer_name, rating, comment, review_date | Synced copy of sheet rows, refreshed on a schedule |
| `review_funnel_responses` | id, client_id, rating_given, routed_to_google (bool), feedback_text, created_at | Captures the private-feedback branch |
| `leads` | id, client_id, name, phone, source, status, notes, tags, created_at | source ∈ {contact_form, whatsapp_click, qr_scan}; mini-CRM core |
| `qr_codes` | id, client_id, type, target_url, image_url, scan_count | type ∈ {master, promo} |
| `analytics_events` | id, client_id, event_type, meta_json, created_at | event_type ∈ {page_view, button_click, qr_scan} |
| `audit_logs` | id, actor_id, action, entity, entity_id, meta_json, created_at | Super Admin traceability |
| `settings` | key, value | Global platform config (SMTP, gateway keys, terms text, etc.) |

---

## 9. Module Breakdown

1. **Auth & RBAC** — register/login/refresh/logout, JWT access (short-lived) + refresh (httpOnly cookie), bcrypt hashing, role guards.
2. **Super Admin Console** — client approval queue, activate/suspend, plan & pricing CRUD, theme catalog management, global settings, platform reports (MRR, active clients, churn).
3. **Subscription & Billing** — Razorpay/Stripe checkout, webhook handling for renewals/failures, invoice generation, grace-period + auto-suspend on non-payment.
4. **Client Onboarding** — guided wizard: business info → theme pick → payment QR uploads → review sheet link → social links → QR generated.
5. **Theme Engine & Builder** — category-grouped theme gallery, live preview, section-based form editor driven by each theme's `schema_json` (no code needed per theme change).
6. **Public Landing Page Renderer** — SSR page per `slug`, renders `content_json` into the selected theme's components; caches aggressively since content changes infrequently.
7. **Payment App Deep-Link Module** — see §10 below; renders the client's uploaded QR image plus one-tap buttons.
8. **Google Review Integration + Smart Funnel** — background job pulls the client's Google Sheet on a schedule via a read-only service account; funnel logic branches 4–5★ → public review link, 1–3★ → private feedback form stored in `review_funnel_responses`.
9. **Social Links** — simple `wa.me/<number>`, `instagram.com/<handle>`, `facebook.com/<handle>` buttons, client-editable.
10. **Master QR Generator** — generates the client's unique QR (PNG/SVG, optional logo embed) pointing at their landing page URL; also generates a printable poster PDF.
11. **CRM (Lite)** — leads table populated from the landing page's contact form and WhatsApp-click events; status pipeline (new/contacted/converted/lost), notes, tags, CSV export.
12. **Analytics & Reporting** — per-client dashboard (scans, views, button clicks over time) and a platform-wide version for Super Admin.
13. **Notifications** — transactional email (approval, invoice, password reset); architecture leaves room to add WhatsApp Business API later without a rewrite.
14. **Settings** — Super Admin: global config. Client Admin: business profile, password, notification preferences.

---

## 10. How "Open GPay/PhonePe/Paytm With No Gateway" Actually Works

This is the trickiest part of the spec, worth being explicit about:

- If the client provides their **UPI ID** (a plain text field, e.g. `business@okhdfcbank` — *not* an API key or credential), the landing page can render a true one-tap link: `upi://pay?pa=<upi_id>&pn=<business_name>&cu=INR`. Tapping it opens **whichever UPI app the visitor has** with the business pre-filled — no gateway, no API key, ever.
- If the client only uploads a **QR image** (no UPI ID), the page shows that QR large enough to scan, plus buttons that just open each app (`tez://` for GPay, `phonepe://` for PhonePe, `paytmmp://` for Paytm) so the visitor can scan it from inside the app they choose.
- Recommendation: make the UPI ID field **optional** during onboarding — clients who add it get the smoother one-tap experience; clients who skip it still get a fully working scan-the-uploaded-QR experience. Either way, the platform never touches a rupee or a payment API.

---

## 11. Security Plan

- JWT access tokens (~15 min) + refresh tokens (httpOnly, rotated on use)
- Passwords hashed with bcrypt/argon2, never logged
- RBAC guards on every route (`super_admin` / `client_admin` / `client_staff`)
- Rate limiting on auth endpoints and public form submissions
- Helmet + strict CORS allowlist
- Server-side input validation (class-validator/zod) on every mutation
- Upload validation: MIME/size checks on QR images and theme assets
- `client_id` scoping enforced at the query layer, never trusted from the client
- Audit log on all Super Admin actions
- Secrets via environment variables, never committed
- HTTPS + HSTS everywhere

---

## 12. Suggested Repo Structure

```
qrhub/
├── apps/
│   ├── api/            # NestJS — all backend modules
│   ├── admin/          # Next.js — Super Admin + Client Admin (role-gated routes)
│   └── landing/         # Next.js — public per-slug landing pages
├── packages/
│   ├── types/           # Shared TS types (DTOs, enums)
│   ├── ui/               # Shared design-system components
│   └── config/          # Shared ESLint/TS/Tailwind config
├── docker-compose.yml
└── turbo.json
```

---

## 13. Phased Roadmap

| Phase | Scope |
|---|---|
| **1 — MVP** | Auth, Super Admin (approve/activate/suspend, basic plan CRUD), client onboarding, 3 starter themes, landing page renderer, payment QR upload + deep-link buttons, static Google review link + button, social links, master QR generator, basic CRM (leads from contact form), Razorpay subscription billing |
| **2** | Automated Google Sheet review sync, smart review funnel, analytics dashboards (client + platform), more themes/categories, plan-based feature gating, invoice/reporting for Super Admin |
| **3** | Custom domain mapping, vCard save-contact, printable poster generator, multi-language landing pages, WhatsApp-click lead tracking |
| **4** | Client staff accounts + permissions, advanced CRM (pipeline board view), white-label options, webhook/Zapier-style integrations |

---

## 14. Build Task List (ready-to-run prompts)

Each line below is scoped to hand off as a single build task.

**Phase 1 — Foundation**
1. Scaffold a pnpm + Turborepo monorepo: `apps/api` (NestJS), `apps/admin` (Next.js), `apps/landing` (Next.js), `packages/types`, `packages/ui`. Configure shared ESLint/Prettier/TypeScript strict config.
2. Design the Prisma schema for all tables in §8, generate the initial migration, and write a seed script (default plans, 3 starter themes, one Super Admin user).
3. Build the Auth module: register/login/refresh/logout, JWT access+refresh, bcrypt hashing, RBAC guards for `super_admin`/`client_admin`.
4. Build Super Admin: Clients module (list/filter/approve/activate/suspend) and Plans module (CRUD), with matching Next.js admin screens.
5. Build the client onboarding wizard (business info → theme selection → payment QR upload → social links → review link) with file upload to S3.
6. Build the Theme Engine: theme registry + `schema_json`-driven content editor, 3 starter themes (e.g. Minimal, Bold, Elegant), category tagging.
7. Build the public landing page renderer in `apps/landing`: SSR by slug, renders `content_json` into the chosen theme, includes payment buttons (§10) and social buttons.
8. Build the Master QR Generator: PNG/SVG export, downloadable from the client dashboard.
9. Integrate Razorpay subscription checkout + webhook handling (activate/suspend on payment events).
10. Build the contact-form → `leads` pipeline and a basic CRM list view (status, notes) in the client dashboard.
11. Deploy: Dockerize all three apps, set up docker-compose for local dev, write GitHub Actions CI (lint/test/build).

**Phase 2 — Reviews, Analytics, Gating**
12. Build the Google Sheets sync job (BullMQ + service account) populating `reviews_cache`, with admin UI to paste sheet link + configure column mapping.
13. Build the smart review funnel (internal 1–5★ prompt → branch to Google review link or private feedback form).
14. Build analytics event tracking (`page_view`, `button_click`, `qr_scan`) and dashboards for both Client Admin and Super Admin.
15. Add plan-based feature gating middleware (theme count, custom domain, analytics access) driven by `plans.features_json`.
16. Build Super Admin billing reports (MRR, active/suspended counts, churn) from `invoices`/`subscriptions`.

**Phase 3 — Growth features**
17. Build custom domain mapping (CNAME verification + Let's Encrypt automation + hostname→client lookup).
18. Add vCard "Save Contact" generation and button on the landing page.
19. Build the printable poster/table-tent PDF generator from the master QR + business info.
20. Add multi-language support to the theme content schema and renderer.
21. Track WhatsApp-click events into `leads` as a source type.

Say the word and I can start on **Task 1** (repo scaffold + schema), or we can adjust anything above first — plan name, theme count for MVP, which gateway (Razorpay vs Stripe), etc.
