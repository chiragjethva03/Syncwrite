import type { NextResponse } from "next/server";
import { toErrorResponse, type ApiError } from "./response";

/**
 * Wrap a route handler body so every thrown error (AppError, ZodError, or
 * unexpected) is translated to the consistent API envelope. Keeps individual
 * route handlers free of repetitive try/catch and guarantees no raw stack trace
 * ever leaks to a client.
 */
export async function handle<T>(
  fn: () => Promise<NextResponse<T>>,
): Promise<NextResponse<T> | NextResponse<ApiError>> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error);
  }
}
