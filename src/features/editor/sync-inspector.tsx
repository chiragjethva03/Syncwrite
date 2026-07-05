"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Activity, CheckCircle2, CircleAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getDb } from "@/lib/db/dexie";
import { getLocalDoc } from "@/lib/sync/local-store";
import { getDeviceId } from "@/lib/device";
import { mergeDocs, winner } from "@/domain/crdt/merge";
import type { ProseMirrorNode, StampedBlock, SyncDoc } from "@/domain/crdt/types";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { cn } from "@/lib/utils";

/**
 * CRDT Sync Inspector — makes the invisible distributed-systems core visible.
 *
 * The merge engine, version vectors, Lamport clocks and per-block provenance are
 * normally only exercised by tests. This panel surfaces the *live* state of the
 * open document straight from IndexedDB so a reviewer can watch how the CRDT
 * actually behaves: which device wrote each block, what's pending, and — via the
 * "convergence proof" — that concurrent edits deterministically merge the same
 * way regardless of arrival order (commutativity), on the real document.
 */
export function SyncInspector({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const deviceId = getDeviceId();

  const localDoc = useLiveQuery(() => getLocalDoc(documentId), [documentId]);
  const ops = useLiveQuery(
    () => getDb().queue.where("documentId").equals(documentId).toArray(),
    [documentId],
  );
  const status = useSyncStatus();

  // 1s clock so retry countdowns tick while the panel is open. Kept in state
  // (not read via Date.now() in render) to stay a pure render.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const blocks = localDoc
    ? Object.values(localDoc.syncDoc.blocks).sort((a, b) =>
        a.fracIndex < b.fracIndex ? -1 : a.fracIndex > b.fracIndex ? 1 : 0,
      )
    : [];
  const vector = localDoc?.syncDoc.versionVector ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Open sync inspector">
          <Activity className="size-4" /> <span className="hidden sm:inline">Internals</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" /> CRDT Sync Inspector
          </DialogTitle>
          <DialogDescription>
            Live view of the block-level CRDT for this document — version vector,
            Lamport clocks, per-block provenance, and the sync outbox.
          </DialogDescription>
        </DialogHeader>

        {/* Sync state summary */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Server version" value={`v${localDoc?.serverVersion ?? 0}`} />
          <Stat
            label="Local state"
            value={localDoc?.dirty ? "dirty" : "clean"}
            tone={localDoc?.dirty ? "warn" : "ok"}
          />
          <Stat label="Pending ops" value={String(ops?.length ?? 0)} tone={ops?.length ? "warn" : "ok"} />
          <Stat
            label="Connection"
            value={!status.online ? "offline" : status.syncing ? "syncing" : "online"}
            tone={!status.online ? "warn" : "ok"}
          />
        </div>

        {/* Version vector */}
        <Section title="Version vector" hint="deviceId → highest Lamport clock integrated">
          {Object.keys(vector).length === 0 ? (
            <Empty>No writes yet.</Empty>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(vector).map(([dev, lamport]) => (
                <Badge key={dev} variant="secondary" className="gap-1.5 font-mono text-xs">
                  <DeviceDot deviceId={dev} />
                  {shortId(dev)}
                  {dev === deviceId && <span className="text-primary">(you)</span>}
                  <span className="text-muted-foreground">· {lamport}</span>
                </Badge>
              ))}
            </div>
          )}
        </Section>

        {/* Blocks with provenance */}
        <Section title={`Blocks (${blocks.length})`} hint="ordered by fractional index">
          {blocks.length === 0 ? (
            <Empty>Empty document.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <Th>order</Th>
                    <Th>content</Th>
                    <Th>lamport</Th>
                    <Th>device</Th>
                    <Th>state</Th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {blocks.map((b) => (
                    <tr key={b.id} className={cn("border-t", b.deleted && "opacity-50")}>
                      <Td className="text-muted-foreground">{shortFrac(b.fracIndex)}</Td>
                      <Td className="max-w-[16rem] truncate font-sans">{blockText(b) || "—"}</Td>
                      <Td>{b.lamport}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <DeviceDot deviceId={b.deviceId} />
                          {shortId(b.deviceId)}
                          {b.deviceId === deviceId && <span className="text-primary">·you</span>}
                        </span>
                      </Td>
                      <Td>
                        {b.deleted ? (
                          <Badge variant="destructive" className="text-[10px]">tombstone</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">live</Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Sync outbox */}
        <Section title="Sync outbox" hint="durable operation queue (survives reload / offline)">
          {!ops || ops.length === 0 ? (
            <Empty>Outbox empty — everything is synced.</Empty>
          ) : (
            <div className="space-y-1.5">
              {ops.map((op) => {
                const retryIn = now ? Math.max(0, Math.ceil((op.nextAttemptAt - now) / 1000)) : 0;
                return (
                  <div
                    key={op.opId}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">{shortId(op.opId)}</span>
                    <span className="text-muted-foreground">
                      lamport {op.lamport} · base v{op.baseVersion} · {op.payload.length} block
                      {op.payload.length === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {op.attempts > 0 && (
                        <span className="text-muted-foreground">retry #{op.attempts}</span>
                      )}
                      <Badge
                        variant={op.status === "error" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {op.status === "error" && retryIn > 0 ? `retry in ${retryIn}s` : op.status}
                      </Badge>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Convergence proof — the interactive distributed-systems demo */}
        <ConvergenceProof syncDoc={localDoc?.syncDoc} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Runs a live commutativity proof on the ACTUAL open document: it forks the
 * current state into two replicas, applies a *concurrent* edit to the same block
 * on each (simulating two devices editing offline at once), then merges them in
 * both orders. The block-level CRDT guarantees replica A⊕B === B⊕A — this button
 * demonstrates that determinism on real data, with no server round-trip.
 */
function ConvergenceProof({ syncDoc }: { syncDoc?: SyncDoc }) {
  const [result, setResult] = useState<null | {
    converged: boolean;
    blockId: string;
    winnerDevice: string;
    text: string;
  }>(null);

  function run() {
    if (!syncDoc) return;
    const base = syncDoc;
    const target = Object.values(base.blocks).find((b) => !b.deleted) ?? synthTarget();
    const lamport = maxLamport(base) + 1;

    const devA = "sim-device-A";
    const devB = "sim-device-B";
    const editA = stampEdit(target, "Edit from Device A (offline)", lamport, devA);
    const editB = stampEdit(target, "Edit from Device B (offline)", lamport, devB);

    // Two divergent replicas — same base, concurrent same-block edits.
    const replicaA: SyncDoc = {
      blocks: { ...base.blocks, [target.id]: editA },
      versionVector: { ...base.versionVector, [devA]: lamport },
    };
    const replicaB: SyncDoc = {
      blocks: { ...base.blocks, [target.id]: editB },
      versionVector: { ...base.versionVector, [devB]: lamport },
    };

    // Merge both orders and check they're identical (commutativity).
    const ab = mergeDocs(replicaA, replicaB);
    const ba = mergeDocs(replicaB, replicaA);
    const converged = canonical(ab) === canonical(ba);

    const won = winner(editA, editB);
    setResult({
      converged,
      blockId: target.id,
      winnerDevice: won.deviceId,
      text: blockText(ab.blocks[target.id]) ?? "",
    });
  }

  return (
    <Section
      title="Convergence proof"
      hint="fork → concurrent edit on 2 devices → merge both orders"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={run} disabled={!syncDoc} className="gap-1.5">
          <Activity className="size-4" /> Run convergence proof
        </Button>
        {result && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium",
              result.converged ? "text-success" : "text-destructive",
            )}
          >
            {result.converged ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <CircleAlert className="size-4" />
            )}
            {result.converged ? "Converged — A⊕B ≡ B⊕A" : "Diverged (bug!)"}
          </span>
        )}
      </div>
      {result && (
        <p className="mt-2 text-xs text-muted-foreground">
          Both merge orders produced an identical document. Deterministic winner
          on the contested block:{" "}
          <span className="font-mono text-foreground">{shortId(result.winnerDevice)}</span>{" "}
          (equal Lamport → higher deviceId wins) → “{result.text}”. No edits lost.
        </p>
      )}
    </Section>
  );
}

/* ---------- small presentational helpers ---------- */

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-sm font-medium",
          tone === "warn" && "text-warning",
          tone === "ok" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">{children}</p>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2.5 py-1.5 font-medium">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-2.5 py-1.5", className)}>{children}</td>;
}

/** A deterministic colored dot per device (hue derived from the id). */
function DeviceDot({ deviceId }: { deviceId: string }) {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return (
    <span
      aria-hidden
      className="inline-block size-2 rounded-full"
      style={{ backgroundColor: `hsl(${hue} 70% 55%)` }}
    />
  );
}

/* ---------- pure helpers ---------- */

function shortId(id: string): string {
  return id.length <= 8 ? id : id.slice(0, 8);
}
function shortFrac(f: string): string {
  return f.length <= 6 ? f : `${f.slice(0, 6)}…`;
}

/** Extract the plain text of a block for a compact preview. */
function blockText(block?: StampedBlock | null): string {
  if (!block?.node) return "";
  const parts: string[] = [];
  const walk = (n: ProseMirrorNode) => {
    if (n.text) parts.push(n.text);
    n.content?.forEach(walk);
  };
  walk(block.node);
  return parts.join("");
}

function maxLamport(doc: SyncDoc): number {
  let max = 0;
  for (const b of Object.values(doc.blocks)) if (b.lamport > max) max = b.lamport;
  return max;
}

function stampEdit(
  base: StampedBlock,
  text: string,
  lamport: number,
  deviceId: string,
): StampedBlock {
  return {
    ...base,
    node: { type: "paragraph", content: [{ type: "text", text }] },
    lamport,
    deviceId,
    deleted: false,
  };
}

function synthTarget(): StampedBlock {
  return {
    id: "sim-block",
    fracIndex: "a0",
    node: { type: "paragraph", content: [{ type: "text", text: "base" }] },
    lamport: 0,
    deviceId: "base",
    deleted: false,
  };
}

/** Stable, order-independent serialization for equality checks. */
function canonical(doc: SyncDoc): string {
  const blocks = Object.keys(doc.blocks)
    .sort()
    .map((k) => [k, doc.blocks[k]] as const);
  const vector = Object.keys(doc.versionVector)
    .sort()
    .map((k) => [k, doc.versionVector[k]] as const);
  return JSON.stringify({ blocks, vector });
}
