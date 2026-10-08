// Shared types for the Live Agent Lab (server graph + client UI).

export type AgentKind =
  | "supervisor"
  | "investigator"
  | "analyst"
  | "planner"
  | "human"
  | "executor"
  | "validator"
  | "reporter";

export type RiskLevel = "low" | "medium" | "high";

export interface ToolDef {
  /** Tool name as the agent would call it, e.g. `query_logs` */
  name: string;
  /** Arguments shown in the UI */
  args: Record<string, string | number | boolean>;
  /** Simulated tool output (terminal style) */
  output: string;
}

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  /** lucide icon name, e.g. "Radar" */
  icon: string;
  /** hex colour for node + chat bubbles */
  color: string;
  kind: AgentKind;
  tools?: ToolDef[];
  /** Agent-specific instructions appended to the system prompt */
  instructions?: string;
  /** Scripted answer used when no Groq key is configured (simulation mode) */
  fallback: string;
}

export interface MetricSeries {
  name: string;
  unit: string;
  /** SLO / threshold line */
  threshold: number;
  /** "higher" = higher is worse */
  badWhen: "higher" | "lower";
  before: number[];
  after: number[];
}

export interface Remediation {
  title: string;
  command: string;
  risk: RiskLevel;
  blastRadius: string;
  rollbackPlan: string;
  guardrails: { check: string; pass: boolean; detail: string }[];
}

export interface Scenario {
  id: string;
  title: string;
  industry: string;
  company: string;
  service: string;
  icon: string;
  /** tailwind gradient classes for the card */
  gradient: string;
  accent: string;
  severity: "SEV1" | "SEV2" | "SEV3";
  summary: string;
  alert: { title: string; source: string; time: string; details: string };
  /** Which course modules this scenario reinforces */
  modules: string[];
  agents: AgentDef[];
  /** Ordered stages; each stage is a list of agent ids that run in parallel */
  stages: string[][];
  remediation: Remediation;
  metric: MetricSeries;
  /** Lessons highlighted in the final report */
  lessons: string[];
}

// ---------- Events streamed from server to client ----------

export type LabEvent =
  | { type: "run_start"; threadId: string; mode: "groq" | "simulated"; model?: string }
  | { type: "agent_start"; agent: string; stage: number }
  | { type: "tool_call"; agent: string; tool: string; args: Record<string, unknown>; id: string }
  | { type: "tool_result"; agent: string; tool: string; output: string; id: string }
  | { type: "token"; agent: string; delta: string }
  | { type: "token_reset"; agent: string }
  | { type: "agent_done"; agent: string; summary: string }
  | { type: "message"; from: string; to: string[]; content: string; intent: string }
  | {
      type: "approval_required";
      remediation: Remediation;
      proposal: string;
      policy: string;
    }
  | { type: "decision"; approved: boolean; by: string; comment?: string; auto?: boolean }
  | { type: "metric_update"; phase: "recovery"; values: number[] }
  | { type: "audit"; ts: string; actor: string; action: string; result: string }
  | { type: "memory"; content: string }
  | { type: "report"; markdown: string }
  | { type: "warning"; message: string }
  | { type: "paused" }
  | { type: "done" }
  | { type: "error"; message: string };

export type AutonomyMode = "hitl" | "autonomous";
