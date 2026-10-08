import { AIMessage, AIMessageChunk, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { buildAssistantGraph } from "@/lib/agents/assistant-graph";
import { DEFAULT_MODEL, resolveGroqKey } from "@/lib/agents/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const NO_KEY = `👋 I'm **Agent Ops Copilot**, your LangGraph + Groq teaching assistant.

No Groq API key is configured yet, so I can't answer live. To enable me:

1. Get a free key at **console.groq.com/keys**
2. Either add \`GROQ_API_KEY=gsk_...\` to \`.env.local\` and restart, **or** click the ⚙️ settings icon in the top bar and paste it.

Meanwhile the **Live Agent Lab** still works in *simulated mode*, with scripted agent reasoning.`;

/** Streams newline-delimited JSON: {t:"token",v} | {t:"tool",v} | {t:"done"} | {t:"error",v} */
export async function POST(req: Request) {
  const { messages, context } = (await req.json()) as { messages: ChatMsg[]; context?: string };
  const key = resolveGroqKey(req.headers.get("x-groq-key"));
  const model = req.headers.get("x-groq-model") || DEFAULT_MODEL;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (!key) {
          for (const w of NO_KEY.split(/(\s+)/)) send({ t: "token", v: w });
          send({ t: "done" });
          return;
        }
        const graph = buildAssistantGraph(key, model, context);
        const history: BaseMessage[] = messages
          .slice(-12)
          .map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));

        const iter = await graph.stream({ messages: history }, { streamMode: "messages", recursionLimit: 12 });
        for await (const [chunk, meta] of iter as AsyncIterable<[BaseMessage, { langgraph_node?: string }]>) {
          if (meta?.langgraph_node === "assistant" && AIMessageChunk.isInstance(chunk)) {
            const text = typeof chunk.content === "string" ? chunk.content : "";
            if (text) send({ t: "token", v: text });
            for (const tc of chunk.tool_call_chunks ?? []) if (tc.name) send({ t: "tool", v: tc.name });
          }
        }
        send({ t: "done" });
      } catch (e) {
        send({ t: "error", v: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
