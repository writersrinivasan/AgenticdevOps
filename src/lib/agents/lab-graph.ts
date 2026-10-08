/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DEFAULT_MODEL as DEFAULT_MODEL_ID, FAST_MODEL, createGroq } from "./llm";
import { downstreamOf, getScenario } from "../scenarios";
import type { AgentDef, AutonomyMode, LabEvent, RiskLevel, Scenario } from "../types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface Decision {
  approved: boolean;
  by: string;
  comment?: string;
  auto?: boolean;
}

interface TimelineEntry {
  t: number;
  who: string;
  what: string;
}

const LabState = Annotation.Root({
  scenarioId: Annotation<string>(),
  startedAt: Annotation<number>(),
  /** agentId → finding text (merged as parallel branches complete) */
  findings: Annotation<Record<string, string>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  decision: Annotation<Decision | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  timeline: Annotation<TimelineEntry[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
});

type LabStateT = typeof LabState.State;

export interface LabConfigurable {
  thread_id: string;
  groqKey?: string;
  model?: string;
  autonomy: AutonomyMode;
  speed: number;
}

// ---------------------------------------------------------------------------
// Long-term memory shared across runs (Module 9.3: incident history)
// ---------------------------------------------------------------------------

interface IncidentMemory {
  id: string;
  scenarioId: string;
  title: string;
  rootCause: string;
  resolution: string;
  at: string;
}

const g = globalThis as unknown as {
  __labSaver?: MemorySaver;
  __labGraphs?: Map<string, any>;
  __incidentMemory?: IncidentMemory[];
};
g.__labSaver ??= new MemorySaver();
g.__labGraphs ??= new Map();
g.__incidentMemory ??= [];

export const checkpointer = g.__labSaver;
const incidentMemory = g.__incidentMemory;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cfgOf(config: LangGraphRunnableConfig): LabConfigurable {
  return (config.configurable ?? {}) as LabConfigurable;
}

function emit(config: LangGraphRunnableConfig, ev: LabEvent) {
  config.writer?.(ev);
}

function pace(config: LangGraphRunnableConfig, ms: number) {
  const speed = cfgOf(config).speed || 1;
  return sleep((ms * (0.75 + Math.random() * 0.5)) / speed);
}

function audit(config: LangGraphRunnableConfig, actor: string, action: string, result: string) {
  emit(config, { type: "audit", ts: new Date().toISOString(), actor, action, result });
}

function nameOf(s: Scenario, id: string) {
  return s.agents.find((a) => a.id === id)?.name ?? id;
}

function firstSentence(text: string) {
  const m = text.match(/^(.{20,220}?[.!?])(\s|$)/);
  return (m ? m[1] : text.slice(0, 200)).trim();
}

export function policyFor(risk: RiskLevel, autonomy: AutonomyMode): string {
  if (risk === "low")
    return autonomy === "autonomous"
      ? "LOW risk + autonomous mode → auto-approved by policy (logged)"
      : "LOW risk, but Human-in-the-loop mode is on → approval requested";
  if (risk === "medium") return "MEDIUM risk → approval workflow: on-call engineer must approve";
  return "HIGH risk → mandatory human intervention, even in autonomous mode";
}

/** Streams text into the UI token by token; uses Groq when a key is set, otherwise the scripted answer. */
async function think(
  s: Scenario,
  agent: AgentDef,
  state: LabStateT,
  toolOutputs: string[],
  config: LangGraphRunnableConfig,
  override?: { system?: string; user?: string; fallback?: string },
): Promise<string> {
  const { groqKey, model } = cfgOf(config);
  const fallback = override?.fallback ?? agent.fallback;

  const upstream = Object.entries(state.findings)
    .map(([id, f]) => `- ${nameOf(s, id)}: ${f}`)
    .join("\n");

  const system =
    override?.system ??
    `You are the "${agent.name}", one agent in a LangGraph multi-agent DevOps system at ${s.company}.
Your role: ${agent.role}.
${agent.instructions ?? "Report your single most important finding and what it implies for the investigation."}
Rules:
- Base every claim ONLY on the alert, upstream findings and your tool outputs below. Never invent hostnames, numbers, versions or commands.
- Quote concrete numbers and identifiers from the evidence.
- Reply in 2-4 sentences, max 90 words, plain text. No markdown headings, no bullet lists, no preamble.`;

  const handoff = downstreamOf(s, agent.id).map((id) => `${nameOf(s, id)} (${s.agents.find((a) => a.id === id)?.role})`);
  const team = handoff.length
    ? `\nYOUR OUTPUT GOES TO (only delegate to / address these agents, never invent others): ${handoff.join("; ")}`
    : "";
  const policy =
    agent.kind === "planner"
      ? `\nPLATFORM RISK ENGINE (authoritative, do not override): the candidate action "${s.remediation.title}" is classified ${s.remediation.risk.toUpperCase()} risk; blast radius: ${s.remediation.blastRadius}.`
      : "";

  const user =
    override?.user ??
    `INCIDENT ALERT: ${s.alert.title} (${s.alert.details})
SERVICE: ${s.service} | INDUSTRY: ${s.industry}${team}${policy}

UPSTREAM FINDINGS FROM OTHER AGENTS:
${upstream || "(none yet - you are first)"}

YOUR TOOL OUTPUTS:
${toolOutputs.join("\n\n") || "(no tools - reason over upstream findings)"}`;

  if (groqKey) {
    // Heavy reasoning (planning, RCA, reports) on the main model; evidence gathering on the fast model
    const heavy = ["planner", "analyst", "reporter"].includes(agent.kind);
    const useModel = heavy || model !== DEFAULT_MODEL_ID ? model : FAST_MODEL;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const llm = createGroq(groqKey, useModel);
        let text = "";
        const stream = await llm.stream([new SystemMessage(system), new HumanMessage(user)]);
        for await (const chunk of stream) {
          const delta = typeof chunk.content === "string" ? chunk.content : "";
          if (delta) {
            text += delta;
            emit(config, { type: "token", agent: agent.id, delta });
          }
        }
        if (text.trim()) return text.trim();
        break;
      } catch (err) {
        // Discard any partial tokens streamed before the failure
        emit(config, { type: "token_reset", agent: agent.id });
        const msg = (err as Error).message ?? "";
        const wait = Number(msg.match(/try again in ([\d.]+)s/)?.[1] ?? 6);
        if (attempt === 0 && msg.includes("429") && wait <= 20) {
          emit(config, { type: "warning", message: `Groq rate limit (free tier) for ${agent.name}: retrying in ${Math.ceil(wait)}s…` });
          await sleep(wait * 1000 + 300);
          continue;
        }
        emit(config, {
          type: "warning",
          message: `Groq call failed for ${agent.name} (${msg.slice(0, 120)}). Falling back to simulated reasoning.`,
        });
        break;
      }
    }
  }

  // Simulated mode: stream the scripted answer word by word
  const words = fallback.split(/(\s+)/);
  for (const w of words) {
    emit(config, { type: "token", agent: agent.id, delta: w });
    if (w.trim()) await pace(config, 28);
  }
  return fallback;
}

