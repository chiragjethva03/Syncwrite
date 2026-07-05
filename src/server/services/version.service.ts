import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { AppError, ErrorCode } from "@/server/http/response";
import { applyDelta, nextLamport } from "@/domain/crdt/merge";
import { extractText } from "@/domain/crdt/document";
import type { BlockDelta, StampedBlock, SyncDoc } from "@/domain/crdt/types";
import { requireCanEdit, requireRole } from "./access";
import { recordAudit } from "./audit.service";

function asSyncDoc(value: Prisma.JsonValue): SyncDoc {
  const v = (value ?? {}) as Partial<SyncDoc>;
  return { blocks: v.blocks ?? {}, versionVector: v.versionVector ?? {} };
}

async function nextVersionNumber(documentId: string): Promise<number> {
  const last = await prisma.version.findFirst({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  return (last?.versionNumber ?? 0) + 1;
}

/** Capture an immutable snapshot of the document's current state. */
export async function createSnapshot(
  userId: string,
  documentId: string,
  label?: string,
) {
  await requireCanEdit(documentId, userId);
  const doc = await prisma.document.findFirstOrThrow({
    where: { id: documentId, deletedAt: null },
    select: { content: true },
  });
  const versionNumber = await nextVersionNumber(documentId);
  const version = await prisma.version.create({
    data: {
      documentId,
      content: doc.content as Prisma.InputJsonValue,
      versionNumber,
      label: label ?? `Snapshot ${versionNumber}`,
      origin: "SNAPSHOT",
      createdById: userId,
    },
    select: { id: true, versionNumber: true, label: true, createdAt: true },
  });
  await recordAudit({ userId, documentId, action: "version.snapshot", metadata: { versionNumber } });
  return version;
}

export async function listVersions(userId: string, documentId: string) {
  await requireRole(documentId, userId, "VIEWER");
  return prisma.version.findMany({
    where: { documentId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      label: true,
      origin: true,
      restoredFromId: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getVersionContent(
  userId: string,
  documentId: string,
  versionId: string,
) {
  await requireRole(documentId, userId, "VIEWER");
  const version = await prisma.version.findFirst({
    where: { id: versionId, documentId },
    select: { id: true, versionNumber: true, content: true, label: true },
  });
  if (!version) throw new AppError(ErrorCode.NOT_FOUND, "Version not found");
  return version;
}

/**
 * Restore the document to a previous version — NON-DESTRUCTIVELY.
 *
 * Rather than overwriting, we re-stamp the target version's blocks with fresh,
 * highest Lamport clocks so they deterministically *win* the CRDT merge over the
 * current state (and we tombstone blocks added after the snapshot). This means:
 *   - history is never destroyed (old versions + op log remain intact),
 *   - the restore propagates to every active collaborator via normal sync
 *     (it's just another operation), and
 *   - we also record a NEW version marking the restore point.
 */
export async function restoreVersion(
  userId: string,
  documentId: string,
  versionId: string,
) {
  await requireCanEdit(documentId, userId);

  const [doc, version] = await Promise.all([
    prisma.document.findFirstOrThrow({
      where: { id: documentId, deletedAt: null },
      select: { content: true, serverVersion: true },
    }),
    prisma.version.findFirst({
      where: { id: versionId, documentId },
      select: { content: true, versionNumber: true },
    }),
  ]);
  if (!version) throw new AppError(ErrorCode.NOT_FOUND, "Version not found");

  const current = asSyncDoc(doc.content);
  const target = asSyncDoc(version.content);
  const deviceId = `restore:${userId}`;
  let clock = nextLamport(current);

  // Build a delta that makes the merged result equal to the target snapshot.
  const delta: BlockDelta = [];
  const ids = new Set([...Object.keys(current.blocks), ...Object.keys(target.blocks)]);
  for (const id of ids) {
    const tb = target.blocks[id];
    const lamport = clock++;
    if (tb && !tb.deleted) {
      delta.push({ ...tb, lamport, deviceId, deleted: false });
    } else {
      // Block absent (or deleted) in the target => tombstone it in current.
      const base: StampedBlock =
        tb ?? current.blocks[id] ?? {
          id,
          fracIndex: id,
          node: null,
          lamport,
          deviceId,
          deleted: true,
        };
      delta.push({ ...base, node: null, deleted: true, lamport, deviceId });
    }
  }

  const { doc: merged } = applyDelta(current, delta);
  const resultVersion = doc.serverVersion + 1;
  const opId = crypto.randomUUID();
  const versionNumber = await nextVersionNumber(documentId);

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: {
        content: merged as unknown as Prisma.InputJsonValue,
        versionVector: merged.versionVector as Prisma.InputJsonValue,
        serverVersion: resultVersion,
        contentText: extractText(merged),
      },
    });
    await tx.operation.create({
      data: {
        opId,
        documentId,
        authorId: userId,
        type: "RESTORE",
        deviceId,
        lamport: clock,
        baseVersion: doc.serverVersion,
        payload: delta as unknown as Prisma.InputJsonValue,
        resultVersion,
      },
    });
    // Restoring creates a NEW version so the timeline records the restore point.
    await tx.version.create({
      data: {
        documentId,
        content: merged as unknown as Prisma.InputJsonValue,
        versionNumber,
        label: `Restored from v${version.versionNumber}`,
        origin: "RESTORE",
        restoredFromId: versionId,
        createdById: userId,
      },
    });
  });

  await recordAudit({
    userId,
    documentId,
    action: "version.restore",
    metadata: { from: versionId, resultVersion },
  });

  return { serverVersion: resultVersion, versionNumber };
}
