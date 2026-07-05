import { prisma } from "@/server/db/prisma";
import { AppError, ErrorCode } from "@/server/http/response";
import type { Role } from "@prisma/client";

/**
 * Authorization boundary for documents.
 *
 * TENANT ISOLATION: every document access is resolved through `resolveRole`,
 * which returns a role ONLY if the user owns the document or is an explicit
 * collaborator. There is no code path that reads a document without first
 * passing through this gate, which is how we guarantee one user can never touch
 * another tenant's data via the ORM (the app-layer equivalent of Postgres RLS;
 * see docs/security.md for the RLS policy we also ship for defense-in-depth).
 *
 * Role capabilities:
 *   OWNER  — full control incl. delete, manage collaborators
 *   EDITOR — read + push sync operations + snapshots/restore
 *   VIEWER — read only; MUST NOT push state updates (enforced in requireCanEdit)
 */
export type EffectiveRole = Role;

const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

/** Resolve a user's effective role for a document, or null if no access. */
export async function resolveRole(
  documentId: string,
  userId: string,
): Promise<EffectiveRole | null> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
    select: {
      ownerId: true,
      collaborators: { where: { userId }, select: { role: true } },
    },
  });
  if (!doc) return null;
  if (doc.ownerId === userId) return "OWNER";
  return doc.collaborators[0]?.role ?? null;
}

/** Assert the user has at least `min` privilege on the document; return role. */
export async function requireRole(
  documentId: string,
  userId: string,
  min: Role,
): Promise<EffectiveRole> {
  const role = await resolveRole(documentId, userId);
  if (role === null) {
    // 404 (not 403) so we don't leak the existence of documents to non-members.
    throw new AppError(ErrorCode.NOT_FOUND, "Document not found");
  }
  if (RANK[role] < RANK[min]) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      `This action requires ${min} access; you have ${role}`,
    );
  }
  return role;
}

/** Viewers cannot mutate. Enforces the "Viewer must never modify" rule. */
export async function requireCanEdit(documentId: string, userId: string) {
  return requireRole(documentId, userId, "EDITOR");
}

export async function requireOwner(documentId: string, userId: string) {
  return requireRole(documentId, userId, "OWNER");
}
