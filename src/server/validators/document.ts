import { z } from "zod";
import { cuid } from "./common";

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled document"),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const renameDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(200),
});
export type RenameDocumentInput = z.infer<typeof renameDocumentSchema>;

export const roleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

export const addCollaboratorSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: roleSchema.exclude(["OWNER"]).default("VIEWER"),
});
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;

export const updateCollaboratorSchema = z.object({
  userId: cuid,
  role: roleSchema.exclude(["OWNER"]),
});
export type UpdateCollaboratorInput = z.infer<typeof updateCollaboratorSchema>;
