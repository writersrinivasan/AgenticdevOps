"use client";

import { useCallback, useReducer, useRef } from "react";
import type { AutonomyMode, LabEvent, Remediation, Scenario } from "@/lib/types";
import { useSettings } from "../providers";

export type AgentStatus = "idle" | "active" | "done" | "waiting";

export interface ToolRun {
  id: string;
  agent: string;
  tool: string;
  args: Record<string, unknown>;
  output?: string;
}

export type FeedItem =
  | { kind: "message"; id: number; from: string; to: string[]; content: string; intent: string; ts: number }
  | { kind: "tool"; id: number; run: ToolRun; ts: number }
  | { kind: "decision"; id: number; approved: boolean; by: string; comment?: string; auto?: boolean; ts: number }
  | { kind: "system"; id: number; text: string; tone: "info" | "warn" | "memory"; ts: number };

export interface AuditRow {
  ts: string;
  actor: string;
  action: string;
  result: string;
}

export interface Approval {
  remediation: Remediation;
  proposal: string;
  policy: string;
}

export interface LabState {
  status: "idle" | "running" | "awaiting" | "done" | "error";
  threadId?: string;
  mode?: "groq" | "simulated";
  model?: string;
  agents: Record<string, { status: AgentStatus; text: string; tools: ToolRun[] }>;
  feed: FeedItem[];
  edgePulses: Record<string, number>;
  audit: AuditRow[];
  recovery: number[] | null;
  approval: Approval | null;
  decision: { approved: boolean; by: string; auto?: boolean } | null;
  report: string;
  reportFinal: boolean;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  toolCount: number;
  messageCount: number;
}

function initial(s: Scenario): LabState {
  return {
    status: "idle",
    agents: Object.fromEntries(s.agents.map((a) => [a.id, { status: "idle" as AgentStatus, text: "", tools: [] }])),
    feed: [],
    edgePulses: {},
    audit: [],
    recovery: null,
    approval: null,
    decision: null,
    report: "",
    reportFinal: false,
    toolCount: 0,
    messageCount: 0,
  };
}

type Action = { type: "reset"; scenario: Scenario } | { type: "event"; ev: LabEvent; reporterId: string } | { type: "resuming" };

let seq = 0;

