# QRHub — Full Build Task List (Execution Backlog)

Companion to [`PLAN.md`](./PLAN.md). Every item below is a self-contained task: a **Prompt** (paste as-is to build it), and **Deliverables** (what "done" means). Work top to bottom within a phase — later tasks assume earlier ones exist. IDs are stable so you can reference them ("do P1-14 next").

---

## Phase 1 — Foundation & MVP

### A. Infrastructure & Repo Setup

**P1-01 — Scaffold the monorepo**
Prompt: "Set up a pnpm + Turborepo monorepo with `apps/api` (NestJS), `apps/admin` (Next.js, TypeScript), `apps/landing` (Next.js, TypeScript), `packages/types`, `packages/ui`, `packages/config`. Wire root scripts for `dev`, `build`, `lint`, `test` across all apps via Turborepo."
Deliverables: working monorepo, `pnpm dev` boots all three apps.

**P1-02 — Shared lint/type config**
Prompt: "Create `packages/config` with shared ESLint (TypeScript strict + import order rules), Prettier, and `tsconfig.base.json`. Wire every app/package to extend it."
Deliverables: one lint/format standard, `pnpm lint` clean on fresh scaffold.

**P1-03 — Local dev environment**
Prompt: "Write `docker-compose.yml` with PostgreSQL, Redis, and MinIO (S3-compatible local storage). Add `.env.example` files for `apps/api`, `apps/admin`, `apps/landing` covering DB URL, Redis URL, JWT secrets, S3/MinIO credentials, Razorpay test keys, SMTP settings."
Deliverables: `docker compose up` gives a fully working local backend stack.

**P1-04 — CI pipeline**
Prompt: "Add a GitHub Actions workflow that runs on every PR: install deps, lint, typecheck, run unit tests, and build all three apps. Fail the build on any error."
Deliverables: green CI badge on a clean scaffold commit.

---

### B. Database

**P1-05 — Prisma schema**
Prompt: "Using the table list in PLAN.md §8, write the full Prisma schema: `User`, `Client`, `Plan`, `Subscription`, `Invoice`, `Theme`, `LandingPage`, `PaymentMethod`, `SocialLink`, `GoogleReviewConfig`, `ReviewCache`, `ReviewFunnelResponse`, `Lead`, `QrCode`, `AnalyticsEvent`, `AuditLog`, `Setting`. Use enums for role/status/type fields, JSONB for `features_json`/`schema_json`/`content_json`/`meta_json`, and proper foreign keys with `client_id` cascade rules."
Deliverables: `schema.prisma`, first migration applied cleanly to a fresh DB.

**P1-06 — Seed script**
Prompt: "Write a Prisma seed script that creates one Super Admin user, 3 default Plans (e.g. Starter/Pro/Business with different `max_themes` and `custom_domain_allowed`), and 3 starter Themes (Minimal, Bold, Elegant) with placeholder `schema_json`."
Deliverables: `pnpm db:seed` produces a usable dev environment.

---

### C. Auth & RBAC

**P1-07 — Auth module (API)**
Prompt: "Build a NestJS Auth module: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. Hash passwords with bcrypt. Issue a short-lived JWT access token and a long-lived refresh token stored as an httpOnly, secure cookie, rotated on every refresh."
Deliverables: working auth endpoints with tests for happy path + wrong password + expired token.

**P1-08 — RBAC guards**
Prompt: "Add a `@Roles()` decorator and a `RolesGuard` in NestJS that reads the JWT payload's role (`super_admin` | `client_admin` | `client_staff`) and blocks access to decorated routes. Add a `ClientScopeGuard` that injects `client_id` from the authenticated user and rejects any request trying to access another client's data."
Deliverables: guard unit tests covering allow/deny for each role.

**P1-09 — Password reset flow**
Prompt: "Add `POST /auth/forgot-password` (emails a signed, expiring reset token) and `POST /auth/reset-password` (validates token, sets new password)."
Deliverables: end-to-end reset flow, token expiry enforced.

**P1-10 — Rate limiting**
Prompt: "Add rate limiting (e.g. `@nestjs/throttler` + Redis store) on `/auth/login`, `/auth/register`, `/auth/forgot-password`, and the public contact-form endpoint."
Deliverables: 429 responses after threshold, configurable per route.

