import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody } from "@/server/http/guard";
import { requireUser } from "@/server/auth/session";
import { createSnapshot, listVersions } from "@/server/services/version.service";
import { createVersionSchema } from "@/server/validators/version";

export function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]/versions">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const versions = await listVersions(user.id, id);
    return ok(versions);
  });
}

export function POST(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/versions">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await readJsonBody(req, 4_096);
    const input = createVersionSchema.parse(body);
    const version = await createSnapshot(user.id, id, input.label);
    return ok(version);
  });
}
