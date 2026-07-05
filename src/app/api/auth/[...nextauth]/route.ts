import { handlers } from "@/server/auth/config";

// Auth.js mounts its GET/POST endpoints (sign-in, callback, session, csrf...).
export const { GET, POST } = handlers;
