import { z } from "zod";

/** Reusable primitives shared across validators. */
export const cuid = z.string().min(1).max(64);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(["updatedAt", "createdAt", "title"]).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Bounded ProseMirror node schema.
 *
 * SECURITY: an attacker could send a deeply-nested or enormous document to
 * exhaust server memory (stack overflow on recursion, or heap OOM). We cap:
 *   - recursion depth (MAX_DEPTH)
 *   - children per node (MAX_CHILDREN)
 *   - text node length (MAX_TEXT)
 * Combined with the byte-size limit enforced before parsing, this makes a
 * malformed/oversized payload cheap to reject. See docs/security.md.
 */
const MAX_DEPTH = 40;
const MAX_CHILDREN = 5_000;
const MAX_TEXT = 50_000;

export type PMNodeInput = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNodeInput[];
  marks?: unknown[];
  text?: string;
};

function makeNodeSchema(depth: number): z.ZodType<PMNodeInput> {
  const base = z.object({
    type: z.string().min(1).max(64),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z.array(z.unknown()).max(50).optional(),
    text: z.string().max(MAX_TEXT).optional(),
  });
  if (depth >= MAX_DEPTH) {
    // At max depth we disallow further children rather than recursing.
    return base.strip() as unknown as z.ZodType<PMNodeInput>;
  }
  return base.extend({
    content: z
      .array(z.lazy(() => makeNodeSchema(depth + 1)))
      .max(MAX_CHILDREN)
      .optional(),
  }) as unknown as z.ZodType<PMNodeInput>;
}

export const proseMirrorNodeSchema = makeNodeSchema(0);

/** A full document root must be a `doc` node. */
export const proseMirrorDocSchema = proseMirrorNodeSchema.refine(
  (n) => n.type === "doc",
  { message: "Root node must be of type 'doc'" },
);
