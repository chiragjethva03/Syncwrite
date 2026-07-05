import { z } from "zod";
import { cuid } from "./common";

export const aiActionSchema = z.enum([
  "summarize",
  "grammar",
  "improve",
  "title",
  "continue",
]);
export type AiAction = z.infer<typeof aiActionSchema>;

/** AI input is bounded to keep token usage + latency predictable. */
export const aiRequestSchema = z.object({
  documentId: cuid,
  action: aiActionSchema,
  // The selected / relevant text to operate on. Hard-capped.
  text: z.string().min(1, "Provide some text").max(20_000),
});
export type AiRequestInput = z.infer<typeof aiRequestSchema>;
