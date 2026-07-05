import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { PaginationInput } from "@/server/validators/common";

/**
 * Document repository — the only place that builds document queries.
 *
 * Every read is scoped to documents the user owns OR collaborates on. Isolating
 * query construction here means tenant scoping can't be forgotten at a call site
 * (all callers go through these methods), and it's trivially auditable.
 */

/** WHERE clause matching only documents the user may see. */
export function accessibleWhere(userId: string): Prisma.DocumentWhereInput {
  return {
    deletedAt: null,
    OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }],
  };
}

const listSelect = {
  id: true,
  title: true,
  updatedAt: true,
  createdAt: true,
  ownerId: true,
  serverVersion: true,
  owner: { select: { id: true, name: true, email: true, image: true } },
  collaborators: {
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
} satisfies Prisma.DocumentSelect;

export async function listDocuments(userId: string, params: PaginationInput) {
  const where: Prisma.DocumentWhereInput = {
    ...accessibleWhere(userId),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { contentText: { contains: params.search, mode: "insensitive" } },
          ],
          AND: accessibleWhere(userId),
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select: listSelect,
      orderBy: { [params.sort]: params.order },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: params.page * params.pageSize < total,
  };
}

export async function findAccessibleById(userId: string, documentId: string) {
  return prisma.document.findFirst({
    where: { id: documentId, ...accessibleWhere(userId) },
    select: {
      ...listSelect,
      content: true,
      versionVector: true,
    },
  });
}