function reducer(state: LabState, action: Action): LabState {
  if (action.type === "reset") return initial(action.scenario);
  if (action.type === "resuming") return { ...state, status: "running", approval: null };

  const { ev, reporterId } = action;
  const now = Date.now();
  const patchAgent = (id: string, p: Partial<LabState["agents"][string]>) => ({
    ...state.agents,
    [id]: { ...(state.agents[id] ?? { status: "idle", text: "", tools: [] }), ...p },
  });

  switch (ev.type) {
    case "run_start":
      return {
        ...state,
        status: "running",
        threadId: ev.threadId,
        mode: ev.mode,
        model: ev.model,
        startedAt: now,
        feed: [
          {
            kind: "system",
            id: ++seq,
            ts: now,
            tone: "info",
            text: ev.mode === "groq" ? `LangGraph run started · reasoning on Groq (${ev.model})` : "LangGraph run started · simulated reasoning (no Groq key)",
          },
        ],
      };
    case "agent_start": {
      const cur = state.agents[ev.agent];
      if (cur?.status === "done") return state;
      return { ...state, agents: patchAgent(ev.agent, { status: "active", text: cur?.status === "waiting" ? cur.text : "" }) };
    }
    case "token": {
      const cur = state.agents[ev.agent];
      const agents = patchAgent(ev.agent, { text: (cur?.text ?? "") + ev.delta });
      if (ev.agent === reporterId) return { ...state, agents, report: state.report + ev.delta };
      return { ...state, agents };
    }
    case "token_reset":
      return {
        ...state,
        agents: patchAgent(ev.agent, { text: "" }),
        report: ev.agent === reporterId ? "" : state.report,
      };
    case "tool_call": {
      const run: ToolRun = { id: ev.id, agent: ev.agent, tool: ev.tool, args: ev.args };
      const cur = state.agents[ev.agent];
      return {
        ...state,
        toolCount: state.toolCount + 1,
        agents: patchAgent(ev.agent, { tools: [...(cur?.tools ?? []), run] }),
        feed: [...state.feed, { kind: "tool", id: ++seq, run, ts: now }],
      };
    }
    case "tool_result": {
      const cur = state.agents[ev.agent];
      return {
        ...state,
        agents: patchAgent(ev.agent, { tools: (cur?.tools ?? []).map((t) => (t.id === ev.id ? { ...t, output: ev.output } : t)) }),
        feed: state.feed.map((f) => (f.kind === "tool" && f.run.id === ev.id ? { ...f, run: { ...f.run, output: ev.output } } : f)),
      };
    }
    case "agent_done":
      return { ...state, agents: patchAgent(ev.agent, { status: "done" }) };
    case "message": {
      const pulses = { ...state.edgePulses };
      for (const to of ev.to) pulses[`${ev.from}->${to}`] = now;
      return {
        ...state,
        edgePulses: pulses,
        messageCount: state.messageCount + 1,
        feed: [...state.feed, { kind: "message", id: ++seq, from: ev.from, to: ev.to, content: ev.content, intent: ev.intent, ts: now }],
      };
    }
    case "approval_required":
      return {
        ...state,
        status: "awaiting",
        approval: { remediation: ev.remediation, proposal: ev.proposal, policy: ev.policy },
        agents: patchAgent(Object.keys(state.agents).find((k) => k === "human") ?? "human", { status: "waiting" }),
      };
    case "decision":
      return {
        ...state,
        decision: { approved: ev.approved, by: ev.by, auto: ev.auto },
        feed: [...state.feed, { kind: "decision", id: ++seq, approved: ev.approved, by: ev.by, comment: ev.comment, auto: ev.auto, ts: now }],
      };
    case "metric_update":
      return { ...state, recovery: ev.values };
    case "audit":
      return { ...state, audit: [...state.audit, { ts: ev.ts, actor: ev.actor, action: ev.action, result: ev.result }] };
    case "memory":
      return { ...state, feed: [...state.feed, { kind: "system", id: ++seq, ts: now, tone: "memory", text: ev.content }] };
    case "warning":
      return { ...state, feed: [...state.feed, { kind: "system", id: ++seq, ts: now, tone: "warn", text: ev.message }] };
    case "report":
      return { ...state, report: ev.markdown, reportFinal: true };
    case "paused":
      return state;
    case "done":
      return { ...state, status: "done", finishedAt: now };
    case "error":
      return { ...state, status: "error", error: ev.message };
  }
}

export function useLabRun(scenario: Scenario) {
  const [state, dispatch] = useReducer(reducer, scenario, initial);
  const { headers } = useSettings();
  const abortRef = useRef<AbortController | null>(null);
  const reporterId = scenario.stages[scenario.stages.length - 1][0];

  const consume = useCallback(
    async (body: object) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/lab/run", { method: "POST", headers: headers(), body: JSON.stringify(body), signal: ac.signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const p of parts) {
            const line = p.trim();
            if (!line.startsWith("data:")) continue;
            dispatch({ type: "event", ev: JSON.parse(line.slice(5)) as LabEvent, reporterId });
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          dispatch({ type: "event", ev: { type: "error", message: (e as Error).message }, reporterId });
        }
      }
    },
    [headers, reporterId],
  );

  const start = useCallback(
    (opts: { autonomy: AutonomyMode; speed: number }) => {
      dispatch({ type: "reset", scenario });
      const threadId = `${scenario.id}-${Date.now().toString(36)}`;
      void consume({ scenarioId: scenario.id, threadId, ...opts });
    },
    [consume, scenario],
  );

  const resume = useCallback(
    (decision: { approved: boolean; by: string; comment?: string }, opts: { autonomy: AutonomyMode; speed: number }) => {
      if (!state.threadId) return;
      dispatch({ type: "resuming" });
      void consume({ scenarioId: scenario.id, threadId: state.threadId, resume: decision, ...opts });
    },
    [consume, scenario.id, state.threadId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset", scenario });
  }, [scenario]);

  return { state, start, resume, reset };
}
