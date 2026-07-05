import { cache } from "react";
import { auth } from "./config";
import { AppError, ErrorCode } from "@/server/http/response";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

/**
 * Read the current session user. `cache()` dedupes the call within a single
 * server render/request so multiple components can call it without re-verifying.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
});

/** Assert an authenticated user or throw a 401. Use in services/actions. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required");
  return user;
}
