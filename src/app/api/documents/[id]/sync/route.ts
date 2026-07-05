import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody, getClientIp } from "@/server/http/guard";
import { rateLimit, RateLimits } from "@/server/http/rate-limit";
import { requireUser } from "@/server/auth/session";
import { pullChanges, pushOperations } from "@/server/services/sync.service";
import { pushSyncSchema, pullSyncSchema } from "@/server/validators/sync";

/** POST = push queued operations from the client and receive a converging delta. */
export function POST(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/sync">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    rateLimit({ key: `sync:${getClientIp(req)}:${user.id}`, ...RateLimits.sync });
    // Byte-size guard runs before parse (OOM protection).
    const body = await readJsonBody(req);
    const input = pushSyncSchema.parse({ ...(body as object), documentId: id });
    const result = await pushOperations(user.id, input);
    return ok(result);
  });
}

/** GET = pull remote changes since a known version (used on load + reconnect). */
export function GET(req: NextRequest, ctx: RouteContext<"/api/documents/[id]/sync">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const since = Number(req.nextUrl.searchParams.get("since") ?? "0");
    const input = pullSyncSchema.parse({ documentId: id, sinceVersion: since });
    const result = await pullChanges(user.id, input);
    return ok(result);
  });
}
