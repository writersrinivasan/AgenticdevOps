import { DEFAULT_MODEL, resolveGroqKey } from "@/lib/agents/llm";
import { getIncidentMemory } from "@/lib/agents/lab-graph";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = resolveGroqKey(req.headers.get("x-groq-key"));
  return Response.json({
    groq: Boolean(key),
    serverKey: Boolean(resolveGroqKey(null)),
    model: req.headers.get("x-groq-model") || DEFAULT_MODEL,
    incidentsInMemory: getIncidentMemory().length,
  });
}
