# QRHub — UI/UX Design Specification

Companion to [`PLAN.md`](./PLAN.md) and [`TASKS.md`](./TASKS.md). This document specifies the actual screens, navigation, layout, and components for all three surfaces: the **Super Admin dashboard**, the **Client dashboard**, and the **public landing page** visitors see after scanning a QR code. Everything here is responsive by default — desktop sidebar layouts collapse to a mobile drawer, tables scroll horizontally, stat grids reflow to one column.

---

## 1. Design System

| Token | Value | Use |
|---|---|---|
| Base font | System UI sans (`-apple-system, Segoe UI, Roboto...`) | All body text, headings |
| Data font | System monospace (`SF Mono, Consolas...`) | Nav labels, stat numbers, table headers, badges — gives the "code/data" feel that fits a QR product |
| Accent | Teal `#0E7C66` (light) / `#2FBB9C` (dark) | Primary buttons, active nav state, links |
| Semantic colors | Success green, warning amber, danger red, info blue — each with a soft background tint for badges | Status indicators only, never used as decoration |
| Radius | 6px (buttons/inputs), 10px (cards), 16px (large panels) | Consistent, not oversized/bubbly |
| Elevation | 1 soft shadow value for cards/modals only | Flat design otherwise — no gratuitous shadows |

**Core components used everywhere:** sidebar nav item, topbar, stat card (label + big tabular number + up/down delta), data table (sortable header, status badge column, row actions), badge (colored pill with dot), card, form field (label + input), tab bar, plan/theme card, accordion section.

**Theming:** every screen supports light and dark mode automatically via CSS tokens — no screen is designed for only one theme.

---

## 2. Super Admin Dashboard

### 2.1 Navigation (left sidebar)

```
QRHub · Super Admin
─────────────────────
 PLATFORM
 ▸ Overview
 ▸ Clients
 ▸ Plans & Pricing
 ▸ Theme Catalog
 FINANCE
 ▸ Billing Reports
 SYSTEM
 ▸ Settings
─────────────────────
 [Log out]
```

Topbar (every page): breadcrumb + page title on the left, search box, notification bell, avatar on the right. On screens < 900px, the sidebar becomes a slide-in drawer opened by a hamburger button.

### 2.2 Overview (home)

Purpose: one glance at platform health.

```
┌─ Active clients ─┐ ┌─ MRR ─────┐ ┌─ Pending approvals ─┐ ┌─ Churn (30d) ─┐
│ 1,284  ▲+42      │ │ ₹9.86L ▲  │ │ 17  ▼-3             │ │ 1.8%  ▼-0.4pt │
└───────────────────┘ └───────────┘ └─────────────────────┘ └───────────────┘

Approval queue                                          [View all clients →]
┌────────────────────────────────────────────────────────────────────────┐
│ Business            Owner          Plan   Submitted   Status   Action   │
│ Spice Route Kitchen  Rohit Verma   Pro    12 Aug      Pending  Approve/Reject │
│ Glow Salon & Spa      Anita K.      Starter 11 Aug     Pending  Approve/Reject │
└────────────────────────────────────────────────────────────────────────┘
```

4 stat tiles (auto-reflow 4→2→1 columns on narrow screens) + a live approval-queue table with inline Approve/Reject actions, so the most time-sensitive task is one click away without navigating.

### 2.3 Clients

Purpose: manage every business on the platform.

- Tab bar filters: **All / Pending / Active / Suspended**, each showing a live count.
- Search + "Add client" button in the header.
- Table columns: Business (name + subdomain), Plan, Scans (30d), Joined date, Status badge, Action button (Review / Manage / Reinstate depending on state).
- Clicking a row's action opens a detail drawer (not a separate page) with full business info, approve/reject/suspend controls, and an audit-log tail for that client.

### 2.4 Plans & Pricing

Purpose: define what's for sale.

- Card grid, one card per plan (Starter / Pro / Business), the recommended plan visually highlighted with an accent border.
- Each card: name, one-line description, price, a checked feature list (theme count, custom domain, analytics, CRM), "Edit plan" button.
- A dashed "+ Add new plan" card at the end of the grid.

### 2.5 Theme Catalog

Purpose: manage what's available in every client's theme picker.

- Tab bar by category (All / Restaurant / Salon & Spa / Retail / Services).
- Grid of theme cards: gradient thumbnail preview, name, category, Live/Draft badge.
- "Add theme" button top-right to onboard a new design.

### 2.6 Billing Reports

