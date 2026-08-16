# QRHub — Full Production Deployment Guide

This is the complete, step-by-step path to a live production deployment:
**Vercel** for the two Next.js apps, a **database** for MySQL, and a **VPS**
for the NestJS API. No Docker anywhere in this path.

**Read this first — why the API and database aren't "on Vercel":** Vercel
runs serverless functions with a request-scoped lifetime. QRHub's API is a
long-running NestJS process with BullMQ background workers (grace-period
sweeps, review sync, booking reminders, digest emails, lead follow-ups) that
need to keep running between requests — that doesn't fit Vercel's model.
Vercel also has no built-in MySQL hosting (this schema is MySQL, not
Postgres). So the split is: **Vercel hosts the two frontends** (`apps/admin`,
`apps/landing`), and **a VPS hosts the API + MySQL + Redis** together. This
was an explicit decision made earlier in this project, not a limitation of
this guide — see §2 below if you want the database on its own managed host
instead of the same VPS.

---

## Architecture at a glance

```
                    ┌─────────────────────┐
   Browser ───────► │  apps/admin (Vercel) │  dashboard UI
                    └──────────┬───────────┘
                               │ HTTPS (NEXT_PUBLIC_API_URL)
                               ▼
                    ┌─────────────────────┐        ┌──────────┐
                    │   apps/api (VPS,     │◄──────►│  MySQL   │
   Browser ───────► │   PM2 + Nginx)       │        └──────────┘
                    └──────────┬───────────┘        ┌──────────┐
                               │                     │  Redis   │
                    ┌──────────┴───────────┐ ◄──────►└──────────┘
   Browser ───────► │ apps/landing (Vercel) │  public pages
                    └───────────────────────┘
```

- **`apps/admin`** — Super Admin + Client dashboard. Talks to the API over HTTPS.
- **`apps/landing`** — public `/site/:slug` pages, ISR-cached, revalidated on-demand by the API.
- **`apps/api`** — NestJS, everything else: auth, billing, QR generation, WhatsApp/AI, BullMQ workers.
- **MySQL** — all persistent data (17+ tables, Prisma-managed).
- **Redis** — BullMQ job queue + rate-limit storage.

---

## Prerequisites

- A Vercel account (free tier is enough to start).
- A VPS (any Ubuntu 22.04/24.04 box — DigitalOcean, Hetzner, Linode, AWS
  Lightsail, etc. 1 vCPU / 1–2GB RAM is enough for a small deployment).
- A domain you control, with DNS you can edit (e.g. `yourdomain.com`) — you'll
  point `app.yourdomain.com` at Vercel (admin), your public pages at Vercel
  (landing, or client custom domains), and `api.yourdomain.com` at the VPS.
- This repo pushed to a GitHub repository (required for both Vercel's git
  integration and the GitHub Actions deploy workflow already in this repo).

---

## Step 1 — Push this repo to GitHub

If you haven't already:

```bash
# from the repo root — it's already a local git repo with an initial commit
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

Vercel and the CI/CD workflow below both need this.

---

## Step 2 — Database (MySQL)

Pick **one** of these. Option A is what this repo's scripts assume by
default; Option B is a drop-in replacement — only `DATABASE_URL` changes.

### Option A (default, simplest): MySQL on the same VPS as the API

Fewer moving parts, zero extra cost, and it's what `deploy/scripts/deploy-api.sh`
and `docs/DEPLOYMENT.md`'s original setup already assume. Installed as part
of the VPS setup in Step 3 below — nothing extra to do here.

### Option B: a managed MySQL host (separate from the VPS)

Worth it if you want automated backups/scaling without managing MySQL
yourself. Any managed MySQL works since it's just a `DATABASE_URL` — two
good options:

- **PlanetScale** (serverless MySQL, generous free tier, listed in the
  [Vercel Marketplace](https://vercel.com/marketplace) if you want to
  provision it from the Vercel dashboard) — create a database, get its
  connection string from Dashboard → your DB → Connect → Prisma.
- **DigitalOcean / AWS RDS / Aiven Managed MySQL** — create an 8.x instance,
  allow inbound connections from your VPS's IP, copy the connection string.

Either way you end up with one connection string, e.g.:
```
DATABASE_URL="mysql://user:password@your-db-host:3306/qrhub_prod?sslaccept=strict"
```
Use that instead of the local `mysql://root:...@localhost:3306/qrhub_dev`
value in Step 3's `.env`. (PlanetScale/most managed hosts require SSL —
add `?sslaccept=strict` or your provider's equivalent param.)