**P1-11 — Admin app auth UI**
Prompt: "In `apps/admin`, build login/register pages, an auth context/hook storing the access token in memory (never localStorage), silent refresh on load, and a `ProtectedRoute`/middleware that redirects based on role (super_admin → `/super-admin/*`, client_admin → `/dashboard/*`)."
Deliverables: role-based redirect works end-to-end against the API.

---

### D. Super Admin Module

**P1-12 — Clients API**
Prompt: "Build a NestJS Clients module (super-admin only): `GET /admin/clients` (paginated, filter by status/search by name/email), `PATCH /admin/clients/:id/approve`, `PATCH /admin/clients/:id/reject`, `PATCH /admin/clients/:id/suspend`, `PATCH /admin/clients/:id/reactivate`. Write an `AuditLog` entry on every state change."
Deliverables: endpoints + tests; audit log rows created correctly.

**P1-13 — Plans API**
Prompt: "Build a Plans CRUD module (super-admin only) for `GET/POST/PATCH/DELETE /admin/plans`, validating `features_json` shape (theme limit, custom domain flag, analytics flag)."
Deliverables: CRUD endpoints + validation tests.

**P1-14 — Global settings API**
Prompt: "Build a key-value Settings module (super-admin only) for platform config: SMTP config, default trial length, terms/privacy text, support email. `GET/PUT /admin/settings`."
Deliverables: settings persisted and readable by other modules (e.g. trial length used at signup).

**P1-15 — Super Admin dashboard UI**
Prompt: "In `apps/admin`, build the Super Admin section: client list with status filters and an approval queue view, plan management screen (create/edit/archive plan), and a settings page. Use a data table with search/pagination."
Deliverables: fully clickable UI wired to P1-12/13/14 APIs.

**P1-16 — Impersonate client**
Prompt: "Add a super-admin-only `POST /admin/clients/:id/impersonate` that issues a short-lived, clearly-scoped token letting the Super Admin view the client dashboard as that client, logged in `AuditLog`, with a visible 'Viewing as {client}' banner in the UI."
Deliverables: impersonation session works, is audit-logged, and is time-limited.

---

### E. Subscription & Billing

**P1-17 — Razorpay checkout**
Prompt: "Integrate Razorpay Subscriptions: `POST /billing/checkout` creates a Razorpay subscription for the selected plan and returns the checkout payload for the frontend SDK. Store the resulting `gateway_subscription_id` on the `Subscription` row with status `pending`."
Deliverables: checkout flow returns a working Razorpay session in test mode.

**P1-18 — Webhook handler**
Prompt: "Build `POST /billing/webhook` verifying Razorpay's signature, handling `subscription.activated`, `subscription.charged`, `subscription.cancelled`, and `payment.failed` events — updating `Subscription.status`, `Client.status`, and creating `Invoice` rows accordingly."
Deliverables: webhook tested against Razorpay's sample payloads; idempotent on retries.

**P1-19 — Invoices & grace period**
Prompt: "Add `GET /billing/invoices` (client-scoped) and a scheduled job (BullMQ, daily) that finds subscriptions past `current_period_end` with no successful renewal within a configurable grace period and sets `Client.status = suspended`."
Deliverables: invoice list endpoint + working cron job with a test for the suspend path.

**P1-20 — Billing UI**
Prompt: "In `apps/admin` client dashboard, build a Billing page: current plan, upgrade/downgrade button (re-runs checkout), and invoice history table with download links."
Deliverables: client can view/download invoices and change plan.

---

### F. Client Onboarding

**P1-21 — Onboarding wizard shell**
Prompt: "Build a multi-step onboarding wizard in `apps/admin` (business info → theme → payment methods → social links → review config → done), with progress indicator and the ability to leave and resume from where they stopped (persist step + partial data)."
Deliverables: wizard state persists across reloads.

**P1-22 — Business info step**
Prompt: "Build the business info step: name, logo upload (to S3/MinIO), description, address, hours, phone. Auto-generate a unique `slug` from the business name with collision handling."
Deliverables: `Client` and `LandingPage` rows created/updated correctly.

**P1-23 — Payment methods step**
Prompt: "Build the payment methods step: for each of GPay/PhonePe/Paytm/Other, let the client upload a QR image and optionally enter their UPI ID (plain text field, validated as `name@bank` format). Save to `PaymentMethod`."
Deliverables: at least one payment method required to proceed; validation on UPI ID format.

