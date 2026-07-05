import type { NextRequest } from "next/server";
import { handle } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { readJsonBody, getClientIp } from "@/server/http/guard";
import { rateLimit, RateLimits } from "@/server/http/rate-limit";
import { registerUser } from "@/server/auth/register";
import { registerSchema } from "@/server/validators/auth";

export function POST(req: NextRequest) {
  return handle(async () => {
    rateLimit({ key: `register:${getClientIp(req)}`, ...RateLimits.auth });
    const body = await readJsonBody(req, 8_192); // registration is tiny
    const input = registerSchema.parse(body);
    const user = await registerUser(input);
    return ok(user);
  });
}
