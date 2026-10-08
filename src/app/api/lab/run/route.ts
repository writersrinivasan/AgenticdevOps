import { Command } from "@langchain/langgraph";
import { getLabGraph, type Decision, type LabConfigurable } from "@/lib/agents/lab-graph";
import { DEFAULT_MODEL, resolveGroqKey } from "@/lib/agents/llm";
import type { AutonomyMode, LabEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  scenarioId: string;
  threadId: string;
  autonomy?: AutonomyMode;
  speed?: number;
  /** Present when resuming after the human approval interrupt */
  resume?: Decision;
}

/**
 * Runs (or resumes) a scenario's LangGraph and streams LabEvents as Server-Sent Events.
 * Node-level events come from `config.writer` (streamMode "custom").
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const groqKey = resolveGroqKey(req.headers.get("x-groq-key"));
  const model = req.headers.get("x-groq-model") || DEFAULT_MODEL;

  let graph, scenario;
  try {
    ({ graph, scenario } = getLabGraph(body.scenarioId));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 404 });
  }

  const configurable: LabConfigurable = {
    thread_id: body.threadId,
    groqKey,
    model,
    autonomy: body.autonomy ?? "hitl",
    speed: Math.min(4, Math.max(0.5, body.speed ?? 1)),
  };
  const config = { configurable, streamMode: ["custom"] as const, recursionLimit: 60 };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: LabEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          /* client went away */
        }
      };

      try {
        if (!body.resume) {
          send({
            type: "run_start",
            threadId: body.threadId,
            mode: groqKey ? "groq" : "simulated",
            model: groqKey ? model : undefined,
          });
        }
        const input = body.resume
          ? new Command({ resume: body.resume })
          : { scenarioId: scenario.id, startedAt: Date.now() };

        const iter = await graph.stream(input, config);
        for await (const chunk of iter) {
          // With a single stream mode we get the payload directly
          const ev = (Array.isArray(chunk) && chunk.length === 2 && chunk[0] === "custom" ? chunk[1] : chunk) as LabEvent;
          if (ev && typeof ev === "object" && "type" in ev) send(ev);
        }

        // Did we stop at the human approval gate?
        const snapshot = await graph.getState({ configurable });
        const pending = (snapshot.tasks ?? []).flatMap((t: { interrupts?: { value: unknown }[] }) => t.interrupts ?? []);
        if (pending.length) {
          const v = pending[0].value as Omit<Extract<LabEvent, { type: "approval_required" }>, "type">;
          send({ type: "approval_required", ...v });
          send({ type: "paused" });
        } else {
          send({ type: "done" });
        }
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
