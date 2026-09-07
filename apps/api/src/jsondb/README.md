# jsondb — the JSON-document database

QRHub's data layer. One JSON file per model, behind the slice of the Prisma
Client API this codebase actually uses, so the 35 controllers and 41 services
above it did not change when MySQL was removed.

```
db.user.findMany({ where: { role: 'client_admin' }, include: { client: true } })
```

`PrismaService` extends `JsonDbClient`. The name is kept only so injection
sites stay untouched — there is no Prisma and no SQL anywhere in the runtime.

## Why it exists

The deploy target is Vercel. A serverless function there has no database
attached and a read-only filesystem, so the store had to be something that
persists without a server: JSON documents, held in a place that survives.

## Layout

| Path | What it does |
|---|---|
| `schema/parser.ts` | Parses `prisma/schema.prisma` into model/field/relation metadata |
| `generate-types.ts` | Emits `generated/models.ts` — the types the API used to import from `@prisma/client` |
| `drivers/` | Where the JSON lives: `local` (disk), `blob` (Vercel Blob), `memory` (tests) |
| `store.ts` | Collection loading, caching, and serialised writes |
| `query/` | `where` evaluation, ordering, distinct, `select`/`include` projection |
| `delegate.ts` | One model's worth of the Prisma delegate API |
| `client.ts` | Assembles delegates, `$transaction`, driver selection |

`schema.prisma` remains the single source of truth for the shape of the data.
It is parsed at runtime, not compiled away — which is why `dist/prisma/` is
populated by the build (`scripts/copy-schema.js`).

## Storage drivers

Selected by `JSONDB_DRIVER`, defaulting to `blob` on Vercel and `local`
elsewhere.

- **`local`** — `data/jsondb/<model>.json`. Writes go to a temp file and are
  renamed into place, so a crash mid-write leaves the previous file intact.
- **`blob`** — Vercel Blob. **Required on Vercel:** the serverless filesystem
  is read-only apart from `/tmp`, which is per-instance and wiped between
  invocations, so a local write would vanish.

  Each collection is a *directory of immutable versions*
  (`jsondb/user/<timestamp>-<uuid>.json`) rather than one overwritten file.
  Blob serves through a CDN that returns a **stale 200** for an overwritten
  pathname, and a cache-busting query string does not defeat it. Overwriting
  a single `user.json` broke correctness twice in production: an update
  immediately after a create failed with "No User found", and a second
  instance reading a stale body missed an existing email and created a
  duplicate account. Publishing a new URL per write means no cache has ever
  seen it, and reads ask the Blob API (not the CDN) which version is newest.
  Superseded versions are pruned after each write.
- **`memory`** — in-process, for tests.

Adding a driver means implementing three methods (`read`, `write`, `list`).
Nothing above the driver knows where the JSON lives.

## What it supports

Reads: `findMany`, `findFirst(OrThrow)`, `findUnique(OrThrow)`, `count`,
`aggregate`, `groupBy`, with `where`, `orderBy`, `skip`/`take`, `distinct`,
`select`, `include` (nested to any depth), and `_count`.

Writes: `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete`,
`deleteMany`, atomic `increment`/`decrement`/`multiply`/`divide`/`set`.

Filters: `equals`, `not`, `in`, `notIn`, `contains`, `startsWith`, `endsWith`,
`gt`/`gte`/`lt`/`lte`, `mode: 'insensitive'`, `AND`/`OR`/`NOT`.

Schema behaviour: `@id`, `@unique`, `@@unique` composites, `@default` (uuid,
now, literals), `@updatedAt`, and `onDelete: Cascade` / `SetNull`.

Errors match the Prisma codes the API already catches — `P2002` for a unique
violation, `P2025` for a missing row.

## What it does not support

These throw loudly rather than returning a plausible-but-wrong answer:

- **Raw SQL.** `$queryRaw` throws. The six raw queries that existed were ported
  to the engine (see `analytics`, `admin/analytics`, `admin/reports`,
  `notifications`, `qr`).
- **Relation filters in `where`** (`some`/`every`/`none`/`is`). Nothing in the
  codebase used them. Filter on the foreign key instead.
- **Full-text `search`.**

Two further limits are real and worth knowing:

- **`$transaction` does not roll back.** There is no transaction log, so
  operations run in order and the first failure surfaces — earlier writes stay
  applied. Every current call site batches independent reads or a short write
  sequence that tolerates partial application.
- **Concurrent writes across instances can clobber.** Within one process every
  mutation is serialised per collection and re-reads before applying, so
  read-modify-write is safe. Two *concurrent serverless instances* writing the
  same collection is last-write-wins. That is inherent to file-backed storage,
  and is the main reason to move to a real database as write volume grows.

`select` also widens to the full model in the type layer rather than only the
selected scalars, so reading an unselected field type-checks but is `undefined`
at runtime. Relations resolve exactly.

## Working on it

```bash
pnpm --filter api db:generate   # regenerate types after editing schema.prisma
pnpm --filter api db:seed       # super admin, plans, themes
pnpm --filter api test          # 39 engine tests, incl. a driver contract suite
```

After changing `schema.prisma`, run `db:generate` — the types are generated
from it, and stale types are the one way the two can drift.
