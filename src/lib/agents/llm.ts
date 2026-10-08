import "server-only";
import { ChatGroq } from "@langchain/groq";

export const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
/** Investigators/executors use a faster model with its own rate-limit budget (Groq limits are per model). */
export const FAST_MODEL = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

/** Key from the request (Settings dialog) wins over the env var. */
export function resolveGroqKey(headerKey?: string | null): string | undefined {
  const k = (headerKey || process.env.GROQ_API_KEY || "").trim();
  return k.length > 10 ? k : undefined;
}

export function createGroq(apiKey: string, model?: string, temperature = 0.3) {
  const m = model || DEFAULT_MODEL;
  return new ChatGroq({
    apiKey,
    model: m,
    temperature,
    // Reasoning models spend tokens thinking before answering; keep it brisk for live demos
    maxTokens: 1200,
    maxRetries: 1,
    ...(/gpt-oss/.test(m) ? { reasoningEffort: "low" as const } : {}),
  });
}
