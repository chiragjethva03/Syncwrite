import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody, getClientIp } from "@/server/http/guard";
import { rateLimit, RateLimits } from "@/server/http/rate-limit";
import { requireUser } from "@/server/auth/session";
import { runAiAction } from "@/server/services/ai.service";
import { aiRequestSchema } from "@/server/validators/ai";

export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    rateLimit({ key: `ai:${getClientIp(req)}:${user.id}`, ...RateLimits.ai });
    const body = await readJsonBody(req, 64_000);
    const input = aiRequestSchema.parse(body);
    const result = await runAiAction(user.id, input);
    return ok(result);
  });
}