**P1-24 — Social + review config steps**
Prompt: "Build the social links step (WhatsApp number, Instagram handle, Facebook page — normalize into full URLs) and the Google review step (Google Sheet share link, Google review link, optional Place ID). Save to `SocialLink` and `GoogleReviewConfig`."
Deliverables: both steps validated and persisted.

**P1-25 — Wizard completion**
Prompt: "On wizard completion, mark `LandingPage.status = published`, trigger the QR generation job (P1-33), and redirect the client to their dashboard showing the live landing page URL and QR."
Deliverables: end-to-end: finishing onboarding produces a scannable, live landing page.

---

### G. Theme Engine

**P1-26 — Theme schema spec**
Prompt: "Define and document the `schema_json` format for themes: an ordered list of sections (hero, about, payment, reviews, social, contact, footer), each with typed fields (text, image, color, list) the client can fill in. Write this as a shared TypeScript type in `packages/types`."
Deliverables: documented schema + TS types used by both the editor and renderer.

**P1-27 — Theme registry API**
Prompt: "Build `GET /themes` (list, filterable by category) and `GET /themes/:id` in NestJS, backed by the `Theme` table."
Deliverables: endpoints + tests.

**P1-28 — Starter themes (components)**
Prompt: "Build 3 theme component sets in `packages/ui` (Minimal, Bold, Elegant), each rendering a `content_json` payload matching the schema from P1-26 into a full landing page layout — hero, payment buttons, reviews, social, contact, footer."
Deliverables: 3 visually distinct, fully responsive themes rendering real sample content.

**P1-29 — Theme content editor**
Prompt: "Build a form editor in `apps/admin` that renders input fields dynamically from a theme's `schema_json`, with a live preview pane showing the selected theme updating in real time as the client edits."
Deliverables: editing any field updates the live preview instantly; save persists `content_json`.

**P1-30 — Theme gallery UI**
Prompt: "Build a theme browsing screen in `apps/admin`, grouped by category, with preview thumbnails and a 'switch theme' action (with a warning about layout differences before confirming)."
Deliverables: client can browse and switch themes, respecting plan-based theme limits.

---

### H. Public Landing Page Renderer

**P1-31 — Dynamic slug route**
Prompt: "In `apps/landing`, build `app/site/[slug]/page.tsx` that server-side fetches the published `LandingPage` + `content_json` + theme by slug, and renders the matching theme component from `packages/ui`. Return a proper 404 for unknown/unpublished slugs and a friendly 'temporarily unavailable' page for suspended clients."
Deliverables: any published client's page loads correctly at `/site/{slug}`.

**P1-32 — SEO + caching**
Prompt: "Add per-page `<meta>` tags (title/description/og:image) driven by `LandingPage.seo_meta`, and cache rendered pages (ISR with on-demand revalidation triggered whenever a client saves their page) since content changes infrequently."
Deliverables: correct social-preview metadata; page loads are fast and cache-invalidate on save.

---

### I. Payment Deep-Link Module

**P1-33 — Payment buttons component**
Prompt: "Build a `PaymentButtons` component (used inside themes) that renders one button per configured `PaymentMethod`. If `upi_id` is set, link to `upi://pay?pa=<upi_id>&pn=<business_name>&cu=INR`. Otherwise, show the uploaded QR image large plus a button that opens the relevant app via its native scheme (`tez://`, `phonepe://`, `paytmmp://`), falling back to a 'scan the QR above' hint on desktop."
Deliverables: verified working on a real Android phone for at least GPay + PhonePe.

---

### J. Google Review Integration + Smart Funnel

**P1-34 — Google Sheets read client**
Prompt: "Set up a read-only Google service account, document the setup steps (share the sheet with the service account email), and build a NestJS service wrapping the Sheets API to read a given `sheet_id`/`sheet_range`."
Deliverables: service returns parsed rows given a sheet link.

**P1-35 — Sheet connect + column mapping UI**
Prompt: "Build a settings screen where the client pastes their Google Sheet link and maps columns to reviewer name / rating / comment / date, with a 'test connection' button showing a preview of parsed rows."
Deliverables: client can self-serve connect their sheet without support help.

