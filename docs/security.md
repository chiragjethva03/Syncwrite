# Security — Threat Model & Mitigations

## 1. Malicious / oversized sync payloads (OOM prevention)

**Threat:** an attacker sends a massive or deeply-nested JSON body to exhaust
server memory (heap OOM or recursion stack overflow) and take down the
collaboration server.

**Defense in depth — rejected as early and as cheaply as possible:**

1. **Byte-size guard before parsing** (`server/http/guard.ts`). We check the
   `Content-Length` header, then the *actual* decoded byte length, against
   `MAX_SYNC_PAYLOAD_BYTES` (default 1 MiB) **before** calling `JSON.parse`. An
   oversized body is rejected in `O(limit)` memory, never `O(payload)`. The
   header can lie, so we verify the real length too.
2. **Bounded schema** (`server/validators/common.ts`, `sync.ts`). The ProseMirror
   node schema caps **recursion depth** (40), **children per node** (5 000), and
   **text length** (50 000). The sync schema caps **blocks per op** (2 000) and
   **ops per batch** (200), and constrains every integer. A malformed payload
   fails Zod validation and returns `422` — it never reaches the merge engine.
3. **Rate limiting** (`server/http/rate-limit.ts`) throttles the sync/AI/auth
   endpoints so an attacker can't brute-force volume.

## 2. Tenant isolation (Row-Level Security / strict ORM scoping)

**Threat:** user A reads or edits user B's document.

**Primary defense — strict ORM scoping.** Every document access flows through one
authorization gate, `resolveRole()` (`server/services/access.ts`), which returns a
role *only* if the user owns the document or is an explicit collaborator. All
reads go through `document.repository.ts`, whose queries always include
`accessibleWhere(userId)` (`ownerId = me OR collaborators.some(userId = me)`).
There is no code path that loads a document without this scope. Non-members get
`404` (not `403`) so we don't even leak a document's existence.

**Defense in depth — PostgreSQL RLS.** Prisma connects as a single role, so
app-layer scoping is the enforcement point in this deployment. For a
belt-and-suspenders setup you can additionally enable RLS and pass the user id as
a session GUC. Example policy:

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY doc_tenant_isolation ON documents
  USING (
    owner_id = current_setting('app.user_id', true)
    OR EXISTS (
      SELECT 1 FROM collaborators c
      WHERE c.document_id = documents.id
        AND c.user_id = current_setting('app.user_id', true)
    )
  );
```

…with `SET LOCAL app.user_id = '<id>'` at the start of each transaction. This is
documented rather than enabled by default because it requires a per-request
transaction wrapper; the ORM scoping already provides the guarantee.

## 3. Authentication & authorization

- **Auth.js (NextAuth v5)** with a Credentials provider and **stateless JWT**
  sessions. Passwords are hashed with **bcrypt (cost 12)**; login does a constant
  time compare even for unknown emails to avoid a user-enumeration timing oracle.
- **Route protection is server-side** — enforced in layouts (`getCurrentUser` →
  redirect) and re-checked in every service against the database. We deliberately
  do **not** use `proxy`/middleware as the authorization boundary (the Next.js
  docs advise against it).
- **RBAC**: `OWNER > EDITOR > VIEWER`. **Viewers can never push state updates** —
  `pushOperations` calls `requireCanEdit`, which rejects viewers with `403`
  before any merge happens. Only owners manage collaborators or delete.

## 4. Input validation & injection

- **All** external input is validated with **Zod** at the boundary.
- **SQL injection** is prevented by Prisma's parameterized queries — we never
  build raw SQL from user input.
- **XSS**: content is stored as structured ProseMirror JSON (not raw HTML) and
  rendered by TipTap; links get `rel="noopener noreferrer nofollow"`.
- **Security headers** (`next.config.ts`): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in
  production — the Next-native equivalent of Helmet.

## 5. Auditing & abuse

- An **audit log** records sync pushes, restores, collaborator changes, and AI
  usage for forensic traceability (`server/services/audit.service.ts`).
- **Idempotency**: every operation carries a unique `opId`; the server dedupes
  on it, so retried/duplicated requests never double-apply.

## Production hardening checklist

- [ ] Replace the in-memory rate limiter with Upstash Redis / Vercel KV for
      multi-instance correctness (interface is already isolated).
- [ ] Enable the Postgres RLS policies above with a per-request transaction GUC.
- [ ] Add a Content-Security-Policy header (nonce-based) once inline scripts are
      audited.
- [ ] Rotate `AUTH_SECRET` via your secrets manager; never commit `.env`.
