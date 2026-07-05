# Offline & Online Behavior

Syncwrite is **local-first**: the browser's IndexedDB (via Dexie) is the source
of truth for document content, and the network is never on the typing path. This
document explains exactly what works offline, what needs the network, and how to
test it — so reviewers can evaluate the offline story without surprises.

## The two layers of "offline"

Offline support has two independent parts. Understanding the split explains every
behavior below.

| Layer | Responsibility | Powered by |
| --- | --- | --- |
| **Data** | Reading/editing document content without the network; queueing changes; merging on reconnect | IndexedDB + the sync engine + CRDT (`src/lib/sync/`, `src/domain/crdt/`) |
| **App shell** | Serving the HTML/JS/CSS so the app can **boot / reload** with no network | Service worker (`public/sw.js`) + web manifest (`src/app/manifest.ts`) |

Without the app-shell layer, a **full page reload while offline** fails — the
browser must re-download the HTML/JS from the server and shows the "no internet"
page. The service worker closes that gap by serving a cached shell; IndexedDB
then drives the editor.

## What works offline

Once the app has loaded and a document has been opened at least once online (so
it is cached in IndexedDB and the shell is cached by the service worker):

- ✅ **Open a previously-opened document** — served instantly from IndexedDB.
- ✅ **Edit everything** — typing, headings, bold/italic/underline, lists,
  checklists, code blocks, tables, links, undo/redo. All local (TipTap + CRDT).
- ✅ **Autosave** — every change is reconciled into stamped CRDT blocks and
  persisted to IndexedDB (`applyEditorChange`).
- ✅ **Change queue** — each edit becomes a durable operation in an IndexedDB
  outbox, ready to push. Nothing is lost if the tab closes.
- ✅ **Reload / reopen the browser** — state persists (IndexedDB is durable).
- ✅ **Full page refresh while offline** — the service worker serves the cached
  app shell instead of the browser's error page.
- ✅ **Offline banner + pending count** — the UI reflects connectivity and how
  many changes are waiting to sync.

## What needs the network (fails gracefully offline)

These require the server and are **not** available offline by design. They fail
gracefully (a toast / disabled state), never a crash:

- ❌ **Login / Register** — authentication is a server call.
- ❌ **AI features** (summarize, grammar, improve, title, continue) — call the
  Gemini API.
- ❌ **Version history** — snapshots, timeline, and restore are server-stored.
- ❌ **Adding collaborators** — a server mutation.
- ❌ **First-ever open of a document never loaded before** — its content must be
  seeded from the server once; after that it is available offline.

This mirrors how production editors (e.g. Google Docs) behave offline: seamless
editing of already-loaded documents, with account/AI/history needing a
connection.

## What happens on reconnect

When connectivity returns, the background sync engine (`src/lib/sync/sync-engine.ts`)
runs automatically:

1. **Push** — every queued operation is sent to the server with
   optimistic-concurrency (`baseVersion`) and **exponential-backoff retry**.
2. **Pull + merge** — remote changes are folded into local state using the
   block-level CRDT, so concurrent edits from other devices converge **without
   overwriting your offline work**. See [conflict-resolution.md](conflict-resolution.md).
3. **Status** — the indicator flips back to "All changes saved".

## How the service worker caches (offline reloads)

`public/sw.js` uses a per-request-type strategy:

- **Navigations** (page loads/reloads): _network-first_ — try the network, cache
  the result, and fall back to the cached page (or any cached page) when offline.
  This keeps content fresh online while guaranteeing the app boots offline.
- **Immutable assets** (`/_next/static`, fonts, images): _cache-first_ — hashed
  files never change, so a cache hit is always correct and instant.
- **`/api/*`**: _never cached_ — auth, sync, and AI must always hit the network
  and fail gracefully offline (the sync queue handles the rest).

The service worker is **only registered in production** (a caching worker fights
Turbopack's dev HMR). So offline reloads are testable on the deployed site, not
on `localhost` dev.

## How to test offline

### Data layer (works in dev and prod)

1. Open the app online, sign in, open a document, type a little (so it is cached
   in IndexedDB).
2. DevTools → **Network** tab → set throttling to **Offline**.
3. Keep typing (do **not** hard-reload). Editing continues; the **Offline**
   banner and a pending count appear.
4. Set the network back to **Online** → changes sync automatically.
5. Open the same document in a second browser to watch collaboration converge.

### App-shell layer (deployed / production only)

1. On the **deployed** site, sign in and open the dashboard and a document once
   (this installs the service worker and caches the shell).
2. Reload once while online to be sure the shell is cached.
3. Turn off Wi‑Fi / go fully offline and **refresh the page** → the app boots
   from cache (no "site can't be reached"), and editing works from IndexedDB.
4. Verify in DevTools → **Application → Service Workers** (`sw.js` "activated")
   and **Application → Cache Storage** (`sw-pages-v1`, `sw-static-v1`).

> Note: the service worker caches pages as you visit them. A brand-new document
> URL opened for the first time **while already offline** cannot be served — it
> was never fetched. Visit it once online first.