---

## Step 3 — VPS setup (`apps/api` + Redis + MySQL if using Option A)

SSH into your VPS, then:

```bash
# Node 20+, pnpm, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pnpm@11.2.2 pm2

# MySQL and Redis — installed natively, not via Docker
# (skip mysql-server here if you're using Option B above)
sudo apt-get install -y mysql-server redis-server
sudo systemctl enable --now mysql redis-server

# Create the production database (skip if using a managed host — it
# already has a database for you)
sudo mysql -e "CREATE DATABASE qrhub_prod; CREATE USER 'qrhub'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD'; GRANT ALL ON qrhub_prod.* TO 'qrhub'@'localhost'; FLUSH PRIVILEGES;"

# Clone the repo
git clone https://github.com/<you>/<repo>.git ~/qrhub
cd ~/qrhub

# Real production env
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

**Fill in `apps/api/.env` for production.** At minimum:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://qrhub:CHANGE_ME_STRONG_PASSWORD@localhost:3306/qrhub_prod` (or your Step 2 Option B string) |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Generate real random secrets — **never** the `dev-...-change-me` placeholders (`openssl rand -base64 48`) |
| `ADMIN_APP_URL` | `https://app.yourdomain.com` (your Vercel admin URL/custom domain) |
| `LANDING_APP_URL` | `https://yourdomain.com` (your Vercel landing URL/custom domain) |
| `API_PUBLIC_URL` | `https://api.yourdomain.com` |
| `CORS_ORIGINS` | `https://app.yourdomain.com,https://yourdomain.com` |
| `REVALIDATE_SECRET` | A real random string — must match the same var set on the `apps/landing` Vercel project below |

Everything else in `.env.example` (Razorpay, Google service account, WhatsApp,
Groq, SMTP, MSG91, Apple/Google Wallet, Vercel API token) is optional —
leave blank to ship without that integration; each one degrades gracefully
(logs "not configured", never crashes). See the **Environment variable
reference** table at the bottom of this file for what each unlocks.

> **Note on file uploads:** logos, payment QR images, and generated QR codes
> currently save to local disk on the VPS (`apps/api/uploads`, served at
> `/uploads/*`) — there's no S3/cloud storage wired up yet despite the
> `S3_*` variables present in `.env.example` (they're reserved for a future
> swap, not implemented). Back up `apps/api/uploads` along with your
> database, and know that redeploying to a *different* VPS means copying
> that folder over too.

Then build and start it:

```bash
pnpm install --frozen-lockfile
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build

cd apps/api
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow its printed instructions so it survives a reboot
```

> **Verify it actually started** — check `pm2 logs qrhub-api --lines 50` for
> `Nest application successfully started`, then `curl localhost:4100/themes`
> should return real JSON. If PM2 shows the process endlessly restarting,
> `pm2 logs` will show why — the most common cause is `DATABASE_URL`/
> `REDIS_URL` not actually reachable from the VPS.

### Nginx + SSL for the API

```bash
sudo cp deploy/nginx/qrhub-api.conf /etc/nginx/sites-available/qrhub-api.conf
sudo nano /etc/nginx/sites-available/qrhub-api.conf   # replace api.yourdomain.com with your real domain
sudo ln -s /etc/nginx/sites-available/qrhub-api.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com   # rewrites the conf with a real SSL block
```

Point `api.yourdomain.com`'s DNS A record at your VPS's IP **before**
running `certbot`, or the certificate challenge will fail.

