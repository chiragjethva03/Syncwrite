import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireUser } from "@/server/auth/session";
import { getVersionContent } from "@/server/services/version.service";

export function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]/versions/[versionId]">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { id, versionId } = await ctx.params;
    const version = await getVersionContent(user.id, id, versionId);
    return ok(version);
  });
}
