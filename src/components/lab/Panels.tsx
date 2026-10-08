"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  Gavel,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgentDef, Scenario } from "@/lib/types";
import { Icon } from "../ui/Icon";
import type { Approval, AuditRow, FeedItem, LabState } from "./useLabRun";

// ─────────────────────────────── Comms feed ───────────────────────────────

const INTENT_COLORS: Record<string, string> = {
  delegate: "#a78bfa",
  evidence: "#22d3ee",
  analysis: "#fbbf24",
  proposal: "#fb923c",
  approval: "#34d399",
  escalation: "#f87171",
  execution: "#4ade80",
  validation: "#2dd4bf",
  update: "#94a3b8",
};

function Avatar({ a, size = 7 }: { a?: AgentDef; size?: number }) {
  if (!a) return null;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg"
      style={{ background: `${a.color}26`, color: a.color, width: size * 4, height: size * 4 }}
      title={a.name}
    >
      <Icon name={a.icon} className="h-4 w-4" />
    </span>
  );
}

export function CommsFeed({ scenario, feed }: { scenario: Scenario; feed: FeedItem[] }) {
  const byId = new Map(scenario.agents.map((a) => [a.id, a]));
  const ref = useRef<HTMLDivElement>(null);
  const [showTools, setShowTools] = useState(true);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [feed.length]);

  const items = showTools ? feed : feed.filter((f) => f.kind !== "tool");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <BrainCircuit className="h-4 w-4 text-violet-300" />
        <span className="text-sm font-semibold">Agent communication</span>
        <span className="rounded-full bg-white/10 px-2 text-xs text-muted">{feed.filter((f) => f.kind === "message").length} msgs</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} className="accent-violet-500" />
          tool calls
        </label>
      </div>
      <div ref={ref} className="scroll-thin flex-1 space-y-2.5 overflow-y-auto p-3">
        {items.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-faint">
            <div>
              Press <b className="text-white">Run agents</b> to start.
              <br />
              Agents will post findings and hand-offs here.
            </div>
          </div>
        )}
        {items.map((f) => (
            <div key={f.id} className="feed-in">
              {f.kind === "message" && (
                <div className="rounded-xl border border-line bg-white/[0.03] p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <Avatar a={byId.get(f.from)} size={6} />
                    <span className="font-semibold" style={{ color: byId.get(f.from)?.color }}>{byId.get(f.from)?.name}</span>
                    <ArrowRight className="h-3 w-3 text-faint" />
                    {f.to.map((t) => (
                      <span key={t} className="rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: `${byId.get(t)?.color}1f`, color: byId.get(t)?.color }}>
                        {byId.get(t)?.name}
                      </span>
                    ))}
                    <span
                      className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: `${INTENT_COLORS[f.intent] ?? "#94a3b8"}22`, color: INTENT_COLORS[f.intent] ?? "#94a3b8" }}
                    >
                      {f.intent}
                    </span>
                  </div>
                  <p className="text-[13px] leading-snug text-slate-200">{f.content}</p>
                </div>
              )}
              {f.kind === "tool" && <ToolLine item={f} agent={byId.get(f.run.agent)} />}
              {f.kind === "decision" && (
                <div
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-sm ${
                    f.approved ? "border-emerald-400/40 bg-emerald-400/10" : "border-red-400/40 bg-red-400/10"
                  }`}
                >
                  {f.approved ? <ThumbsUp className="mt-0.5 h-4 w-4 text-emerald-300" /> : <ThumbsDown className="mt-0.5 h-4 w-4 text-red-300" />}
                  <div>
                    <b>{f.approved ? (f.auto ? "Auto-approved by policy" : `Approved by ${f.by}`) : `Rejected by ${f.by}`}</b>
                    {f.comment && <div className="text-xs text-muted">{f.comment}</div>}
                  </div>
                </div>
              )}
              {f.kind === "system" && (
                <div
                  className={`rounded-lg px-2.5 py-1.5 text-center text-[11.5px] ${
                    f.tone === "warn" ? "bg-amber-400/10 text-amber-300" : f.tone === "memory" ? "bg-fuchsia-400/10 text-fuchsia-300" : "text-faint"
                  }`}
                >
                  {f.tone === "memory" ? "🧠 " : f.tone === "warn" ? "⚠️ " : "— "}
                  {f.text}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function ToolLine({ item, agent }: { item: Extract<FeedItem, { kind: "tool" }>; agent?: AgentDef }) {
  const [open, setOpen] = useState(false);
  const { run } = item;
  const args = Object.entries(run.args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? `"${v}"` : v}`)
    .join(", ");
  return (
    <div className="rounded-lg border border-line bg-black/40 font-mono text-[11px]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left">
        <Terminal className="h-3 w-3 shrink-0" style={{ color: agent?.color }} />
        <span style={{ color: agent?.color }}>{agent?.name.split(" ")[0]}</span>
        <span className="text-cyan-300">{run.tool}</span>
        <span className="truncate text-faint">({args})</span>
        <span className="ml-auto shrink-0">
          {run.output ? <Check className="h-3 w-3 text-emerald-400" /> : <span className="inline-block h-2 w-2 animate-ping rounded-full bg-cyan-400" />}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 text-faint transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && run.output && <pre className="whitespace-pre-wrap border-t border-line px-2 py-1.5 text-slate-300">{run.output}</pre>}
    </div>
  );
}

