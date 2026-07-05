import { z } from "zod";
import { cuid } from "./common";

export const createVersionSchema = z.object({
  label: z.string().trim().max(120).optional(),
});
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const restoreVersionSchema = z.object({
  versionId: cuid,
});
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;
