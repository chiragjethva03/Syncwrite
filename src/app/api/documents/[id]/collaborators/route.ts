import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody } from "@/server/http/guard";
import { AppError, ErrorCode } from "@/server/http/response";
import { requireUser } from "@/server/auth/session";
import {
  addCollaborator,
  removeCollaborator,
  updateCollaborator,
} from "@/server/services/document.service";
import {
  addCollaboratorSchema,
  updateCollaboratorSchema,
} from "@/server/validators/document";

export function POST(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/collaborators">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await readJsonBody(req, 4_096);
    const input = addCollaboratorSchema.parse(body);
    const result = await addCollaborator(user.id, id, input);
    return ok(result);
  });
}

export function PATCH(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/collaborators">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await readJsonBody(req, 4_096);
    const input = updateCollaboratorSchema.parse(body);
    const result = await updateCollaborator(user.id, id, input);
    return ok(result);
  });
}

export function DELETE(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/collaborators">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const targetUserId = req.nextUrl.searchParams.get("userId");
    if (!targetUserId) {
      throw new AppError(ErrorCode.VALIDATION, "Missing userId query parameter");
    }
    const result = await removeCollaborator(user.id, id, targetUserId);
    return ok(result);
  });
}