**Redeploying later** (after pushing new code): `deploy/scripts/deploy-api.sh`
does pull → install → migrate → build → `pm2 startOrReload` in one
zero-downtime step. Run it directly on the VPS (`bash deploy/scripts/deploy-api.sh`),
or let CI trigger it over SSH — see Step 5.

---

## Step 4 — Vercel (`apps/admin` and `apps/landing`)

Each app already has its own `vercel.json` with a monorepo-aware
install/build command, so Vercel only needs pointing at the right subfolder.

1. In the [Vercel dashboard](https://vercel.com/new), **Add New → Project**,
   import your GitHub repo — do this **twice**, once per app.
2. **Project 1 (admin):**
   - Root Directory: `apps/admin`
   - Framework Preset: Next.js (auto-detected)
   - Environment Variables:
     | Key | Value |
     |---|---|
     | `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |
     | `NEXT_PUBLIC_LANDING_APP_URL` | `https://yourdomain.com` |
   - Deploy. Once live, add a custom domain (Settings → Domains), e.g. `app.yourdomain.com`.
3. **Project 2 (landing):**
   - Root Directory: `apps/landing`
   - Environment Variables:
     | Key | Value |
     |---|---|
     | `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |
     | `REVALIDATE_SECRET` | Same value you put in the API's `.env` above |
   - Deploy. Add your root domain here, e.g. `yourdomain.com`.
4. Go back to the API's `.env` on the VPS and double check `ADMIN_APP_URL`/
   `LANDING_APP_URL`/`CORS_ORIGINS` match these real Vercel domains exactly
   (including `https://`, no trailing slash), then `pm2 restart qrhub-api`.
5. Note each project's **Project ID** and your **Org/Team ID**
   (Settings → General) — needed for CI secrets in Step 5.

**Sanity check:** open `https://app.yourdomain.com/login`, log in, and
confirm the dashboard loads real data (not a CORS/network error in the
browser console) — that confirms `NEXT_PUBLIC_API_URL`/`CORS_ORIGINS` are
wired correctly end to end.

---

## Step 5 — CI/CD (optional but recommended)

`.github/workflows/deploy.yml` already exists in this repo — it runs after
`.github/workflows/ci.yml` succeeds on `main` (or manually via the Actions
tab). Three parallel jobs: deploy admin to Vercel, deploy landing to Vercel,
SSH into the VPS and run `deploy-api.sh`.

Add these secrets under **GitHub repo → Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Either Vercel project → Settings → General |
| `VERCEL_PROJECT_ID_ADMIN` | `apps/admin` project → Settings → General |
| `VERCEL_PROJECT_ID_LANDING` | `apps/landing` project → Settings → General |
| `VPS_HOST` | Your VPS's IP or hostname |
| `VPS_USER` | SSH user on the VPS (e.g. `deploy`) |
| `VPS_SSH_KEY` | Private half of a **deploy-only** SSH key pair — put the public half in the VPS's `~/.ssh/authorized_keys` |
| `VPS_APP_DIR` | Absolute path to the cloned repo on the VPS, e.g. `/home/deploy/qrhub` (optional, defaults to `$HOME/qrhub`) |

Without these secrets configured, deploys just stay manual — push to `main`,
then `git pull && bash deploy/scripts/deploy-api.sh` on the VPS, and Vercel
auto-deploys on push anyway once its GitHub integration is connected in
Step 4 (that part needs no secrets at all).

---

## Step 6 — Custom domains for client landing pages (optional, P3-01)

Once a client is on a `customDomain`-enabled plan, they can point their own
domain at their page (`apps/admin` → Custom Domain screen). Two parts:

1. **Ownership verification** — the client adds a DNS TXT record the app
   gives them; the API checks it via a live DNS lookup. Needs no external
   credentials, works automatically once the API is deployed.
2. **SSL auto-provisioning** — since `apps/landing` is on Vercel, this
   works via Vercel's REST API rather than certbot. Add to the API's `.env`:

   | Var | Value |
   |---|---|
   | `VERCEL_API_TOKEN` | Same token as `VERCEL_TOKEN` above |
   | `VERCEL_LANDING_PROJECT_ID` | Same as `VERCEL_PROJECT_ID_LANDING` above |
   | `VERCEL_TEAM_ID` | Only if the project is under a Vercel team, not a personal account |

   Once ownership verifies, the API registers the domain on the `apps/landing`
   Vercel project automatically; Vercel provisions the cert as soon as the
   client's DNS actually resolves to Vercel (the admin UI shows the exact
   A/CNAME target to give the client once verified). Leave these blank to
   skip auto-registration — you can still add domains manually in the
   Vercel dashboard.