// ─────────────────────────────── Metrics ───────────────────────────────

export function MetricsPanel({ scenario, state }: { scenario: Scenario; state: LabState }) {
  const m = scenario.metric;
  const before = m.before.map((v, i) => ({ t: `T-${m.before.length - 1 - i}`, incident: v, recovery: null as number | null }));
  const data = [...before];
  if (state.recovery) {
    data[data.length - 1] = { ...data[data.length - 1], recovery: data[data.length - 1].incident };
    state.recovery.forEach((v, i) => data.push({ t: `+${i + 1}`, incident: null as unknown as number, recovery: v }));
  }
  const current = state.recovery ? state.recovery[state.recovery.length - 1] : m.before[m.before.length - 1];
  const breached = m.badWhen === "higher" ? current > m.threshold : current < m.threshold;

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-faint">Live signal</div>
          <div className="font-semibold">{m.name}</div>
        </div>
        <div className={`text-right ${breached ? "text-red-400" : "text-emerald-400"}`}>
          <div className="text-3xl font-bold tabular-nums">
            {current}
            <span className="text-base">{m.unit}</span>
          </div>
          <div className="text-[11px] font-semibold uppercase">{breached ? "SLO breached" : "Within SLO"}</div>
        </div>
      </div>
      <div className="min-h-[150px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f43f5e" stopOpacity={0.55} />
                <stop offset="1" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#34d399" stopOpacity={0.55} />
                <stop offset="1" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,255,0.08)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#636b8f", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#636b8f", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#121729", border: "1px solid rgba(148,163,255,0.2)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#9aa3c7" }}
            />
            <ReferenceLine y={m.threshold} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "SLO", fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
            <Area type="monotone" dataKey="incident" name="before" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gInc)" connectNulls={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="recovery" name="after fix" stroke="#34d399" strokeWidth={2.5} fill="url(#gRec)" connectNulls isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function KpiStrip({ scenario, state }: { scenario: Scenario; state: LabState }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (state.status !== "running" && state.status !== "awaiting") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state.status]);
  const elapsed = state.startedAt ? ((state.finishedAt ?? now) - state.startedAt) / 1000 : 0;
  const doneAgents = Object.values(state.agents).filter((a) => a.status === "done").length;
  const active = Object.entries(state.agents).filter(([, a]) => a.status === "active").length;

  const kpis = [
    { label: "Agent time", value: `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`, color: "#a78bfa" },
    { label: "Agents done", value: `${doneAgents}/${scenario.agents.length}`, color: "#34d399" },
    { label: "Active now", value: String(active), color: "#22d3ee" },
    { label: "Tool calls", value: String(state.toolCount), color: "#fbbf24" },
    { label: "Messages", value: String(state.messageCount), color: "#f472b6" },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {kpis.map((k) => (
        <div key={k.label} className="glass rounded-xl px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-faint">{k.label}</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: k.color }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────── Inspector ───────────────────────────────

export function AgentInspector({ scenario, state, agentId }: { scenario: Scenario; state: LabState; agentId: string | null }) {
  const agent = scenario.agents.find((a) => a.id === agentId);
  if (!agent) {
    return <div className="grid h-full place-items-center p-6 text-center text-sm text-faint">Click any agent in the graph to inspect its reasoning, tools and output.</div>;
  }
  const st = state.agents[agent.id];
  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${agent.color}26`, color: agent.color }}>
          <Icon name={agent.icon} className="h-5 w-5" />
        </span>
        <div>
          <div className="font-semibold">{agent.name}</div>
          <div className="text-xs text-muted">{agent.role}</div>
        </div>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase">{st?.status}</span>
      </div>
      <div className="mb-2 text-[10px] uppercase tracking-widest text-faint">Tools allowed</div>
      <div className="mb-3 flex flex-wrap gap-1">
        {(agent.tools ?? []).length === 0 && <span className="text-xs text-faint">reasoning only</span>}
        {(agent.tools ?? []).map((t) => (
          <span key={t.name} className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300">{t.name}</span>
        ))}
      </div>
      {st?.tools.map((t) => (
        <div key={t.id} className="mb-2 rounded-lg border border-line bg-black/40 font-mono text-[11px]">
          <div className="border-b border-line px-2 py-1 text-cyan-300">$ {t.tool} {JSON.stringify(t.args)}</div>
          <pre className="whitespace-pre-wrap px-2 py-1 text-slate-300">{t.output ?? "running…"}</pre>
        </div>
      ))}
      <div className="mb-1 mt-2 text-[10px] uppercase tracking-widest text-faint">LLM reasoning output</div>
      <div className={`rounded-lg bg-white/5 p-2.5 text-sm leading-relaxed ${st?.status === "active" ? "caret" : ""}`}>
        {agent.kind === "reporter" ? "See the post-incident report below." : st?.text || <span className="text-faint">not started</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────── Audit log ───────────────────────────────

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [rows.length]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <ScrollText className="h-4 w-4 text-emerald-300" />
        <span className="text-sm font-semibold">Audit trail</span>
        <span className="ml-auto text-xs text-faint">{rows.length} entries</span>
      </div>
      <div ref={ref} className="scroll-thin flex-1 overflow-y-auto bg-black/30 p-3 font-mono text-[11px] leading-relaxed">
        {rows.length === 0 && <div className="text-faint">$ tail -f /var/log/agents/audit.log</div>}
        {rows.map((r, i) => (
          <div key={i}>
            <span className="text-faint">{r.ts.slice(11, 19)}</span>{" "}
            <span className="text-violet-300">[{r.actor}]</span> <span className="text-slate-200">{r.action}</span>{" "}
            <span className={/APPROVED|EXECUTED|OK/.test(r.action + r.result) ? "text-emerald-400" : /REJECTED/.test(r.action) ? "text-red-400" : "text-cyan-300"}>
              → {r.result}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────── Approval modal ───────────────────────────────

const RISK = {
  low: { c: "#34d399", label: "LOW" },
  medium: { c: "#fbbf24", label: "MEDIUM" },
  high: { c: "#f87171", label: "HIGH" },
};

export function ApprovalModal({
  approval,
  onDecide,
}: {
  approval: Approval;
  onDecide: (d: { approved: boolean; by: string; comment?: string }) => void;
}) {
  const [by, setBy] = useState("On-call SRE");
  const [comment, setComment] = useState("");
  const r = approval.remediation;
  const risk = RISK[r.risk];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass scroll-thin max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-amber-500/20 to-transparent px-6 py-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400 text-black">
            <Gavel className="h-6 w-6" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-amber-300">LangGraph interrupt() · Human approval gate</div>
            <div className="text-lg font-semibold">Agents request permission to act</div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <div className="mb-1 text-xs uppercase tracking-widest text-faint">Proposed action</div>
            <div className="text-lg font-semibold">{r.title}</div>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-black/50 px-3 py-2 font-mono text-xs text-emerald-300">$ {r.command}</pre>
          </div>

          {approval.proposal && (
            <div className="rounded-xl border border-line bg-white/5 p-3 text-sm">
              <div className="mb-1 text-xs uppercase tracking-widest text-faint">Agent recommendation</div>
              {approval.proposal}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3" style={{ borderColor: `${risk.c}66`, background: `${risk.c}14` }}>
              <div className="text-xs uppercase tracking-widest text-faint">Risk</div>
              <div className="flex items-center gap-1 text-xl font-bold" style={{ color: risk.c }}>
                <ShieldAlert className="h-5 w-5" /> {risk.label}
              </div>
            </div>
            <div className="rounded-xl border border-line p-3 sm:col-span-2">
              <div className="text-xs uppercase tracking-widest text-faint">Blast radius</div>
              <div className="text-sm">{r.blastRadius}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-faint">Guardrail checks</div>
            <div className="grid gap-1.5">
              {r.guardrails.map((g) => (
                <div key={g.check} className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm">
                  {g.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                  <span className="font-medium">{g.check}</span>
                  <span className="text-muted">· {g.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-widest text-faint"><ShieldCheck className="h-3.5 w-3.5" /> Policy</div>
              {approval.policy}
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="mb-1 text-xs uppercase tracking-widest text-faint">Rollback plan</div>
              {r.rollbackPlan}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Approver name" className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400" />
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">
          <button
            onClick={() => onDecide({ approved: false, by: by || "human", comment: comment || undefined })}
            className="flex items-center gap-2 rounded-xl border border-red-400/50 bg-red-500/10 px-5 py-2.5 font-semibold text-red-300 hover:bg-red-500/20"
          >
            <XCircle className="h-4 w-4" /> Reject & escalate
          </button>
          <button
            onClick={() => onDecide({ approved: true, by: by || "human", comment: comment || undefined })}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-emerald-500/30"
          >
            <ThumbsUp className="h-4 w-4" /> Approve & execute
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────── Report ───────────────────────────────

export function ReportPanel({ scenario, markdown, final, onClose }: { scenario: Scenario; markdown: string; final: boolean; onClose?: () => void }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-line bg-gradient-to-r from-fuchsia-500/20 to-transparent px-5 py-3">
        <ScrollText className="h-5 w-5 text-fuchsia-300" />
        <span className="font-semibold">Post-incident report</span>
        {!final && <span className="text-xs text-muted">writing…</span>}
        {final && (
          <button
            onClick={() => {
              const blob = new Blob([markdown], { type: "text/markdown" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${scenario.id}-postmortem.md`;
              a.click();
            }}
            className="ml-auto flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
          >
            <Download className="h-3.5 w-3.5" /> Download .md
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className={`${final ? "" : "ml-auto"} text-muted hover:text-white`}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className={`md p-5 text-sm ${final ? "" : "caret"}`}>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