Purpose: platform revenue health.

- 3 stat tiles: MRR, Active subscriptions, Failed payments (7d).
- MRR bar chart, last 6 months.
- Recent invoices table: Invoice #, Client, Amount, Date, Status badge.

### 2.7 Settings

Purpose: global platform configuration.

- Single form card: platform name, support email, default trial length (days), grace period after failed payment (days), SMTP connection status, payment gateway status. One "Save settings" action.

---

## 3. Client Dashboard

### 3.1 Navigation (left sidebar)

```
QRHub · [Business Name]
─────────────────────
 YOUR PAGE
 ▸ Dashboard
 ▸ My Landing Page
 ▸ Payment Methods
 ▸ Google Reviews
 GROW
 ▸ Leads (CRM)
 ▸ Analytics
 ACCOUNT
 ▸ Billing
 ▸ Settings
─────────────────────
 [Pro plan · Active]
 [Log out]
```

Same topbar/drawer pattern as Super Admin, scoped entirely to the logged-in client's own data.

### 3.2 Dashboard (home)

Two-column layout (stacks on mobile):

- **Left:** 3 stat tiles (QR scans 30d, new leads, avg. rating) + a recent-activity feed (new lead, review synced, scan count).
- **Right:** a card showing the client's own QR code with PNG/SVG download buttons and their live URL — this is the single most-used action, so it's always visible on the home screen, not buried in a menu.

### 3.3 My Landing Page (the theme editor — the core screen)

This is the most important screen in the product. Layout: **theme strip on top, then a two-column editor+preview below.**

```
Theme:  [ Spice ✓ ]  [ Minimal ]  [ Bold ]  [ + more ]

┌─ Editor (left, ~65%) ──────────────┐  ┌─ Live preview (right, sticky) ─┐
│ ▸ Hero & company info    (open)    │  │  ┌───────────────────────┐    │
│    Business name, tagline,         │  │  │   phone-frame mockup   │    │
│    description, address, hours     │  │  │   showing the theme    │    │
│ ▸ Payment options    → linked page │  │  │   updating live as     │    │
│ ▸ Reviews             → linked page│  │  │   the client edits     │    │
│ ▸ Social links (accordion)         │  │  └───────────────────────┘    │
│ ▸ Contact form & SEO (accordion)   │  │                                │
└─────────────────────────────────────┘  └────────────────────────────────┘
                                                      [Publish changes]
```

- Sections are **accordions** (native expand/collapse) so the client isn't overwhelmed by one giant form — only one concern open at a time.
- Payment and Reviews sections don't duplicate their forms here; they link out to their dedicated pages (§3.4, §3.5) since those have richer, upload-heavy interactions.
- The preview is a **phone-frame mockup**, not a flat webpage — this matters because the real product is consumed on a phone after a QR scan, and showing it any other way would be misleading about how it actually looks.
- Switching themes re-flows the same content into a different visual layout — reinforcing that content and theme are separate concerns.

### 3.4 Payment Methods

Purpose: the no-gateway payment setup, one card per app.

