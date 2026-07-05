import type { ApiResponse } from "@/server/http/response";

/**
 * Thin, typed fetch wrapper around our consistent API envelope.
 * Throws `ApiClientError` on non-ok responses so callers can `try/catch`
 * uniformly; returns the unwrapped `data` on success.
 */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError("INTERNAL", "Unexpected server response", res.status);
  }

  if (!body || body.ok === false) {
    const err = body?.ok === false ? body.error : undefined;
    throw new ApiClientError(
      err?.code ?? "INTERNAL",
      err?.message ?? "Request failed",
      res.status,
      err?.details,
    );
  }
  return body.data;
}
