import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody, getClientIp } from "@/server/http/guard";
import { rateLimit, RateLimits } from "@/server/http/rate-limit";
import { requireUser } from "@/server/auth/session";
import { createDocument, getDocuments } from "@/server/services/document.service";
import { createDocumentSchema } from "@/server/validators/document";
import { paginationSchema } from "@/server/validators/common";

export function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const params = paginationSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    const result = await getDocuments(user.id, params);
    return ok(result.items, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
    });
  });
}

export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    rateLimit({ key: `doc-create:${getClientIp(req)}`, ...RateLimits.mutation });
    const body = await readJsonBody(req, 4_096);
    const input = createDocumentSchema.parse(body);
    const doc = await createDocument(user.id, input);
    return ok(doc);
  });
}
