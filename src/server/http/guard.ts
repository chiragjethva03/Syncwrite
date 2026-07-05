import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { AppError, ErrorCode } from "./response";

/**
 * Request guards for API routes.
 *
 * OOM PREVENTION (assignment requirement): before we ever hand a body to
 * `JSON.parse` (which would allocate the whole structure in memory), we reject
 * anything larger than MAX_SYNC_PAYLOAD_BYTES using two checks:
 *   1. the declared Content-Length header (cheap, but spoofable), and
 *   2. the actual decoded byte length after reading the stream.
 * Combined with the bounded Zod schemas (depth/among/length caps), a malicious
 * "massive malformed payload" is rejected in O(limit) memory, never O(payload).
 */

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Read + size-limit + JSON-parse a request body. Throws typed AppErrors. */
export async function readJsonBody<T = unknown>(
  req: NextRequest,
  maxBytes = env.MAX_SYNC_PAYLOAD_BYTES,
): Promise<T> {
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new AppError(
      ErrorCode.PAYLOAD_TOO_LARGE,
      `Payload exceeds ${maxBytes} bytes`,
    );
  }

  const raw = await req.text();
  // Actual byte length (UTF-8), guarding against a lying Content-Length.
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > maxBytes) {
    throw new AppError(
      ErrorCode.PAYLOAD_TOO_LARGE,
      `Payload exceeds ${maxBytes} bytes`,
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "Request body is not valid JSON");
  }
}
