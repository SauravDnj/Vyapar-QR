# QRHub on Vercel — all three apps, no database server

This is the **all-Vercel** deploy: `apps/api`, `apps/admin` and `apps/landing`
each become a Vercel project, and the data lives in JSON documents rather than
in MySQL. No VPS, no Docker, no database server to run or pay for.

For the VPS/PM2 path (which still works, and gives stronger write concurrency
and exact rate limits), see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## What changed, and why

**The database is JSON documents — one file per model.** The engine lives in
[`apps/api/src/jsondb`](../apps/api/src/jsondb/README.md) and implements the
slice of the Prisma API the codebase used, so no service or controller changed.

**The JSON files live in Vercel Blob, not on disk.** This is the one part that
cannot be a plain local file. A Vercel serverless function has a **read-only
filesystem** apart from `/tmp`, which is per-instance and wiped between
invocations. A signup written to a local file would be gone on the next
request. Blob keeps the same one-JSON-file-per-model layout while actually
persisting, and it is on Vercel's free tier.

**Background jobs run on Vercel Cron.** The five recurring sweeps used BullMQ,
which needs a long-lived Redis worker that serverless has nowhere to run. They
are now HTTP endpoints (`/internal/cron/*`) that Vercel Cron calls on a
schedule. Both paths call the same service methods.

**Rate limiting falls back to per-instance memory.** Without Redis the limit is
`limit x live instances` rather than globally exact. Set `REDIS_URL` (e.g. a
free Upstash database from the Vercel Marketplace) to restore exact limits.

---

## Prerequisites

- A Vercel account, and the CLI: `npm i -g vercel`, then `vercel login`
- This repo pushed to a Git remote (GitHub/GitLab/Bitbucket) if you want
  deploy-on-push; the CLI path below works without one

> **You have to run the deploy commands yourself.** They authenticate against
> your Vercel account, so they cannot be run on your behalf.

---

## Step 1 — Create the API project

From the repo root:

```bash
cd apps/api
vercel link          # create a new project, e.g. "qrhub-api"
```

`apps/api/vercel.json` already declares the build, the function entrypoint and
the five cron schedules.

### Add a Blob store

In the Vercel dashboard: **Storage → Create → Blob**, then connect it to the
`qrhub-api` project. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically —
you do not set it by hand.

### Set the environment variables

```bash
cd apps/api

# Database
vercel env add JSONDB_DRIVER production        # blob
vercel env add JSONDB_CACHE_TTL_MS production  # 0

# Uploads (logos, payment QR images, generated QR codes)
vercel env add STORAGE_DRIVER production       # blob

# Jobs
vercel env add JOBS_DRIVER production          # cron
vercel env add CRON_SECRET production          # a long random string

# Auth — generate each with: openssl rand -base64 48
vercel env add JWT_ACCESS_SECRET production
vercel env add JWT_REFRESH_SECRET production
vercel env add JWT_ACCESS_EXPIRES_IN production   # 15m
vercel env add JWT_REFRESH_EXPIRES_IN production  # 7d

# URLs — fill in once the admin/landing projects exist (Step 2)
vercel env add CORS_ORIGINS production         # https://admin...,https://landing...
vercel env add ADMIN_APP_URL production
vercel env add LANDING_APP_URL production
vercel env add API_PUBLIC_URL production

vercel env add NODE_ENV production             # production
```

`CRON_SECRET` is what protects `/internal/cron/*`. Vercel Cron sends it
automatically as `Authorization: Bearer $CRON_SECRET`. **If it is unset the
endpoints refuse every request** — they fail closed rather than leaving the
sweeps callable by anyone who guesses the path.

Everything else (Razorpay, Groq, Google, MSG91, SMTP…) is listed in
[`apps/api/.env.example`](../apps/api/.env.example). The app boots without
them; the features that need them stay off.

### Deploy

```bash
vercel --prod
```

---

## Step 2 — Create the admin and landing projects

```bash
cd apps/admin
vercel link                                  # "qrhub-admin"
vercel env add NEXT_PUBLIC_API_URL production   # https://qrhub-api.vercel.app
vercel --prod

cd ../landing
vercel link                                  # "qrhub-landing"
vercel env add NEXT_PUBLIC_API_URL production
vercel --prod
```

Then go back and fill in the API's `CORS_ORIGINS`, `ADMIN_APP_URL`,
`LANDING_APP_URL` and `API_PUBLIC_URL` with the real URLs, and redeploy the
API. A wrong `CORS_ORIGINS` is the classic failure here: every admin call dies
as an opaque "Failed to fetch" in the browser with nothing in the API logs.

