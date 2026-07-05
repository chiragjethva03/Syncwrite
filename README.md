# Syncwrite — Local-First Collaborative Document Editor

A production-grade, **local-first** collaborative editor with **offline
synchronization**, **deterministic conflict resolution** (a block-level CRDT),
**granular version history**, and **AI-assisted writing** — built as a single
**Next.js 16** full-stack application.

> This is deliberately **not** a CRUD app. The interesting engineering is in the
> distributed-systems core: browser-based state as the source of truth, a
> background sync engine that survives offline periods and race conditions, and a
> merge algorithm that provably converges without losing edits.

**🔗 Live demo:** _add your Vercel URL_ · **📦 Repo:** _add your GitHub URL_

---

## Highlights (what to look at first)

| Area | Where | Why it matters |
| --- | --- | --- |
| **Deterministic merge (CRDT)** | [`src/domain/crdt/`](src/domain/crdt) + [docs](docs/conflict-resolution.md) | Commutative/associative/idempotent join → every replica converges. **Proven in tests.** |
| **Offline sync engine** | [`src/lib/sync/`](src/lib/sync) | Durable IndexedDB outbox, exponential-backoff retry, reconnect flush, optimistic-concurrency on the server. |
| **Local-first store** | [`src/lib/db/dexie.ts`](src/lib/db/dexie.ts) | IndexedDB is the source of truth; the network is never on the typing path. |
| **Version time-travel** | [`src/server/services/version.service.ts`](src/server/services/version.service.ts) | Non-destructive restore that propagates to collaborators. |
| **Security / OOM defense** | [`src/server/http/`](src/server/http) + [docs](docs/security.md) | Size-guarded, Zod-bounded sync payloads; strict tenant scoping; RBAC. |

## Features

- **Auth** — register / login / logout, JWT sessions, protected routes (Auth.js v5).
- **RBAC** — Owner / Editor / Viewer. **Viewers cannot push updates.**
- **Dashboard** — create, rename, delete, search, recent, collaborators, responsive.
- **Rich editor (TipTap)** — headings, bold/italic/underline/strike, inline code,
  lists, checklists, code blocks, blockquotes, links, tables, images, undo/redo,
  keyboard shortcuts, autosave.
- **Local-first & offline** — open/edit/close with zero blocking network; edits
  persist across reloads and offline periods.
- **Background sync** — operation queue, retry with exponential backoff, auto-sync
  on reconnect, live status + offline banner + pending count.
- **Deterministic conflict resolution** — block-level CRDT (Lamport clocks +
  version vectors + fractional indexing). See [the algorithm](docs/conflict-resolution.md).
- **Version history** — snapshots, timeline, safe restore (always creates a new version).
- **AI (Gemini)** — summarize, fix grammar, improve writing, generate title, continue writing.
- **A11y & theming** — keyboard-navigable, ARIA-labelled, light/dark, reduced-motion friendly.

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/Radix UI · TipTap 3
· Prisma 6 + PostgreSQL (Supabase) · Auth.js v5 · Zod · TanStack Query · Dexie
(IndexedDB) · Motion · Google Gemini · Vitest.

## Architecture

Clean, layered, single Next.js app. Full write-up in
**[docs/architecture.md](docs/architecture.md)**; conflict algorithm in
**[docs/conflict-resolution.md](docs/conflict-resolution.md)**; threat model in
**[docs/security.md](docs/security.md)**.

```
app/ (routes + API)  features/ (feature UI)  components/  providers/  hooks/
domain/crdt/ (pure, tested merge engine)
lib/ (dexie, sync engine, api client, env)
server/ (auth, validators, repositories, services, http)
prisma/  tests/  docs/
```

## Getting started

### Prerequisites

- Node.js **≥ 20.9** (20.19+ / 22 recommended — Vercel uses 22)
- A PostgreSQL database (Supabase recommended)
- (Optional) a Google Gemini API key for AI features

### 1. Install

```bash
npm install --legacy-peer-deps
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` — Supabase **pooled** connection (port 6543, `?pgbouncer=true`)
- `DIRECT_URL` — Supabase **direct** connection (port 5432, for migrations)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `GEMINI_API_KEY` — from https://aistudio.google.com/app/apikey (optional)

### 3. Set up the database

```bash
npm run db:push       # or: npm run db:migrate   (creates the schema)
npm run db:seed       # optional demo data (see logins below)
```

### 4. Run

```bash
npm run dev           # http://localhost:3000
```

**Demo logins** (after seeding): `alice@syncwrite.dev` / `Password123!` (owner),
`bob@syncwrite.dev` / `Password123!` (editor on Alice's shared doc).

### Try the offline flow

Open a document, then in DevTools → Network set **Offline**. Keep typing — it
works, the banner shows "Offline", and pending changes queue. Go back online and
watch them sync. Open the same doc in a second browser to see collaboration.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` / `test:watch` | Vitest (unit + sync/conflict) |
| `npm run db:push` / `db:migrate` / `db:deploy` | Prisma schema |
| `npm run db:seed` / `db:studio` | Demo data / Prisma Studio |

## Testing

The distributed-systems core is covered by fast, deterministic tests:

- **CRDT properties** — commutativity, associativity, idempotency, convergence,
  delete/resurrect semantics (`tests/domain/merge.test.ts`).
- **Reconcile & projection** — stable ids, minimal deltas, round-trip
  (`tests/domain/document.test.ts`).
- **Fractional indexing** — ordering + unbounded insertion
  (`tests/domain/fractional-index.test.ts`).
- **Local-first store** — offline persistence, queueing, remote integration
  without data loss (`tests/sync/local-store.test.ts`).

```bash
npm test
```

## Deployment

### Vercel + Supabase (recommended)

1. Push to GitHub and import the repo in Vercel.
2. Set env vars (`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`).
3. Deploy. Then apply migrations once: `npm run db:deploy` (or run against the
   Supabase direct URL locally). CI/CD is wired via
   [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Docker (self-host)

```bash
docker compose up --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run db:seed   # optional
```

See [`Dockerfile`](Dockerfile) and [`docker-compose.yml`](docker-compose.yml).

## Configuration

Developer footer identity lives in [`src/config/site.ts`](src/config/site.ts) —
set your name, GitHub, and LinkedIn there (rendered in the app footer).

## License

MIT — built for the House of Edtech Fullstack assignment.
