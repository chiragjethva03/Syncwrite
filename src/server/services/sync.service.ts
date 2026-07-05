import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { AppError, ErrorCode } from "@/server/http/response";
import { requireCanEdit, requireRole } from "./access";
import { applyDelta } from "@/domain/crdt/merge";
import { extractText } from "@/domain/crdt/document";
import type { BlockDelta, StampedBlock, SyncDoc } from "@/domain/crdt/types";
import type { PullSyncInput, PushSyncInput } from "@/server/validators/sync";
import { recordAudit } from "./audit.service";

/**
 * Server-side synchronization service.
 *
 * The server is a *convergent replica*, not a lock manager. It integrates each
 * client operation into its `SyncDoc` using the same commutative CRDT merge the
 * clients use (domain/crdt/merge), then hands back a delta so the client can
 * converge. Because merge is deterministic, the server and every client reach
 * byte-identical state regardless of arrival order.
 *
 * Concurrency: two devices can push to the same document simultaneously. We use
 * OPTIMISTIC CONCURRENCY — the write only lands if the document's `serverVersion`
 * is still what we read; otherwise we re-read and re-merge. This prevents the
 * lost-update race without holding long locks. (The merge being idempotent makes
 * retries safe.)
 */

const MAX_RETRIES = 4;

export interface SyncResult {
  serverVersion: number;
  versionVector: Record<string, number>;
  /** Blocks the client is missing (changed on the server since sinceVersion). */
  delta: BlockDelta;
  /** opIds the server accepted (already-applied ones are also acked). */
  acked: string[];
}

function asSyncDoc(value: Prisma.JsonValue): SyncDoc {
  const v = (value ?? {}) as Partial<SyncDoc>;
  return { blocks: v.blocks ?? {}, versionVector: v.versionVector ?? {} };
}

/** Collect the delta of blocks changed after `sinceVersion` from the op log. */
async function buildDelta(
  documentId: string,
  sinceVersion: number,
  currentDoc: SyncDoc,
  serverVersion: number,
): Promise<BlockDelta> {
  if (sinceVersion <= 0) {
    // First load: send the whole document.
    return Object.values(currentDoc.blocks);
  }
  const ops = await prisma.operation.findMany({
    where: { documentId, resultVersion: { gt: sinceVersion } },
    orderBy: { resultVersion: "asc" },
    select: { payload: true, resultVersion: true },
  });
  if (ops.length === 0) {
    // No op rows but the server is ahead (e.g. after log pruning / restore):
    // fall back to a full snapshot so the client can still converge safely.
    return serverVersion > sinceVersion ? Object.values(currentDoc.blocks) : [];
  }
  // Deduplicate to the latest write per block id (keeps the delta minimal).
  const latest = new Map<string, StampedBlock>();
  for (const op of ops) {
    for (const block of op.payload as unknown as StampedBlock[]) {
      const prev = latest.get(block.id);
      if (!prev || block.lamport > prev.lamport) latest.set(block.id, block);
    }
  }
  return [...latest.values()];
}

export async function pushOperations(
  userId: string,
  input: PushSyncInput,
): Promise<SyncResult> {
  // Viewers are rejected here — they can never push state updates.
  await requireCanEdit(input.documentId, userId);

  // Skip operations we've already durably applied (idempotent retries).
  const opIds = input.operations.map((o) => o.opId);
  const existing = await prisma.operation.findMany({
    where: { opId: { in: opIds } },
    select: { opId: true },
  });
  const alreadyApplied = new Set(existing.map((e) => e.opId));
  const fresh = input.operations.filter((o) => !alreadyApplied.has(o.opId));

  let serverVersion = 0;
  let versionVector: Record<string, number> = {};

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const doc = await prisma.document.findFirst({
      where: { id: input.documentId, deletedAt: null },
      select: { content: true, serverVersion: true },
    });
    if (!doc) throw new AppError(ErrorCode.NOT_FOUND, "Document not found");

    const base = doc.serverVersion;
    let state = asSyncDoc(doc.content);
    let version = base;
    const opRows: Prisma.OperationCreateManyInput[] = [];

    for (const op of fresh) {
      const { doc: merged, changed } = applyDelta(state, op.payload as BlockDelta);
      state = merged;
      if (changed) version += 1;
      opRows.push({
        opId: op.opId,
        documentId: input.documentId,
        authorId: userId,
        type: "UPDATE",
        deviceId: op.deviceId,
        lamport: op.lamport,
        baseVersion: op.baseVersion,
        payload: op.payload as unknown as Prisma.InputJsonValue,
        resultVersion: version,
      });
    }

    const contentText = extractText(state);
    const finalState = state;
    const finalVersion = version;

    try {
      await prisma.$transaction(async (tx) => {
        // Optimistic guard: only write if nobody else advanced the version.
        const updated = await tx.document.updateMany({
          where: { id: input.documentId, serverVersion: base },
          data: {
            content: finalState as unknown as Prisma.InputJsonValue,
            versionVector: finalState.versionVector as Prisma.InputJsonValue,
            serverVersion: finalVersion,
            contentText,
          },
        });
        if (updated.count !== 1) {
          // Someone else won the race; abort to retry with fresh state.
          throw new ConcurrencyRetry();
        }
        if (opRows.length > 0) {
          await tx.operation.createMany({ data: opRows, skipDuplicates: true });
        }
      });

      serverVersion = finalVersion;
      versionVector = finalState.versionVector;
      break;
    } catch (err) {
      if (err instanceof ConcurrencyRetry) continue;
      throw err;
    }

    if (attempt === MAX_RETRIES - 1) {
      throw new AppError(
        ErrorCode.CONFLICT,
        "Could not integrate changes due to heavy concurrent editing; please retry",
      );
    }
  }

  const currentDoc = await prisma.document.findFirstOrThrow({
    where: { id: input.documentId },
    select: { content: true, serverVersion: true, versionVector: true },
  });
  serverVersion = currentDoc.serverVersion;
  versionVector = (currentDoc.versionVector ?? {}) as Record<string, number>;

  const delta = await buildDelta(
    input.documentId,
    input.sinceVersion,
    asSyncDoc(currentDoc.content),
    serverVersion,
  );

  await recordAudit({
    userId,
    documentId: input.documentId,
    action: "sync.push",
    metadata: { ops: fresh.length, acked: opIds.length, serverVersion },
  });

  return { serverVersion, versionVector, delta, acked: opIds };
}

export async function pullChanges(
  userId: string,
  input: PullSyncInput,
): Promise<SyncResult> {
  await requireRole(input.documentId, userId, "VIEWER");
  const doc = await prisma.document.findFirstOrThrow({
    where: { id: input.documentId, deletedAt: null },
    select: { content: true, serverVersion: true, versionVector: true },
  });
  const state = asSyncDoc(doc.content);
  const delta = await buildDelta(
    input.documentId,
    input.sinceVersion,
    state,
    doc.serverVersion,
  );
  return {
    serverVersion: doc.serverVersion,
    versionVector: (doc.versionVector ?? {}) as Record<string, number>,
    delta,
    acked: [],
  };
}

/** Internal sentinel used to trigger an optimistic-concurrency retry. */
class ConcurrencyRetry extends Error {}
