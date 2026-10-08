import Link from "next/link";
import { ArrowRight, GitFork, MessagesSquare, ShieldCheck, UserCheck, Wrench } from "lucide-react";
import { scenarios } from "@/lib/scenarios";
import { getModule } from "@/lib/course";
import { Icon } from "@/components/ui/Icon";

const RISK_COLOR = { low: "#34d399", medium: "#fbbf24", high: "#f87171" };

export default function LabHome() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-10">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Live Agent Lab</div>
        <h1 className="mt-1 text-4xl font-bold">Real incidents. Real agent teamwork.</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Each scenario is a LangGraph <code className="text-violet-300">StateGraph</code> of specialised agents. They fan out in parallel,
          call tools, pass findings to each other, merge evidence, pause at a human approval gate, act, validate, and write the postmortem.
          Reasoning streams live from Groq, or from a simulator when no API key is set.
        </p>
      </div>

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { i: <GitFork className="h-4 w-4" />, t: "Parallel fan-out / fan-in", c: "text-cyan-300" },
          { i: <Wrench className="h-4 w-4" />, t: "Tool calling with outputs", c: "text-amber-300" },
          { i: <MessagesSquare className="h-4 w-4" />, t: "Agent-to-agent messages", c: "text-pink-300" },
          { i: <UserCheck className="h-4 w-4" />, t: "interrupt() approval gate", c: "text-emerald-300" },
          { i: <ShieldCheck className="h-4 w-4" />, t: "Guardrails + audit trail", c: "text-violet-300" },
        ].map((f) => (
          <div key={f.t} className={`glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${f.c}`}>
            {f.i} <span className="text-ink">{f.t}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((s) => (
          <Link key={s.id} href={`/lab/${s.id}`} className="glass group flex flex-col overflow-hidden rounded-3xl transition hover:-translate-y-1 hover:border-white/25">
            <div className={`relative h-36 bg-gradient-to-br ${s.gradient} p-5`}>
              <div className="grid-bg absolute inset-0 opacity-30" />
              <div className="relative flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-black/25 text-white backdrop-blur">
                  <Icon name={s.icon} className="h-6 w-6" />
                </span>
                <span className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-bold text-white">{s.severity}</span>
              </div>
              <div className="relative mt-4 text-xs font-semibold uppercase tracking-widest text-white/85">{s.industry}</div>
              <div className="relative text-sm text-white/75">{s.company}</div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="text-xl font-semibold leading-snug">{s.title}</h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{s.summary}</p>
              <div className="mt-4 flex -space-x-2">
                {s.agents.map((a) => (
                  <span
                    key={a.id}
                    title={a.name}
                    className="grid h-8 w-8 place-items-center rounded-full border-2 border-panelsolid"
                    style={{ background: `${a.color}`, color: "#0b0b14" }}
                  >
                    <Icon name={a.icon} className="h-4 w-4" />
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2 py-0.5">{s.agents.length} agents</span>
                <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: `${RISK_COLOR[s.remediation.risk]}22`, color: RISK_COLOR[s.remediation.risk] }}>
                  fix risk: {s.remediation.risk}
                </span>
                {s.modules.slice(0, 3).map((m) => (
                  <span key={m} className="rounded-full bg-white/5 px-2 py-0.5 text-muted">M{getModule(m)?.number}</span>
                ))}
                <ArrowRight className="ml-auto h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
