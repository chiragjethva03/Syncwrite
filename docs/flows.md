# Feature Flows & How to Verify

An end-to-end walkthrough of every user flow in Syncwrite, with the exact steps
to reproduce each one. Pair this with [architecture.md](architecture.md),
[conflict-resolution.md](conflict-resolution.md), [security.md](security.md), and
[offline.md](offline.md).

> Quality gates (all green): `npm run lint`, `npm run typecheck`, `npm test`
> (26 tests), `npm run build`.

---

## 1. Authentication

### Register (email/password)
1. Landing → **Get started** → `/register`.
2. Enter name, email, password (≥ 8 chars) → **Create account**.
3. Server hashes the password (bcrypt, cost 12), creates the user, and signs you
   in automatically → redirect to `/dashboard`.
4. If signup notifications are configured, the admin receives an email.

### Sign in with Google
1. `/login` or `/register` → **Continue with Google** → Google consent → back to
   `/dashboard`.
2. First Google sign-in creates the user + linked `Account` via the Auth.js
   Prisma adapter (and fires the admin signup email).

### Sign in (email/password) / Sign out
- **Sign in:** `/login` → email + password → dashboard.
- **Sign out:** avatar menu (top-right) → **Sign out**. This also **clears all
  local client state** (IndexedDB + React Query cache) so the next user on the
  same browser never sees your documents.

### Protected routes
- Visiting `/dashboard` or `/documents/[id]` while signed out redirects to
  `/login` (enforced server-side in the `(app)` layout).

---

## 2. Dashboard

- **Create:** **New document** → creates a doc (you are OWNER) → opens the editor.
- **Search:** type in the search box → server-side title/content search (debounced).
- **Open:** click a document card.
- **Roles:** each card shows your role (OWNER / EDITOR / VIEWER) and collaborator
  count.
- Only documents you **own or collaborate on** appear (server-scoped; see §7).

---

## 3. Editor (TipTap)

Open any document, then use the toolbar:

- **Text:** bold, italic, underline, strikethrough, inline code.
- **Blocks:** H1–H3, bullet / numbered / task lists, blockquote, code block,
  divider, tables.
- **Code block** (`</>`): syntax-highlighted (lowlight) with a VS Code palette
  (Dark+ in dark mode, Light+ in light mode); language auto-detected.
- **Link:** custom dialog — select text then add a URL, or with nothing selected
  the URL is inserted as clickable text; edit/remove supported.
- **Image:** custom dialog — **upload from device** (embedded as a size-capped
  data URL so it never breaks sync) or paste an image URL.
- **Undo / redo**, keyboard shortcuts, and **autosave** (debounced) — the title
  autosaves too.

Every edit is written to IndexedDB first (local-first) and queued for sync.

---

## 4. Local-first & offline

See [offline.md](offline.md) for the full matrix. Quick test:

1. Sign in, open a document, type a little (caches it locally).
2. DevTools → Network → **Offline**. Keep typing — it works; the **Offline**
   banner and a pending count appear.
3. Back to **Online** → changes sync automatically → "All changes saved".
4. **Offline reload** (deployed site only): the app is an installable PWA, so a
   full refresh while offline still boots from the cached shell.

---

## 5. Background sync & conflict resolution

- **Push/pull:** the sync engine drains a durable IndexedDB outbox with
  exponential-backoff retry, and pulls remote changes for the open document.
- **Deterministic merge:** a block-level CRDT (Lamport clocks + version vectors +
  fractional indexing) converges every replica without losing edits. Proven by
  `tests/domain/merge.test.ts`.
- **See it live — CRDT Sync Inspector** (editor header → **Internals**):
  - Live version vector, per-block Lamport clocks + device provenance, and the
    pending-op outbox.
  - **Run convergence proof** forks the current document, applies a concurrent
    edit on two simulated devices, merges both orders, and shows `A⊕B ≡ B⊕A`
    (commutativity) on real data.

---

## 6. Version history & time-travel

Editor header → **History**:

1. **Capture snapshot** — records the current state as an immutable version.
2. **Timeline** — lists versions with author + time.
3. **Restore** — safely rolls back by appending a **new** version (never destroys
   history), and propagates to collaborators via the sync engine.

---

## 7. Sharing, roles & tenant isolation (RBAC)

1. As OWNER, open a document → **Share** → enter a collaborator's email → pick
   **Editor** or **Viewer** → **Invite**.
2. **Editor** can read + edit + sync + snapshot/restore.
3. **Viewer** is read-only: the editor is disabled and the server **rejects any
   sync push** from a viewer.
4. **Isolation:** a collaborator sees **only** the documents shared with them —
   never the owner's other documents. Enforced by ORM scoping (`accessibleWhere`)
   on every read, plus per-user wiping of local client state on login/logout.

**Verify:** share doc A (not doc B) with a second account, sign in as that account
in another browser/incognito → only doc A is visible; opening doc B's URL returns
"no access".

---

## 8. AI assistance (Gemini)

Editor toolbar → **AI**:

- **Summarize**, **Generate title** (shown in a dialog), and **Fix grammar**,
  **Improve writing**, **Continue writing** (applied in place to the selection or
  document).
- Access-gated (must have at least VIEWER access), input length-capped, and
  quota/rate-limit errors surface as a friendly message (not a crash).

---

## 9. Signup notifications (admin)

When `RESEND_API_KEY` + `ADMIN_NOTIFY_EMAIL` are set, the admin gets an email on
**every new account** (Google or email/password) with the name, email, method,
and time. Fail-safe: email problems never block signup.

---

## 10. Security & real-world hardening

- **Payload limits:** sync bodies are size-capped (default 1 MiB) and strictly
  Zod-validated → protects against OOM / malformed-payload attacks.
- **Rate limiting** on auth and AI routes; **security headers** (CSP-adjacent:
  nosniff, frame-deny, referrer, permissions, HSTS in prod).
- **Tenant isolation** via ORM scoping (see §7 and [security.md](security.md)).
- **Consistent API envelope** with typed error codes and correct HTTP statuses.

---

## 11. Theming, a11y & responsiveness

- **Light / dark** (system-aware) via the theme toggle.
- Keyboard-navigable, ARIA-labelled controls, reduced-motion friendly.
- **Fully responsive:** headers collapse button labels to icons on mobile, the
  editor title shrinks, dialogs get a mobile gutter with scroll, and grids reflow.
