import { z } from "zod";
import { cuid, proseMirrorNodeSchema } from "./common";

/**
 * Sync payload validation — the primary attack surface.
 *
 * Every bound here exists to make a malicious or malformed payload cheap to
 * reject BEFORE it can allocate unbounded memory or CPU:
 *   - MAX_BLOCKS_PER_OP caps how many blocks one op can carry.
 *   - MAX_OPS_PER_BATCH caps ops per request.
 *   - Lamport / version numbers are non-negative bounded ints.
 *   - Block nodes reuse the depth/size-bounded ProseMirror schema.
 * The byte-size guard in http/guard.ts runs even earlier, before JSON parsing.
 */
const MAX_BLOCKS_PER_OP = 2_000;
const MAX_OPS_PER_BATCH = 200;
const MAX_INT = 2_000_000_000;

export const stampedBlockSchema = z.object({
  id: z.string().min(1).max(64),
  fracIndex: z.string().min(1).max(512),
  node: proseMirrorNodeSchema.nullable(),
  lamport: z.number().int().min(0).max(MAX_INT),
  deviceId: z.string().min(1).max(64),
  deleted: z.boolean(),
});
export type StampedBlockInput = z.infer<typeof stampedBlockSchema>;

export const operationSchema = z.object({
  opId: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(64),
  lamport: z.number().int().min(0).max(MAX_INT),
  baseVersion: z.number().int().min(0).max(MAX_INT),
  timestamp: z.number().int().min(0),
  payload: z.array(stampedBlockSchema).max(MAX_BLOCKS_PER_OP),
});
export type OperationInput = z.infer<typeof operationSchema>;

export const pushSyncSchema = z.object({
  documentId: cuid,
  /** The version the client last knew about, so the server can send back a delta. */
  sinceVersion: z.number().int().min(0).max(MAX_INT),
  operations: z.array(operationSchema).min(1).max(MAX_OPS_PER_BATCH),
});
export type PushSyncInput = z.infer<typeof pushSyncSchema>;

export const pullSyncSchema = z.object({
  documentId: cuid,
  sinceVersion: z.number().int().min(0).max(MAX_INT),
});
export type PullSyncInput = z.infer<typeof pullSyncSchema>;
