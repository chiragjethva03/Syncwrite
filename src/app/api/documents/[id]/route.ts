import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody } from "@/server/http/guard";
import { requireUser } from "@/server/auth/session";
import {
  deleteDocument,
  getDocument,
  renameDocument,
} from "@/server/services/document.service";
import { renameDocumentSchema } from "@/server/validators/document";

export function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const doc = await getDocument(user.id, id);
    return ok(doc);
  });
}

export function PATCH(req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await readJsonBody(req, 4_096);
    const input = renameDocumentSchema.parse(body);
    const doc = await renameDocument(user.id, id, input);
    return ok(doc);
  });
}

export function DELETE(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const result = await deleteDocument(user.id, id);
    return ok(result);
  });
}
