import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireUser } from "@/server/auth/session";
import { restoreVersion } from "@/server/services/version.service";

export function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]/versions/[versionId]/restore">,
) {
  return handle(async () => {
    const user = await requireUser();
    const { id, versionId } = await ctx.params;
    const result = await restoreVersion(user.id, id, versionId);
    return ok(result);
  });
}
