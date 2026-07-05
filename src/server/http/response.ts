import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * A single, consistent API response envelope across every route handler.
 * Success:  { ok: true, data, meta? }
 * Error:    { ok: false, error: { code, message, details? } }
 *
 * A predictable shape means the client never has to guess how to read a
 * response, and error handling is uniform (see lib/api-client on the client).
 */
export type ApiMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
};

export type ApiSuccess<T> = { ok: true; data: T; meta?: ApiMeta };
export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS: Record<ErrorCodeValue, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
};

export function ok<T>(data: T, meta?: ApiMeta): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data, ...(meta ? { meta } : {}) });
}

export function fail(
  code: ErrorCodeValue,
  message: string,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status: STATUS[code] },
  );
}

/**
 * A typed error the service/repository layers throw; route handlers translate
 * it to the envelope. Keeps business logic free of HTTP concerns.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCodeValue,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Central error translator for route handlers (see http/handler). */
export function toErrorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return fail(ErrorCode.VALIDATION, "Invalid request payload", error.flatten());
  }
  console.error("[api] unhandled error:", error);
  return fail(ErrorCode.INTERNAL, "Something went wrong. Please try again.");
}
