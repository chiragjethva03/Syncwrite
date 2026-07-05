import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";
import { AppError, ErrorCode } from "@/server/http/response";
import { requireRole } from "./access";
import { recordAudit } from "./audit.service";
import type { AiAction, AiRequestInput } from "@/server/validators/ai";

/**
 * AI writing assistant, backed by Google Gemini.
 *
 * Design:
 *  - Access-gated: the caller must have at least VIEWER access to the document,
 *    so AI can't be used to exfiltrate content the user can't already read.
 *  - Input is length-capped upstream (validators/ai) to bound token cost.
 *  - Degrades gracefully: without a GEMINI_API_KEY the feature returns a clear,
 *    non-crashing error so the rest of the app keeps working.
 */

const MODEL = env.GEMINI_MODEL;

/** Extract an HTTP status from a Gemini SDK error (shape varies by version). */
function statusOf(error: unknown): number | undefined {
  const e = error as { status?: number; message?: string };
  if (typeof e?.status === "number") return e.status;
  const m = /\[(\d{3})\s/.exec(e?.message ?? "");
  return m ? Number(m[1]) : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROMPTS: Record<AiAction, (text: string) => string> = {
  summarize: (t) =>
    `Summarize the following document content in 3-4 concise sentences. Return only the summary.\n\n---\n${t}`,
  grammar: (t) =>
    `Fix spelling, grammar, and punctuation in the following text. Preserve meaning, tone, and formatting. Return only the corrected text.\n\n---\n${t}`,
  improve: (t) =>
    `Rewrite the following text to be clearer, more concise, and more engaging while preserving meaning. Return only the rewritten text.\n\n---\n${t}`,
  title: (t) =>
    `Suggest a single short, descriptive title (max 8 words) for the following document. Return only the title, with no quotes.\n\n---\n${t}`,
  continue: (t) =>
    `Continue writing the following text naturally for 2-3 sentences, matching its tone and style. Return only the continuation.\n\n---\n${t}`,
};

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      ErrorCode.INTERNAL,
      "AI is not configured on this server (missing GEMINI_API_KEY).",
    );
  }
  client ??= new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return client;
}

export async function runAiAction(
  userId: string,
  input: AiRequestInput,
): Promise<{ action: AiAction; result: string }> {
  await requireRole(input.documentId, userId, "VIEWER");

  const model = getClient().getGenerativeModel({
    model: MODEL,
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  });

  const prompt = PROMPTS[input.action](input.text);

  // One in-process retry to ride out a brief per-minute rate limit. A quota
  // that stays exhausted (daily cap / free-tier limit=0) is surfaced to the
  // client as 429 RATE_LIMITED rather than a generic 500, so the UI can show a
  // useful "try again shortly" message instead of a crash.
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await model.generateContent(prompt);
      const result = res.response.text().trim();
      await recordAudit({
        userId,
        documentId: input.documentId,
        action: `ai.${input.action}`,
      });
      return { action: input.action, result };
    } catch (error) {
      const status = statusOf(error);
      if (status === 429 && attempt === 0) {
        await sleep(1500);
        continue;
      }
      console.error("[ai] generation failed:", error);
      if (status === 429) {
        throw new AppError(
          ErrorCode.RATE_LIMITED,
          "The AI service is rate-limited or out of quota right now. Please try again in a moment.",
        );
      }
      throw new AppError(ErrorCode.INTERNAL, "The AI request failed. Please try again.");
    }
  }
}
