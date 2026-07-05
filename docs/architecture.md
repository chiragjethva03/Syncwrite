# Architecture

Syncwrite is a single **Next.js 16** full-stack app (App Router, React 19,
TypeScript). It is organized in clean layers so business logic never lives in UI
components and each concern is independently testable.

## Layered structure

```
src/
├─ app/                       # Presentation: routes, pages, API route handlers
│  ├─ (auth)/                 #   public auth screens
│  ├─ (app)/                  #   authenticated shell (dashboard, editor)
│  └─ api/                    #   REST route handlers (thin — delegate to services)
├─ features/                  # Feature UI + client logic (auth, dashboard, editor)
├─ components/                # Reusable presentational components (+ ui/ primitives)
├─ providers/                 # React context providers (query, theme, sync)
├─ hooks/                     # Reusable React hooks
├─ domain/                    # ★ Pure domain logic — the CRDT (no I/O, fully tested)
│  └─ crdt/                   #   types · fractional-index · merge · document
├─ lib/                       # Infrastructure the client uses
│  ├─ db/dexie.ts             #   IndexedDB (local source of truth)
│  ├─ sync/                   #   local-store + background sync engine
│  ├─ api-client.ts           #   typed fetch wrapper
│  └─ env.ts                  #   validated environment
├─ server/                    # Server-only code
│  ├─ auth/                   #   Auth.js config + session guards
│  ├─ validators/             #   Zod schemas (validation layer)
│  ├─ repositories/           #   data access (tenant-scoped queries)
│  ├─ services/               #   application/business logic
│  ├─ http/                   #   response envelope, guards, rate limit
│  └─ db/prisma.ts            #   Prisma client singleton
├─ config/                    # App + developer config
└─ types/                     # Shared DTOs
prisma/                       # schema + seed
tests/                        # unit + sync/conflict tests
docs/                         # this documentation
```

### Layer responsibilities

- **Presentation** (`app`, `features`, `components`) — rendering + user
  interaction only. Route handlers are thin: authenticate, validate, delegate.
- **Application / Domain** (`server/services`, `domain`) — all business rules.
  The CRDT in `domain/` is *pure* (no DB, no network), which is why it can be
  exhaustively unit-tested.
- **Infrastructure** (`server/repositories`, `server/db`, `lib/db`, `lib/sync`) —
  Postgres via Prisma on the server; IndexedDB via Dexie on the client.
- **Validation** (`server/validators`) — Zod schemas guarding every input.
- **Authentication/Authorization** (`server/auth`, `server/services/access.ts`).

## The two sources of truth

Local-first means there are deliberately **two** authoritative stores that
reconcile:

1. **Client**: IndexedDB (Dexie). The editor reads/writes here with zero network
   on the critical path.
2. **Server**: PostgreSQL (Prisma). The durable, shared, multi-tenant store.

The **canonical representation in both is the `SyncDoc`** (the CRDT state).
ProseMirror/TipTap JSON is only ever a *projection* for rendering.

## Data flow — an edit

```
 keystroke
   → TipTap onUpdate (debounced 600ms)
   → reconcile() into stamped blocks          [domain]
   → write IndexedDB + enqueue a block delta  [lib/sync/local-store]
   → syncEngine.kick()                         [lib/sync/sync-engine]
        → POST /api/documents/:id/sync         [app/api → server/services/sync]
        → server merges delta (optimistic CC), returns converging delta
   → integrate returned delta into IndexedDB
   → (other devices) pull picks up the change and merges locally
```

The network is **never** between the keystroke and the local write. If it's slow
or absent, edits queue durably and flush later — nothing blocks and nothing is
lost.

## Rendering strategy (performance)

- **Server Components by default** — layouts, dashboard shell, auth gating render
  on the server (no client JS shipped for them).
- **Client Components only where interactive** — the editor, sync indicators,
  dashboard mutations.
- **Code splitting** — TipTap and the editor feature load only on the document
  route.
- **Avoiding typing lag** — editor changes are debounced and reconciled off the
  hot path; deltas are minimal (only changed blocks); the sync engine is
  single-flight so it never storms the network during rapid typing. The toolbar
  subscribes to selection updates rather than re-rendering the whole editor.
- **TanStack Query** caches server state (lists/versions) with
  stale-while-revalidate; the document body is handled by the local store, not
  Query.

## API design

REST, under `/api`, with one consistent envelope (`server/http/response.ts`):

```jsonc
// success
{ "ok": true, "data": <T>, "meta": { "page": 1, "pageSize": 20, "total": 42 } }
// error
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "…", "details": … } }
```

Lists support pagination, search, sorting. Errors are centrally translated from
typed `AppError`s / `ZodError`s so no stack trace ever leaks.

See [conflict-resolution.md](./conflict-resolution.md) for the sync internals and
[security.md](./security.md) for the threat model.