> **Monorepo setting:** in each project's dashboard, set **Root Directory** to
> `apps/api`, `apps/admin` or `apps/landing`. Each app's `vercel.json` already
> builds `@qrhub/types` first, which the apps import at runtime.

---

## Step 3 — Seed the database

The store starts empty — no super admin, no plans, no themes. Seed it against
the Blob store by running the seed locally with production credentials:

```bash
cd apps/api
vercel env pull .env.production.local        # pulls BLOB_READ_WRITE_TOKEN

JSONDB_DRIVER=blob \
NODE_ENV=production \
SEED_SUPER_ADMIN_EMAIL="you@yourdomain.com" \
SEED_SUPER_ADMIN_PASSWORD="a-strong-password" \
pnpm db:seed
```

Seeding **refuses to run** with the built-in default password when
`NODE_ENV=production`, so a live deploy cannot end up with published
credentials. It is idempotent — re-running backfills new plan feature flags and
theme schemas without touching prices a Super Admin has edited.

---

## Step 4 — Verify

```bash
API=https://qrhub-api.vercel.app

curl -s -o /dev/null -w "%{http_code}\n" $API/                    # 200

curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@yourdomain.com","password":"a-strong-password"}'
# -> { "user": { "role": "super_admin" }, "accessToken": "..." }

TOKEN=<paste accessToken>
curl -s $API/admin/plans -H "Authorization: Bearer $TOKEN"        # 3 plans
curl -s $API/admin/themes -H "Authorization: Bearer $TOKEN"       # 13 themes

# a cron job, by hand
curl -s -X POST $API/internal/cron/review-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Then in the browser: open the admin URL, log in as the super admin, register a
second account, complete onboarding, and confirm the client appears under
**Super Admin → Clients**.

Cron runs show up under **Project → Settings → Cron Jobs**.

---

## Cron schedule

Declared in `apps/api/vercel.json`:

| Job | Schedule | What it does |
|---|---|---|
| `grace-period` | `0 3 * * *` | Suspends clients past the billing grace period |
| `lead-follow-up` | `0 10 * * *` | Sends follow-up nudges on stale leads |
| `booking-reminder` | `0 * * * *` | Reminds customers of upcoming bookings |
| `review-sync` | `0 4 * * *` | Pulls Google reviews for configured clients |
| `weekly-digest` | `0 9 * * 1` | Weekly summary to published clients |

Vercel's Hobby plan allows a limited number of cron jobs and runs them at most
daily; the hourly `booking-reminder` needs a paid plan to fire hourly.

---

## Limits you are accepting

Worth reading before putting real customers on this.

**Concurrent writes can clobber.** Two serverless instances writing the same
collection at the same moment is last-write-wins. Within one instance writes
are serialised and safe. At QRHub's write volume (signups, leads, orders) a
collision is unlikely but not impossible — it is the main reason to move to a
real database as you grow.

**`$transaction` does not roll back.** A failure part-way through a multi-write
sequence leaves the earlier writes applied.

**Whole-collection reads.** Each query loads the collection's JSON file. That
is fine for hundreds or a few thousand rows per model. Once `analyticsEvent`
reaches tens of thousands of rows, reads get slow — that collection grows
fastest, so watch it first.

**Rate limits are per-instance** without `REDIS_URL`.

**Cold starts.** The first request after idle builds the Nest app (~200ms
locally; slower on Vercel). Warm requests are unaffected.

### When to move off JSON

Add a real database when any of these is true: a collection passes ~10k rows,
you see write collisions, or you need real transactions. Because everything
goes through the `PrismaService` delegate API, the migration is to write one
new client — the services above it stay unchanged, exactly as they did for this
swap.

---

## Troubleshooting

**Every admin request fails with "Failed to fetch."** `CORS_ORIGINS` on the API
doesn't exactly match the admin origin. It is a comma-separated list of full
origins, no trailing slash.

**Writes vanish between requests.** `JSONDB_DRIVER` is not `blob`, or no Blob
store is connected, so writes are going to the ephemeral `/tmp` filesystem.
Check `BLOB_READ_WRITE_TOKEN` is present in the project's env.

**Cron returns 403.** `CRON_SECRET` is unset or differs from what Vercel sends.

**`Cannot find module '@qrhub/types'`.** The build didn't build the workspace
package first. Each `vercel.json` runs `pnpm --filter @qrhub/types build`
ahead of the app build; confirm the project's Root Directory is set correctly.

**DI errors like `Nest can't resolve dependencies`.** The function is loading
TypeScript compiled without decorator metadata. `api/index.js` deliberately
requires the tsc-built `dist/` output for this reason — don't change it to
import from `src/`.