**P1-36 — Sheet sync job**
Prompt: "Build a scheduled BullMQ job (e.g. every 30 min) that re-reads each client's connected sheet and upserts rows into `ReviewCache`, updating `avg_rating_cached` and `last_synced_at`."
Deliverables: new sheet rows appear on the landing page within one sync cycle.

**P1-37 — Smart review funnel**
Prompt: "Build a 'Rate us' flow on the landing page: tapping it shows a 1–5 star prompt. 4–5 stars redirects straight to the client's Google review link. 1–3 stars shows a private feedback form instead, storing the response in `ReviewFunnelResponse` (never sent publicly)."
Deliverables: both branches tested; low ratings never reach the public review link.

**P1-38 — Reviews display component**
Prompt: "Build a reviews section (avg rating badge + scrollable carousel of recent reviews) reading from `ReviewCache`, used inside theme components."
Deliverables: renders correctly with 0, 1, and many reviews.

---

### K. Social Links

**P1-39 — Social buttons component**
Prompt: "Build a `SocialButtons` component rendering WhatsApp (`wa.me/<number>`), Instagram, and Facebook buttons from `SocialLink` rows, used inside theme components."
Deliverables: each opens the correct app/URL on mobile and desktop.

---

### L. Master QR Generator

**P1-40 — QR generation service**
Prompt: "Build a NestJS service using a QR library to generate a PNG and SVG for a given landing page URL, optionally embedding the client's logo in the center, and upload the result to S3, storing the record in `QrCode` (type=master)."
Deliverables: generated QR reliably scans back to the correct URL even with a logo embedded.

**P1-41 — QR dashboard UI**
Prompt: "Add a 'My QR Code' section in the client dashboard showing the generated QR with PNG/SVG download buttons and the raw landing page URL."
Deliverables: downloads work and match the live page.

**P1-42 — Scan tracking**
Prompt: "Increment `QrCode.scan_count` and log an `AnalyticsEvent` (type=qr_scan) whenever the landing page is loaded via a request that includes a `?src=qr` tag encoded in the QR's target URL."
Deliverables: scan count visible in the dashboard, increments correctly on real scans.

---

### M. CRM (Lite)

**P1-43 — Leads API**
Prompt: "Build a Leads module: public `POST /public/leads` (rate-limited, from the landing page contact form) and client-scoped `GET/PATCH /leads` for listing, updating status (new/contacted/converted/lost), adding notes and tags."
Deliverables: endpoints + tests, public endpoint has no auth but is scoped by slug→client_id.

**P1-44 — Contact form component**
Prompt: "Build a contact form component (name, phone, optional message) inside theme components, posting to `/public/leads`."
Deliverables: submitting creates a `Lead` row with `source=contact_form`.

**P1-45 — CRM dashboard UI**
Prompt: "Build a CRM screen in the client dashboard: filterable/sortable lead list, status pipeline dropdown, notes/tags editor, and CSV export."
Deliverables: fully functional lead management screen.

---

### N. Analytics (baseline)

**P1-46 — Event capture endpoint**
Prompt: "Build `POST /public/events` accepting `event_type` (page_view/button_click/qr_scan) + minimal metadata (no PII, no IP storage beyond a hashed value for basic dedup), rate-limited and slug-scoped."
Deliverables: events land in `AnalyticsEvent`.

**P1-47 — Basic analytics widget**
Prompt: "Add a small stats card to the client dashboard: page views and button clicks for today / last 7 days / last 30 days."
Deliverables: numbers match raw `AnalyticsEvent` counts.

---

### O. Notifications

**P1-48 — Transactional email**
Prompt: "Integrate an email provider (Postmark/SES/SMTP) and send: client-approved email, invoice-receipt email, password-reset email. Use templated HTML emails."
Deliverables: all three emails send correctly in a staging environment.

---

### P. QA

**P1-49 — Core unit tests**
Prompt: "Write unit tests for the Auth module, RBAC guards, and the billing webhook handler covering success + failure + malicious-input cases."
Deliverables: meaningful coverage on the highest-risk modules (auth, money, tenant isolation).

**P1-50 — End-to-end happy path**
Prompt: "Write an E2E test (Playwright) covering: client signs up → pays (Razorpay test mode) → gets approved → completes onboarding → landing page is live → payment button opens correct deep link → contact form creates a lead."
Deliverables: this test passes in CI on every PR.

---

### Q. Deployment