```
┌─ GPay ─────────────┐ ┌─ PhonePe ──────────┐ ┌─ Paytm ────────────┐
│ ● Connected         │ │ ● Connected         │ │ ○ Not set up        │
│ [QR image uploaded] │ │ [QR image uploaded] │ │ [Drop QR image here]│
│ UPI ID (optional):  │ │ UPI ID (optional):  │ │ UPI ID (optional):  │
│ spiceroute@okhdfc.. │ │                     │ │                     │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

Each card: connection-status badge, drag-and-drop QR upload zone, optional UPI ID text field with inline help ("adding this enables true one-tap pay instead of scan-only").

### 3.5 Google Reviews

Two-column layout:

- **Left:** "Connected sheet" card (paste sheet link, map rating/comment columns, "test connection", last-synced timestamp, manual "Sync now" button) + a "Smart review funnel" card showing the split between ratings routed to the public Google review vs. kept as private feedback (as a simple two-number comparison, not an over-built chart).
- **Right:** a scrollable list of recent synced reviews (reviewer name, star rating, comment snippet).

### 3.6 Leads (CRM)

- Tab bar: All / New / Contacted / Converted.
- "Export CSV" button top-right.
- Table: Name, Phone (partially masked), Source badge (Contact form / WhatsApp click / QR scan — each a distinct badge color), Status badge, Notes.
- Clicking a row opens a detail drawer to change status, add notes/tags — no separate page needed for something this lightweight.

### 3.7 Analytics

- Bar chart: page views/scans over the last 7 days.
- 3 supporting stat tiles below the chart: GPay taps, WhatsApp taps, Review clicks — i.e. the numbers that answer "is my QR code actually working," which is the #1 question clients ask.

### 3.8 Billing

- Current plan card (name, price, renewal date, "Change plan" button).
- Invoice table with PDF download per row.

### 3.9 Settings

- Simple account form: owner name, email, password. (Business profile itself lives in My Landing Page → Hero & company info, so it isn't duplicated here.)

---

## 4. Public Landing Page (what the visitor sees)

Rendered full-screen on a phone after the QR scan — designed and reviewed **as a phone screen**, not a desktop webpage shrunk down.

```
┌─────────────────────────────┐
│  9:41                       │  ← native-feeling status bar
│  ┌─────┐                    │
│  │ SR  │  Spice Route       │  ← logo, business name,
│  └─────┘  Kitchen           │    tagline, address & hours
│  Authentic Indian ⋅ 2014    │
│  14 MG Road, Pune           │
│  Open now ⋅ 11am–11pm       │
├─────────────────────────────┤
│  PAY INSTANTLY               │
│  [● GP  Pay with GPay     →]│  ← opens the app directly,
│  [● PP  Pay with PhonePe  →]│    no gateway, no API key
│  [● PT  Pay with Paytm    →]│
├─────────────────────────────┤
│  REVIEWS                     │
│  4.8  ★★★★★  128 reviews    │
│  "Best butter chicken..."    │  ← synced from the client's
│  "Quick service, QR pay..."  │    Google Sheet
│  [        Rate us        ]  │  ← opens the smart funnel
├─────────────────────────────┤
│  GET IN TOUCH                 │
│  [WhatsApp][Instagram][FB]   │
├─────────────────────────────┤
│  SEND A MESSAGE               │
│  [Your name]                  │
│  [Phone number]               │
│  [Message]                    │
│  [         Send          ]   │
├─────────────────────────────┤
│  Powered by QRHub             │
└─────────────────────────────┘
```

**The smart review funnel**, triggered by "Rate us," is a bottom sheet (not a full page navigation, so the visitor never leaves the page):

```
┌─────────────────────────────┐
│  How was your experience?  ✕│
│  ★  ★  ★  ★  ★               │
│                              │
│  → tap 4–5★:                │
│    "Thank you! Redirecting  │
│     to Google to share..."  │
│                              │
│  → tap 1–3★:                │
│    [private feedback box]   │
│    [Send private feedback]  │
└─────────────────────────────┘
```

This is the single most important interaction in the whole product — it protects the business from public bad reviews while still capturing the feedback, and it must feel instant (bottom-sheet slide-up, no page reload).

**Theme variation:** the *content structure* above is identical across every theme; only the *visual system* changes — e.g. a "Minimal" theme uses light backgrounds, soft borders, and a calm accent color, while a "Bold" theme uses a dark background, a brighter accent, and sharper corners. This is what makes the theme-switching feature in §3.3 meaningful: switching themes re-skins the same real content, it doesn't rearrange it.

---

## 5. Responsive Rules (apply to every screen above)

- Sidebar (Admin/Client): fixed 232px on desktop → off-canvas drawer behind a hamburger button below 900px.
- Stat tile grids: `auto-fit, minmax(190px, 1fr)` — naturally goes 4 → 2 → 1 columns.
- Tables: wrapped in a horizontally-scrollable container; never force the page itself to scroll sideways.
- Editor + preview (§3.3): side-by-side above 980px, stacked (editor first, preview below) under it.
- Public landing page: full-width single column always — it's designed mobile-first since that's its only real context (a phone right after a scan).

---

## 6. Build Reference

These screens map directly to the following tasks in `TASKS.md`:
- Super Admin UI → **P1-15** (dashboard shell + Overview/Clients/Plans/Settings), **P1-30** (Theme Catalog)
- Client UI → **P1-11** (auth shell), **P1-20** (Billing), **P1-21/22/23/24/25** (onboarding, which reuses the same editor pattern as §3.3), **P1-29/30** (theme editor + preview), **P1-41** (QR panel), **P1-45** (CRM), **P1-47** (Analytics widget)
- Public landing page → **P1-28** (theme components), **P1-31/32** (renderer), **P1-33** (payment buttons), **P1-37/38** (smart funnel + reviews), **P1-39** (social buttons), **P1-44** (contact form)
