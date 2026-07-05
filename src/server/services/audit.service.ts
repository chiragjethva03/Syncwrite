import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Fire-and-forget audit trail. Auditing must never break the user's request, so
 * failures are swallowed (and logged). Useful for security forensics: who synced
 * what, who restored a version, rejected payloads, etc.
 */
export async function recordAudit(entry: {
  userId?: string;
  documentId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        documentId: entry.documentId,
        action: entry.action,
        metadata: entry.metadata ?? {},
        ip: entry.ip,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record:", entry.action, error);
  }
}