**P1-51 — Dockerfiles**
Prompt: "Write production Dockerfiles for `apps/api`, `apps/admin`, `apps/landing` (multi-stage builds, minimal final images)."
Deliverables: each image builds and runs standalone.

**P1-52 — Production compose + Nginx**
Prompt: "Write `docker-compose.prod.yml` plus an Nginx config reverse-proxying to all three apps, terminating SSL via Let's Encrypt (Certbot)."
Deliverables: one-command production stack on a fresh VPS.

**P1-53 — Deploy pipeline**
Prompt: "Extend CI to build and push images on merge to `main`, then deploy to the target server (SSH + compose pull/up, or a managed platform of choice)."
Deliverables: merging to `main` results in a live deploy.

---

## Phase 2 — Reviews, Analytics, Feature Gating

**P2-01 — Full sheet sync hardening**
Prompt: "Harden the Sheets sync job from P1-36: handle malformed rows, rate-limit against Google's API quota, alert (email/log) on repeated sync failures per client."

**P2-02 — Funnel analytics**
Prompt: "Add a dashboard widget showing the review funnel conversion: total ratings given, split 4–5★ vs 1–3★, and how many 4–5★ actually clicked through to Google."

**P2-03 — Full analytics dashboards**
Prompt: "Build time-series charts (page views, button clicks, QR scans) for both the client dashboard and a platform-wide Super Admin view, with date-range filters."

**P2-04 — Plan-based feature gating**
Prompt: "Build a `PlanGuard` that checks `Plan.features_json` against the action being attempted (theme switch beyond `max_themes`, custom domain when not allowed, analytics access) and returns a clear 'upgrade your plan' response; reflect locked features visually in the UI."

**P2-05 — Super Admin billing reports**
Prompt: "Build MRR, active/suspended/churned client counts, and revenue-over-time reports for Super Admin, computed from `Subscription`/`Invoice`."

**P2-06 — Theme catalog expansion**
Prompt: "Add 5+ additional themes across new categories (e.g. Restaurant, Salon, Retail, Services, Professional), each following the P1-26 schema, and build an internal process/checklist for adding future themes without code changes to the renderer."

---

## Phase 3 — Growth Features

**P3-01 — Custom domain mapping**
Prompt: "Let a client (on an eligible plan) add a custom domain: verify ownership via a CNAME/TXT record check, provision SSL automatically (Let's Encrypt), and route incoming requests by hostname to the correct `client_id` in `apps/landing`."

**P3-02 — vCard save-contact**
Prompt: "Add a 'Save Contact' button generating a `.vcf` file from the client's business info (name, phone, address, website) for one-tap add-to-contacts."

**P3-03 — Printable poster generator**
Prompt: "Build a PDF generator producing a print-ready poster/table-tent (business name, QR code, 'Scan to Pay / Review Us' copy) downloadable from the client dashboard."

**P3-04 — Multi-language landing pages**
Prompt: "Extend `content_json` to be keyed by locale, add a language switcher to themes, and let clients fill in content per supported language."

**P3-05 — WhatsApp-click lead tracking**
Prompt: "Log an `AnalyticsEvent` and optionally a `Lead` (source=whatsapp_click) whenever a visitor taps the WhatsApp button, without requiring any WhatsApp API access."

---

## Phase 4 — Team & Scale

**P4-01 — Client staff accounts**
Prompt: "Add `client_staff` as an invitable sub-role per client with restricted permissions (e.g. CRM-only access, no billing/theme access), including an invite-by-email flow."

**P4-02 — CRM pipeline board**
Prompt: "Add a kanban-style board view of `Lead` statuses (drag-and-drop between new/contacted/converted/lost) alongside the existing list view."

**P4-03 — White-label options**
Prompt: "Add a premium option to remove QRHub branding from the landing page footer and allow a custom login page per client (for agencies reselling the platform)."

**P4-04 — Outbound integrations**
Prompt: "Build outbound webhooks (new lead, new review, subscription event) so clients can connect Zapier/Make or their own systems."

---

## How to use this file

Work phase by phase. Within Phase 1, sections A→Q are in dependency order — don't start the Theme Engine before Auth exists, don't start Onboarding before the Theme Engine exists, etc. Hand any single task's **Prompt** line to a developer or an AI coding agent as-is; it's scoped to be buildable and testable on its own.
