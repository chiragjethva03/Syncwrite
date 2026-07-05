import { z } from "zod";

/**
 * Runtime environment validation.
 *
 * We validate env vars once, at module load, with Zod. This fails fast with a
 * readable error instead of surfacing `undefined` deep inside a request handler
 * at 2am. Server-only secrets are never imported into client bundles because
 * this module is only ever imported from server code.
 */
/** Treat empty-string env vars ("") as absent for optional values. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres URL"),
  // Direct (non-pooled) connection used by Prisma migrations on Supabase.
  DIRECT_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 chars (openssl rand -base64 32)"),
  // Google OAuth (optional). Absent => the "Continue with Google" button is
  // simply inactive; email/password auth still works.
  AUTH_GOOGLE_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  AUTH_GOOGLE_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // Gemini model id. Overridable so we can move off a model whose free-tier
  // quota Google has zeroed out (e.g. gemini-2.0-flash) without a code change.
  GEMINI_MODEL: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("gemini-2.5-flash"),
  ),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Max accepted sync payload size in bytes. Guards against OOM from a
  // malicious oversized body. Defaults to 1 MiB.
  MAX_SYNC_PAYLOAD_BYTES: z.coerce.number().int().positive().default(1_048_576),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // During `next build` some env may be intentionally absent; only throw at
    // runtime. We still log the issues so misconfig is visible.
    const flat = parsed.error.flatten().fieldErrors;
    const message = `Invalid environment variables:\n${JSON.stringify(flat, null, 2)}`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`[env] ${message}`);
    return process.env as unknown as ServerEnv;
  }
  return parsed.data;
}

export const env = loadEnv();
