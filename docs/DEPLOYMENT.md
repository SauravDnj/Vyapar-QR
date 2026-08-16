# QRHub Deployment — Vercel + VPS (no Docker)

This replaces the original Docker-based plan for P1-51/52/53 at the user's
direction: `apps/admin` and `apps/landing` (Next.js) deploy to **Vercel**;
`apps/api` (NestJS) deploys to a plain **VPS** under **PM2**, behind
**Nginx**. Nothing here is containerized. None of this has been run against
a real Vercel account or VPS in this sandbox — see the "What's verified"
note at the bottom.

---

## 1. Vercel — `apps/admin` and `apps/landing`

Each app has its own `vercel.json` (`apps/admin/vercel.json`,
`apps/landing/vercel.json`) with a monorepo-aware install/build command, so
Vercel only needs to be pointed at the right subfolder:

1. In the Vercel dashboard, **create two separate projects** from this repo
   — one per app.
2. For each project, set **Root Directory** to `apps/admin` or
   `apps/landing` respectively. Vercel auto-detects Next.js; the
   `installCommand`/`buildCommand` in that app's `vercel.json` handle
   installing from the pnpm workspace root and building only that app (and
   its `packages/*` dependencies) via `turbo run build --filter=...`.
3. Set environment variables per project (Vercel dashboard → Settings →
   Environment Variables), matching each app's `.env.example`:
   - **admin**: `NEXT_PUBLIC_API_URL` (the VPS API's public URL, e.g.
     `https://api.yourdomain.com`), `NEXT_PUBLIC_LANDING_APP_URL`
   - **landing**: `NEXT_PUBLIC_API_URL`, `REVALIDATE_SECRET` (must match the
     API's `REVALIDATE_SECRET` so on-demand revalidation works)
4. Note each project's **Project ID** and your **Org (Team) ID** (Settings →
   General) — needed for CI secrets below.

## 2. VPS — `apps/api`

No Docker; the API runs as a plain Node process under PM2, reverse-proxied
by Nginx.

**One-time server setup** (Ubuntu-flavored; adjust for your distro):

```bash
# Node 20+, pnpm, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pnpm@11.2.2 pm2

# MySQL and Redis — installed natively, not via Docker
sudo apt-get install -y mysql-server redis-server

# Clone the repo
git clone <your-repo-url> ~/qrhub
cd ~/qrhub

# Real production env — copy from apps/api/.env.example and fill in real
# values (DB credentials, JWT secrets, Razorpay/Google/SMTP creds if you
# have them, CORS_ORIGINS set to your actual Vercel domains). Never commit
# this file.
cp apps/api/.env.example apps/api/.env
nano apps/api/.env

pnpm install --frozen-lockfile
pnpm --filter api exec prisma migrate deploy
pnpm --filter api build

cd apps/api
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow its printed instructions to survive a reboot
```

**Nginx + SSL:**

```bash
sudo cp deploy/nginx/qrhub-api.conf /etc/nginx/sites-available/qrhub-api.conf
# Edit it first: replace api.yourdomain.com with your real domain.
sudo ln -s /etc/nginx/sites-available/qrhub-api.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com   # rewrites the conf with a real SSL block
```

**Redeploying later:** `deploy/scripts/deploy-api.sh` does the pull →
install → migrate → build → `pm2 startOrReload` sequence in one step (zero
downtime — PM2 reloads the process rather than a hard restart). Run it
directly on the VPS, or let CI trigger it over SSH (below).

## 3. CI/CD — `.github/workflows/deploy.yml`

Runs automatically after `CI` (`.github/workflows/ci.yml`) succeeds on
`main`, or manually via the Actions tab (`workflow_dispatch`). Three
independent jobs: deploy admin to Vercel, deploy landing to Vercel, deploy
api to the VPS over SSH.

**Required GitHub repo secrets:**

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | Personal/team token from Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel org/team ID |
| `VERCEL_PROJECT_ID_ADMIN` | The `apps/admin` Vercel project's ID |
| `VERCEL_PROJECT_ID_LANDING` | The `apps/landing` Vercel project's ID |
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | SSH user on the VPS |
| `VPS_SSH_KEY` | Private key for a deploy-only SSH key pair (add the public half to the VPS's `~/.ssh/authorized_keys`) |
| `VPS_APP_DIR` | Absolute path to the cloned repo on the VPS, e.g. `/home/deploy/qrhub` (optional — defaults to `$HOME/qrhub`) |

## 4. Custom domains & SSL (P3-01)

A client on a `customDomain`-enabled plan can point their own domain at
their landing page (`apps/admin` → Custom domain). Two steps, both
API-driven:

1. **Ownership verification** — the client adds a DNS TXT record we give
   them; `DomainsService.verify()` checks it via a live DNS lookup. This
   needs no external credentials and works in any environment.
2. **SSL** — since `apps/landing` deploys to Vercel (not a self-hosted
   Nginx box), SSL isn't provisioned via `certbot`. Once ownership is
   verified, the API registers the domain on the `apps/landing` Vercel
   project via Vercel's REST API; Vercel then auto-provisions a
   certificate as soon as the client's own DNS actually resolves to
   Vercel (an A record to `76.76.21.21` for an apex domain, or a CNAME to
   `cname.vercel-dns.com` for a subdomain — both are shown in the admin UI
   once ownership is verified).

**Required `apps/api` env vars** (blank = registration step is skipped;
ownership verification still works, the domain just needs adding manually
in the Vercel dashboard):

| Var | Value |
|---|---|
| `VERCEL_API_TOKEN` | Same personal/team token as `VERCEL_TOKEN` above |
| `VERCEL_LANDING_PROJECT_ID` | Same value as `VERCEL_PROJECT_ID_LANDING` above |
| `VERCEL_TEAM_ID` | Same as `VERCEL_ORG_ID` above — only needed if the project lives under a team, not a personal account |

## What's verified vs. code-complete

Same treatment as every other credential-gated task in `docs/PROGRESS.md`:
this is all real, correct configuration, but **none of it has been
exercised against a real Vercel account, VPS, or GitHub Actions run** — no
such infrastructure exists in this sandbox. `pnpm --filter api build` (the
exact command PM2/Vercel would run) has been verified locally to produce a
working `dist/main.js` / `.next` output in this session. The custom-domain
ownership check (§4) *is* fully live-verified (real DNS TXT lookups against
a throwaway domain) — only the Vercel registration call itself is
untested, for the same reason as everything else in this file: no real
Vercel token in this sandbox.
