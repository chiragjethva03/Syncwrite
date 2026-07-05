import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { AppError, ErrorCode } from "@/server/http/response";
import { emptyProseMirrorDoc, fromProseMirror } from "@/domain/crdt/document";
import {
  accessibleWhere,
  findAccessibleById,
  listDocuments,
} from "@/server/repositories/document.repository";
import { requireOwner, requireRole } from "./access";
import { recordAudit } from "./audit.service";
import type { PaginationInput } from "@/server/validators/common";
import type {
  AddCollaboratorInput,
  CreateDocumentInput,
  RenameDocumentInput,
  UpdateCollaboratorInput,
} from "@/server/validators/document";

export async function createDocument(userId: string, input: CreateDocumentInput) {
  const initial = fromProseMirror(emptyProseMirrorDoc(), "server");
  const doc = await prisma.document.create({
    data: {
      title: input.title,
      ownerId: userId,
      content: initial as unknown as Prisma.InputJsonValue,
      versionVector: initial.versionVector as Prisma.InputJsonValue,
      contentText: "",
      serverVersion: 0,
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  await recordAudit({ userId, documentId: doc.id, action: "document.create" });
  return doc;
}

export function getDocuments(userId: string, params: PaginationInput) {
  return listDocuments(userId, params);
}

export async function getDocument(userId: string, documentId: string) {
  const doc = await findAccessibleById(userId, documentId);
  if (!doc) throw new AppError(ErrorCode.NOT_FOUND, "Document not found");
  const role = doc.ownerId === userId
    ? "OWNER"
    : doc.collaborators.find((c) => c.user.id === userId)?.role ?? "VIEWER";
  return { ...doc, role };
}

export async function renameDocument(
  userId: string,
  documentId: string,
  input: RenameDocumentInput,
) {
  await requireRole(documentId, userId, "EDITOR");
  const doc = await prisma.document.update({
    where: { id: documentId },
    data: { title: input.title },
    select: { id: true, title: true, updatedAt: true },
  });
  await recordAudit({ userId, documentId, action: "document.rename" });
  return doc;
}

export async function deleteDocument(userId: string, documentId: string) {
  await requireOwner(documentId, userId);
  // Soft delete: preserves history and avoids destroying collaborators' state.
  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });
  await recordAudit({ userId, documentId, action: "document.delete" });
  return { id: documentId };
}

export async function addCollaborator(
  userId: string,
  documentId: string,
  input: AddCollaboratorInput,
) {
  await requireOwner(documentId, userId);
  const invitee = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!invitee) throw new AppError(ErrorCode.NOT_FOUND, "No user with that email");

  const owner = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true },
  });
  if (owner?.ownerId === invitee.id) {
    throw new AppError(ErrorCode.CONFLICT, "That user already owns this document");
  }

  const collaborator = await prisma.collaborator.upsert({
    where: { documentId_userId: { documentId, userId: invitee.id } },
    create: { documentId, userId: invitee.id, role: input.role },
    update: { role: input.role },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  await recordAudit({
    userId,
    documentId,
    action: "collaborator.add",
    metadata: { invitee: invitee.id, role: input.role },
  });
  return collaborator;
}

export async function updateCollaborator(
  userId: string,
  documentId: string,
  input: UpdateCollaboratorInput,
) {
  await requireOwner(documentId, userId);
  const collaborator = await prisma.collaborator.update({
    where: { documentId_userId: { documentId, userId: input.userId } },
    data: { role: input.role },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  await recordAudit({ userId, documentId, action: "collaborator.update" });
  return collaborator;
}

export async function removeCollaborator(
  userId: string,
  documentId: string,
  collaboratorUserId: string,
) {
  await requireOwner(documentId, userId);
  await prisma.collaborator
    .delete({
      where: { documentId_userId: { documentId, userId: collaboratorUserId } },
    })
    .catch(() => {
      throw new AppError(ErrorCode.NOT_FOUND, "Collaborator not found");
    });
  await recordAudit({ userId, documentId, action: "collaborator.remove" });
  return { userId: collaboratorUserId };
}

/** Recent documents for the dashboard "recent" strip. */
export function getRecentDocuments(userId: string, take = 6) {
  return prisma.document.findMany({
    where: accessibleWhere(userId),
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, title: true, updatedAt: true },
  });
}