function messageIntent(agent: AgentDef): string {
  switch (agent.kind) {
    case "supervisor":
      return "delegate";
    case "investigator":
      return "evidence";
    case "analyst":
      return "analysis";
    case "planner":
      return "proposal";
    case "executor":
      return "execution";
    case "validator":
      return "validation";
    default:
      return "update";
  }
}

// ---------------------------------------------------------------------------
// Node factories
// ---------------------------------------------------------------------------

function agentNode(s: Scenario, agent: AgentDef, stage: number) {
  return async (state: LabStateT, config: LangGraphRunnableConfig) => {
    emit(config, { type: "agent_start", agent: agent.id, stage });
    await pace(config, 350);

    const outputs: string[] = [];
    for (const [i, tool] of (agent.tools ?? []).entries()) {
      const id = `${agent.id}-${i}`;
      emit(config, { type: "tool_call", agent: agent.id, tool: tool.name, args: tool.args, id });
      await pace(config, 900);
      let output = tool.output;
      // Long-term memory: past incidents resolved earlier in this server session
      if (tool.name === "search_incident_history" && incidentMemory.length) {
        const recalled = incidentMemory
          .slice(-3)
          .map((m) => `${m.id} (${m.at}) '${m.title}' root cause: ${m.rootCause}`)
          .join("\n");
        output += `\n[agent memory] ${recalled}`;
        emit(config, { type: "memory", content: `Recalled ${Math.min(3, incidentMemory.length)} past incident(s) from long-term memory` });
      }
      emit(config, { type: "tool_result", agent: agent.id, tool: tool.name, output, id });
      audit(
        config,
        agent.name,
        `${tool.name}(${Object.entries(tool.args).map(([k, v]) => `${k}=${v}`).join(", ")})`,
        agent.kind === "executor" ? "EXECUTED (approved)" : agent.kind === "planner" ? "draft created" : "read-only OK",
      );
      outputs.push(`$ ${tool.name} ${JSON.stringify(tool.args)}\n${output}`);
    }

    if (agent.kind === "validator") {
      emit(config, { type: "metric_update", phase: "recovery", values: s.metric.after });
    }

    const text = await think(s, agent, state, outputs, config);
    emit(config, { type: "agent_done", agent: agent.id, summary: text });

    const to = downstreamOf(s, agent.id);
    if (to.length) {
      emit(config, { type: "message", from: agent.id, to, content: firstSentence(text), intent: messageIntent(agent) });
    }

    return {
      findings: { [agent.id]: text },
      timeline: [{ t: Date.now(), who: agent.name, what: firstSentence(text) }],
    };
  };
}

