"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BellRing,
  Bot,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  Zap,
} from "lucide-react";
import type { AutonomyMode, Scenario } from "@/lib/types";
import { getModule } from "@/lib/course";
import { getScenario } from "@/lib/scenarios";
import { Icon } from "../ui/Icon";
import { useSettings } from "../providers";
import { useLabRun } from "./useLabRun";
import { AgentGraph } from "./AgentGraph";
import { AgentInspector, ApprovalModal, AuditLog, CommsFeed, KpiStrip, MetricsPanel, ReportPanel } from "./Panels";

export function LabRunner({ scenarioId }: { scenarioId: string }) {
  const scenario = getScenario(scenarioId) as Scenario;
  const { state, start, resume, reset } = useLabRun(scenario);
  const { refreshStatus } = useSettings();
  const [autonomy, setAutonomy] = useState<AutonomyMode>("hitl");
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  // Follow the most recently active agent in the inspector
  const activeId = Object.entries(state.agents).find(([, a]) => a.status === "active" || a.status === "waiting")?.[0];
  useEffect(() => {
    if (activeId && state.status === "running") setSelected(activeId);
  }, [activeId, state.status]);

  useEffect(() => {
    if (state.status === "done") refreshStatus();
  }, [state.status, refreshStatus]);

  // ?autorun=1&speed=2&mode=autonomous starts the run on page load (handy when presenting)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("autorun") !== "1") return;
    const sp = Number(q.get("speed")) || 1;
    const mode: AutonomyMode = q.get("mode") === "autonomous" ? "autonomous" : "hitl";
    setSpeed(sp);
    setAutonomy(mode);
    start({ autonomy: mode, speed: sp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = state.status === "running" || state.status === "awaiting";
  const risk = scenario.remediation.risk;

  return (
    <div className="mx-auto max-w-[1700px] px-4 pb-24 pt-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Link href="/lab" className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${scenario.gradient} text-white shadow-lg`}>
          <Icon name={scenario.icon} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-widest text-muted">{scenario.industry}</span>
            <span className="text-faint">·</span>
            <span className="text-muted">{scenario.company}</span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-bold text-red-300">{scenario.severity}</span>
          </div>
          <h1 className="truncate text-2xl font-bold">{scenario.title}</h1>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass flex rounded-xl p-1 text-xs">
            {(
              [
                ["hitl", "Human-in-the-loop", UserCheck],
                ["autonomous", "Autonomous", Bot],
              ] as const
            ).map(([v, label, I]) => (
              <button
                key={v}
                disabled={running}
                onClick={() => setAutonomy(v)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition disabled:opacity-60 ${
                  autonomy === v ? "bg-white text-black" : "text-muted hover:text-white"
                }`}
              >
                <I className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="glass flex rounded-xl p-1 text-xs">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                disabled={running}
                onClick={() => setSpeed(s)}
                className={`rounded-lg px-2.5 py-1.5 font-medium disabled:opacity-60 ${speed === s ? "bg-white text-black" : "text-muted hover:text-white"}`}
              >
                {s}×
              </button>
            ))}
          </div>
          {state.status === "idle" ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => start({ autonomy, speed })}
              className={`flex items-center gap-2 rounded-xl bg-gradient-to-r ${scenario.gradient} px-5 py-2.5 font-semibold text-white shadow-lg`}
            >
              <Play className="h-4 w-4" /> Run agents
            </motion.button>
          ) : (
            <button
              onClick={() => {
                reset();
                setSelected(null);
              }}
              className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium hover:bg-white/5"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Alert + status */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-500/15 to-transparent px-4 py-3">
          <BellRing className={`mt-0.5 h-5 w-5 shrink-0 text-red-400 ${state.status === "done" ? "" : "animate-pulse"}`} />
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-red-200">
              [{scenario.alert.time}] {scenario.alert.title}
            </div>
            <div className="truncate font-mono text-xs text-red-200/70">
              {scenario.alert.source} · {scenario.alert.details}
            </div>
          </div>
        </div>
        <StatusPill state={state} autonomy={autonomy} risk={risk} />
      </div>

      <KpiStrip scenario={scenario} state={state} />

      {/* Graph (full width so every agent is readable on a projector) */}
      <div className="glass relative mt-4 h-[500px] overflow-hidden rounded-2xl">
        <div className="absolute left-4 top-3 z-10 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-black/50 px-2 py-1">LangGraph StateGraph · {scenario.agents.length} nodes · {scenario.stages.length} stages</span>
          {state.mode && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-1 ${state.mode === "groq" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>
              <Zap className="h-3 w-3" /> {state.mode === "groq" ? `Groq · ${state.model}` : "simulated reasoning"}
            </span>
          )}
          <span className="hidden items-center gap-3 rounded-full bg-black/50 px-3 py-1 md:flex">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" /> message in flight</span>
            <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t-2 border-dashed border-red-400" /> rejection route</span>
          </span>
        </div>
        <AgentGraph scenario={scenario} state={state} selected={selected} onSelect={setSelected} />
      </div>

      {/* Comms / inspector / metrics + audit */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-[1.15fr_1fr_1fr]">
        <div className="glass h-[560px] overflow-hidden rounded-2xl">
          <CommsFeed scenario={scenario} feed={state.feed} />
        </div>
        <div className="glass h-[560px] overflow-hidden rounded-2xl">
          <AgentInspector scenario={scenario} state={state} agentId={selected} />
        </div>
        <div className="grid h-[560px] grid-rows-[1fr_1fr] gap-4 lg:col-span-2 2xl:col-span-1">
          <div className="glass overflow-hidden rounded-2xl">
            <MetricsPanel scenario={scenario} state={state} />
          </div>
          <div className="glass overflow-hidden rounded-2xl">
            <AuditLog rows={state.audit} />
          </div>
        </div>
      </div>

      {state.error && <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-300">Error: {state.error}</div>}

      {state.report && (
        <div className="mt-4">
          <ReportPanel scenario={scenario} markdown={state.report} final={state.reportFinal} />
        </div>
      )}

      {/* Scenario briefing */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="glass rounded-2xl p-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-faint">Scenario briefing</div>
          <p className="text-sm leading-relaxed text-muted">{scenario.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {scenario.stages.map((st, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex gap-1 rounded-lg border border-line bg-white/[0.03] px-2 py-1">
                  {st.map((id) => {
                    const a = scenario.agents.find((x) => x.id === id)!;
                    return (
                      <span key={id} title={a.name} style={{ color: a.color }}>
                        <Icon name={a.icon} className="h-4 w-4" />
                      </span>
                    );
                  })}
                  {st.length > 1 && <span className="ml-1 text-[10px] text-faint">parallel</span>}
                </div>
                {i < scenario.stages.length - 1 && <span className="text-faint">→</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-faint">
            <GraduationCap className="h-4 w-4" /> Reinforces modules
          </div>
          <div className="space-y-1.5">
            {scenario.modules.map((id) => {
              const m = getModule(id)!;
              return (
                <Link key={id} href={`/learn/${id}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/5">
                  <span style={{ color: m.color }}><Icon name={m.icon} className="h-4 w-4" /></span>
                  {m.number}. {m.title}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {state.status === "awaiting" && state.approval && (
        <ApprovalModal approval={state.approval} onDecide={(d) => resume(d, { autonomy, speed })} />
      )}
    </div>
  );
}

function StatusPill({ state, autonomy, risk }: { state: ReturnType<typeof useLabRun>["state"]; autonomy: AutonomyMode; risk: string }) {
  const map = {
    idle: { text: `Ready · ${autonomy === "hitl" ? "human approves actions" : `autonomous (fix risk: ${risk})`}`, cls: "border-line text-muted", icon: <Play className="h-4 w-4" /> },
    running: { text: "Agents working…", cls: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    awaiting: { text: "Paused: waiting for your approval", cls: "border-amber-400/50 bg-amber-400/10 text-amber-300", icon: <ShieldAlert className="h-4 w-4 animate-pulse" /> },
    done: {
      text: state.decision?.approved === false ? "Escalated to humans" : "Resolved & validated",
      cls: state.decision?.approved === false ? "border-red-400/50 bg-red-400/10 text-red-300" : "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    error: { text: "Run failed", cls: "border-red-400/50 bg-red-400/10 text-red-300", icon: <ShieldAlert className="h-4 w-4" /> },
  }[state.status];
  return <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${map.cls}`}>{map.icon} {map.text}</div>;
}