---

## Environment variable reference

**`apps/admin`** (Vercel project env vars):

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL |
| `NEXT_PUBLIC_LANDING_APP_URL` | Yes | Public landing URL |

**`apps/landing`** (Vercel project env vars):

| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL |
| `REVALIDATE_SECRET` | Yes | Must match the API's value |

**`apps/api`** (VPS `.env`) — required for the app to boot at all:

| Var | Notes |
|---|---|
| `PORT`, `NODE_ENV` | `4100` / `production` |
| `DATABASE_URL` | See Step 2 |
| `REDIS_URL` | See Step 3 |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Real random secrets, not the dev placeholders |
| `ADMIN_APP_URL`, `LANDING_APP_URL`, `API_PUBLIC_URL` | Real production URLs |
| `CORS_ORIGINS` | Must list the real admin + landing URLs |
| `REVALIDATE_SECRET` | Must match `apps/landing`'s value |

**`apps/api`** — optional, each unlocks one integration and safely
no-ops/logs "not configured" when blank:

| Feature | Vars |
|---|---|
| Billing (Razorpay) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Live Google reviews | `GOOGLE_PLACES_API_KEY` |
| Google Sheets review sync + feedback log | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` |
| Apple Wallet passes | `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `APPLE_WWDR_CERT`, `APPLE_SIGNING_CERT`, `APPLE_SIGNING_KEY`, `APPLE_CERT_PASSWORD` |
| Google Wallet passes | `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY` |
| SMS alerts (MSG91) | `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` |
| WhatsApp CRM + AI chatbot alerts | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| AI features (chatbot replies, review drafts, digest summaries, onboarding autofill) | `GROQ_API_KEY` |
| Transactional email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| Custom-domain SSL automation | `VERCEL_API_TOKEN`, `VERCEL_LANDING_PROJECT_ID`, `VERCEL_TEAM_ID` |

---

## Post-deploy verification checklist

1. `curl https://api.yourdomain.com/themes` → real JSON array, not an error.
2. `https://app.yourdomain.com/login` → log in as the seeded Super Admin
   (`admin@qrhub.local` / whatever you set — **change this password in
   production**, or better, delete/recreate that account with a real email).
3. Register a fresh client account → complete onboarding → publish →
   confirm the live page loads at `https://yourdomain.com/site/<slug>` (or
   your landing domain).
4. Browser dev tools console on `app.yourdomain.com` → no CORS errors.
5. `pm2 status` on the VPS → `qrhub-api` shows `online`, not endlessly restarting.
6. `pm2 logs qrhub-api --lines 20` → clean, no repeating stack traces.

---

## Known gotchas found while writing this guide

- **`apps/api/ecosystem.config.js` had a real bug, fixed as part of writing
  this guide**: its `script` pointed at `dist/main.js`, which never
  existed — `nest-cli.json` sets `sourceRoot: "src"`, so the real compiled
  entry point is `dist/src/main.js`. If you'd run `pm2 start
  ecosystem.config.js` before this fix, PM2 would have failed to find the
  script immediately. Already corrected in this repo.
- **`nest start --watch` (dev mode) is known to hang** on at least one
  development machine used for this project — irrelevant here since
  production always runs the *built* output (`pnpm --filter api build` +
  `node dist/src/main.js` via PM2), which does not have this problem.
- **Local MySQL/Redis printing a "recommend a newer version" warning** on
  boot is harmless noise, not a failure — ignore it if you see it in logs.
- File uploads are local-disk on the VPS, not S3 — see the note in Step 3.
