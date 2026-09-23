# Vyapar QR on Vercel — all three apps, no database server

> **Live as of 2026-09-07.** This project is deployed and verified:
> API <https://qrhub-api.vercel.app> · Admin <https://qrhub-admin.vercel.app>
> · Landing <https://qrhub-landing.vercel.app>. All three Vercel projects are
> connected to `SauravDnj/Vyapar-QR`, so pushing to `main` redeploys them.

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

**The JSON documents live in Redis, not on disk.** This is the one part
that cannot be a plain local file. A Vercel serverless function has a
**read-only filesystem** apart from `/tmp`, which is per-instance and wiped
between invocations. A signup written to a local file would be gone on the
next request. Redis keeps one JSON document per model (key `jsondb:<model>`),
reached over TCP (`REDIS_URL`) or Upstash's REST API, and is free from the
Vercel Marketplace.
Uploads (logos, payment QR images, generated QR codes) live there too, served
back by the API at `/uploads/<file>`.

> **Why not Vercel Blob?** It was the original store and it failed in
> production on 2026-09-15. Blob is a CDN file store, not a database: every
> read cost a `list()` call plus a fetch of a never-cached URL, which used up
> the Hobby plan's monthly Blob operations in about a week. Vercel then
> **blocked the store** — every read returned 403 "Your store is blocked", and
> every API call touching data (login included) failed with a 500. The Blob
> driver still exists but is no longer the default.

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

> The commands below authenticate against your Vercel account. They have
> already been run for this project — this section is the record of how, and
> what to repeat if you ever recreate the projects.

---

## Step 1 — Create the API project

From the repo root:

```bash
cd apps/api
vercel link          # create a new project, e.g. "vyaparqr-api"
```

`apps/api/vercel.json` already declares the build, the function entrypoint, an
empty `public/` output directory (Vercel demands one even for a functions-only
project) and the cron schedule.

### Add a Redis database

In the Vercel dashboard: **vyaparqr-api → Storage → Create Database**, pick a free
Redis, and connect it to the project for all environments. Either kind works:

- **Redis** (Redis Cloud) injects `REDIS_URL` and is used over TCP. **This is
  what the live project uses** (connected 2026-09-15).
- **Upstash for Redis** injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` and is
  used over HTTP. Preferred when both are present.

You do not set these by hand. `REDIS_URL` would normally also switch on BullMQ
and the Redis rate limiter; `JOBS_DRIVER=cron` keeps both off, which is right
for serverless.

### Set the environment variables

```bash
cd apps/api

# Database
vercel env add JSONDB_DRIVER production        # redis
vercel env add JSONDB_CACHE_TTL_MS production  # 0

# Uploads (logos, payment QR images, generated QR codes)
vercel env add STORAGE_DRIVER production       # redis

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
> builds `@vyaparqr/types` first, which the apps import at runtime.

---

## Step 3 — Seed the database

The store starts empty — no super admin, no plans, no themes. Seed it against
Redis by running the seed locally with production credentials:

```bash
cd apps/api
vercel env pull .env.production.local        # pulls REDIS_URL (or KV_REST_API_*)
set -a && . ./.env.production.local && set +a

JSONDB_DRIVER=redis \
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

## Custom domains, and the Cloudflare trap that took the API down

Each app takes its own hostname (`vercel domains add <host> <project>`), then a
`CNAME` to `cname.vercel-dns.com` at the DNS provider. Vercel issues the
certificate; if the domain sits there unserved for a while, `vercel certs issue
<host>` does it on demand.

**Keep the API on a hostname one label deep, or leave it on its `.vercel.app`
address.** Behind Cloudflare's proxy (the orange cloud), the free Universal SSL
certificate covers `example.com` and `*.example.com` — one label, no more. A
two-label API host like `api.app.example.com` then fails its TLS handshake, the
admin's login fetch dies before it reaches any server, and the sign-in page can
only say "Something went wrong": no status code ever came back. The ways out,
in order of least work:

1. Set that DNS record to **DNS only** (grey cloud) so it goes straight to
   Vercel, which has a valid certificate for it.
2. Use a one-label host (`api-app.example.com`).
3. Keep the API on its `.vercel.app` address — what this deployment does.

Whatever the API's address is, it belongs in three places that must agree:
`NEXT_PUBLIC_API_URL` (admin and landing, read at build time — a change needs a
redeploy) and `API_PUBLIC_URL` (the API itself, which builds upload and QR
redirect URLs from it). `CORS_ORIGINS` must list the admin and landing origins,
and may list both the old and new ones during a move.

---

## Cron schedule

Vercel's Hobby plan runs cron jobs **at most once a day** and caps how many a
project may have — five separate schedules are rejected at deploy time. So
`apps/api/vercel.json` declares a single daily job that fans out:

| Job | Schedule | Runs |
|---|---|---|
| `/internal/cron/all` | `0 3 * * *` | all five sweeps, in sequence |

The sweeps it runs: `grace-period` (suspends clients past the billing grace
period), `lead-follow-up`, `booking-reminder`, `review-sync`, `weekly-digest`.
A failure in one is recorded and the rest still run.

Each is also individually callable — `POST /internal/cron/review-sync` — for
manual triggering. **On a Pro plan**, replace the single `crons` entry with
five, one per job, to give each its own schedule (e.g. `booking-reminder` on
`0 * * * *`).

---

## Limits you are accepting

Worth reading before putting real customers on this.

**Concurrent writes can clobber.** Two serverless instances writing the same
collection at the same moment is last-write-wins. Within one instance writes
are serialised and safe. At Vyapar QR's write volume (signups, leads, orders) a
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

**Free Redis is small.** Each collection read or write is one Redis command, so
command volume is not the constraint — memory is (Redis Cloud's free database
is 30 MB). The seeded data is ~1 MB, but uploaded images are stored in Redis
too (up to 5 MB each), so a handful of large uploads can fill it. Watch usage
under **Storage** in the Vercel dashboard, and upgrade the database before
putting many real businesses on it.

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

**Login (and everything else) returns 500 "Internal server error".** Check the
function logs (`vercel logs qrhub-api.vercel.app`). `Blob read failed ... last
status 403` means the project is still on the `blob` driver and Vercel has
blocked the store for exceeding Hobby limits — switch `JSONDB_DRIVER` and
`STORAGE_DRIVER` to `redis` as above. `Redis store is not configured`, `WRONGPASS`
or a connection timeout means the Redis database isn't connected to the
project (check `REDIS_URL` is listed under its environment variables).

**Writes vanish between requests.** `JSONDB_DRIVER` is `local`, so writes are
going to the ephemeral `/tmp` filesystem. Set it to `redis`.

**Cron returns 403.** `CRON_SECRET` is unset or differs from what Vercel sends.

**`Cannot find module '@vyaparqr/types'`.** The build didn't build the workspace
package first. Each `vercel.json` runs `pnpm --filter @vyaparqr/types build`
ahead of the app build; confirm the project's Root Directory is set correctly.

**DI errors like `Nest can't resolve dependencies`.** The function is loading
TypeScript compiled without decorator metadata. `api/index.js` deliberately
requires the tsc-built `dist/` output for this reason — don't change it to
import from `src/`.