function humanNode(s: Scenario, agent: AgentDef, stage: number) {
  const plannerId = s.agents.find((a) => a.kind === "planner")?.id ?? s.stages[stage - 1]?.[0];
  const executorId = s.stages[stage + 1]?.[0];
  const reporterId = s.stages[s.stages.length - 1][0];

  return async (state: LabStateT, config: LangGraphRunnableConfig) => {
    const { autonomy } = cfgOf(config);
    const r = s.remediation;
    const policy = policyFor(r.risk, autonomy);
    emit(config, { type: "agent_start", agent: agent.id, stage });

    let decision: Decision;
    if (autonomy === "autonomous" && r.risk === "low") {
      decision = { approved: true, by: "policy-engine", auto: true, comment: policy };
    } else {
      // ⏸  LangGraph interrupt: the graph is checkpointed and waits for a human.
      decision = interrupt({
        remediation: r,
        proposal: state.findings[plannerId] ?? "",
        policy,
      }) as Decision;
    }

    emit(config, { type: "decision", ...decision });
    audit(
      config,
      decision.by,
      `${decision.approved ? "APPROVED" : "REJECTED"}: ${r.title}`,
      decision.comment || policy,
    );
    const text = decision.approved
      ? `${decision.auto ? "Auto-approved by policy" : `Approved by ${decision.by}`}. ${decision.comment ?? ""}`.trim()
      : `Rejected by ${decision.by}. ${decision.comment ?? ""} Escalating to humans; no automated change will be made.`;
    emit(config, { type: "token", agent: agent.id, delta: text });
    emit(config, { type: "agent_done", agent: agent.id, summary: text });
    emit(config, {
      type: "message",
      from: agent.id,
      to: [decision.approved ? executorId : reporterId],
      content: decision.approved ? `Go: ${r.title}` : "Stop: escalate and document",
      intent: decision.approved ? "approval" : "escalation",
    });
    return {
      decision,
      findings: { [agent.id]: text },
      timeline: [{ t: Date.now(), who: decision.by, what: decision.approved ? "Approved remediation" : "Rejected remediation" }],
    };
  };
}

function templateReport(s: Scenario, state: LabStateT): string {
  const d = state.decision;
  const f = state.findings;
  const mins = Math.max(1, Math.round((Date.now() - (state.startedAt ?? Date.now())) / 60000));
  const rca = s.agents.find((a) => a.kind === "planner" || a.id === "rca");
  const lines = [
    `# Post-Incident Report: ${s.title}`,
    `**Severity:** ${s.severity} · **Service:** ${s.service} · **Company:** ${s.company}`,
    `**Status:** ${d?.approved ? "✅ Resolved by agent remediation" : "⚠️ Escalated to humans (remediation rejected)"}`,
    "",
    "## Summary",
    `${s.alert.title}. ${rca ? firstSentence(f[rca.id] ?? rca.fallback) : ""}`,
    "",
    "## Root-cause hypothesis",
    f["rca"] ?? (rca ? f[rca.id] : "") ?? "",
    "",
    "## Remediation",
    `- **Action:** ${s.remediation.title}`,
    `- **Risk:** ${s.remediation.risk.toUpperCase()} · **Blast radius:** ${s.remediation.blastRadius}`,
    `- **Decision:** ${d ? `${d.approved ? "Approved" : "Rejected"} by ${d.by}${d.comment ? ` ("${d.comment}")` : ""}` : "n/a"}`,
    d?.approved ? `- **Validation:** ${f["validator"] ?? ""}` : `- **Rollback plan kept on hand:** ${s.remediation.rollbackPlan}`,
    "",
    "## Timeline",
    ...state.timeline.map((e) => `- \`${new Date(e.t).toISOString().slice(11, 19)}\` **${e.who}**: ${e.what}`),
    "",
    "## Action items",
    ...s.lessons.map((l) => `- [ ] ${l}`),
    "",
    `_Agent-assisted time to ${d?.approved ? "resolution" : "escalation"}: ~${mins} min. Stored in long-term incident memory._`,
  ];
  return lines.join("\n");
}

function reporterNode(s: Scenario, agent: AgentDef, stage: number) {
  return async (state: LabStateT, config: LangGraphRunnableConfig) => {
    emit(config, { type: "agent_start", agent: agent.id, stage });
    await pace(config, 400);
    const template = templateReport(s, state);
    const { groqKey } = cfgOf(config);

    let markdown = template;
    if (groqKey) {
      const evidence = Object.entries(state.findings)
        .map(([id, t]) => `- ${nameOf(s, id)}: ${t}`)
        .join("\n");
      markdown = await think(s, agent, state, [], config, {
        system: `You are the ${agent.name}. Write a concise, blameless post-incident report in GitHub markdown for engineers and leadership. Use ONLY the facts provided. Sections: "# Post-Incident Report: <title>", "## Summary" (2 sentences), "## Impact", "## Root cause", "## Resolution & validation" (or "## Escalation" if the remediation was rejected), "## Timeline" (bullets with UTC times), "## Action items" (checkbox bullets), "## What the agents did well / what to improve". Max 350 words.`,
        user: `Scenario: ${s.title} at ${s.company} (${s.severity}). Alert: ${s.alert.title}.
Decision: ${JSON.stringify(state.decision)}
Remediation: ${s.remediation.title} (risk ${s.remediation.risk}).
Agent findings:\n${evidence}
Timeline:\n${state.timeline.map((e) => `${new Date(e.t).toISOString().slice(11, 19)} ${e.who}: ${e.what}`).join("\n")}
Suggested action items:\n${s.lessons.join("\n")}`,
        fallback: template,
      });
    } else {
      await think(s, agent, state, [], config, { fallback: template });
    }

    // Learn: write to long-term memory so the next run can recall it
    const mem: IncidentMemory = {
      id: `INC-${3000 + incidentMemory.length + 1}`,
      scenarioId: s.id,
      title: s.title,
      rootCause: firstSentence(state.findings["rca"] ?? state.findings[s.stages[s.stages.length - 5]?.[0]] ?? s.summary),
      resolution: state.decision?.approved ? s.remediation.title : "escalated",
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
    };
    incidentMemory.push(mem);
    emit(config, { type: "memory", content: `Stored ${mem.id} in long-term incident memory (${incidentMemory.length} total)` });
    emit(config, { type: "report", markdown });
    emit(config, { type: "agent_done", agent: agent.id, summary: "Post-incident report published" });
    audit(config, agent.name, "publish_report(channel=#incidents, statuspage=updated)", "OK");
    return { findings: { [agent.id]: "Report published" } };
  };
}

// ---------------------------------------------------------------------------
// Graph builder: stages → StateGraph with fan-out / fan-in + HITL gate
// ---------------------------------------------------------------------------

export function buildLabGraph(s: Scenario) {
  const builder: any = new StateGraph(LabState);
  const byId = new Map(s.agents.map((a) => [a.id, a]));

  s.stages.forEach((stage, i) => {
    for (const id of stage) {
      const agent = byId.get(id);
      if (!agent) throw new Error(`Unknown agent ${id} in ${s.id}`);
      const node =
        agent.kind === "human"
          ? humanNode(s, agent, i)
          : agent.kind === "reporter"
            ? reporterNode(s, agent, i)
            : agentNode(s, agent, i);
      builder.addNode(id, node);
    }
  });

  const reporterId = s.stages[s.stages.length - 1][0];

  s.stages.forEach((stage, i) => {
    if (i === 0) {
      for (const id of stage) builder.addEdge(START, id);
      return;
    }
    const prev = s.stages[i - 1];
    const prevIsHuman = prev.length === 1 && byId.get(prev[0])?.kind === "human";
    if (prevIsHuman) {
      // Conditional routing: approved → executor stage, rejected → reporter
      builder.addConditionalEdges(
        prev[0],
        (st: LabStateT) => (st.decision?.approved ? stage[0] : reporterId),
        [stage[0], reporterId],
      );
      return;
    }
    for (const id of stage) {
      // Fan-in: a node with several parents waits for all of them
      builder.addEdge(prev.length > 1 ? prev : prev[0], id);
    }
  });
  builder.addEdge(reporterId, END);

  return builder.compile({ checkpointer });
}

export function getLabGraph(scenarioId: string) {
  const s = getScenario(scenarioId);
  if (!s) throw new Error(`Unknown scenario ${scenarioId}`);
  // In dev, rebuild each time so edits to scenario files show up immediately.
  let graph = process.env.NODE_ENV === "production" ? g.__labGraphs!.get(scenarioId) : undefined;
  if (!graph) {
    graph = buildLabGraph(s);
    g.__labGraphs!.set(scenarioId, graph);
  }
  return { graph, scenario: s };
}

export function getIncidentMemory() {
  return incidentMemory;
}
